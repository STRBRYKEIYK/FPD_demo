# OCR Provider Setup

## Provider Overview

| `OCR_PROVIDER` | Description |
|---|---|
| `python` | Local Tesseract/EasyOCR via Python worker. Free, no rate limits. |
| `qwen` | Qwen-VL via OpenRouter (globally accessible). Best accuracy for complex layouts. Requires API key. |
| `local` | Tesseract.js only. Most portable fallback, lowest accuracy on complex scans. |
| `auto` (default) | Qwen -> EasyOCR -> local fallback chain. |

---

## Qwen-VL OCR via OpenRouter (Globally Accessible)

No Chinese phone number required. Sign up at **https://openrouter.ai** with any email.

Set `OCR_PROVIDER=qwen` and add your OpenRouter key:

```env
OCR_PROVIDER=qwen
OPENROUTER_API_KEY=sk-or-your-key-here
QWEN_MODEL=qwen/qwen2.5-vl-72b-instruct   # or qwen/qwen2.5-vl-7b-instruct (faster/cheaper)
QWEN_MAX_TOKENS=4096                       # optional, clamps to 256..8192
QWEN_OCR_TIMEOUT_MS=30000                  # optional, default 30 s
QWEN_OCR_PROMPT=Extract all visible text from this image exactly as it appears.
```

Get your key at https://openrouter.ai/keys (free credits included on sign-up).

> **Available Qwen vision models on OpenRouter:**
> - `qwen/qwen2.5-vl-72b-instruct` — highest accuracy (default)
> - `qwen/qwen2.5-vl-7b-instruct` — faster and cheaper
>
> Browse all models at https://openrouter.ai/models?q=qwen

If the API call fails (network error, quota exceeded, bad key), the service automatically falls back with a warning in the response so ingestion keeps working.

---

# Python OCR Setup (Free, Local, No API Limits)

This ingestion backend now supports `OCR_PROVIDER=python` in addition to local JS OCR.

## 1) Install Python dependencies

From `ingestion-service/python`:

```bash
pip install -r requirements.txt
```

Optional (for handwritten HTR with TrOCR):

```bash
pip install -r requirements-htr.txt
```

Also install the native **Tesseract OCR engine** on the host machine and ensure it is in `PATH`.

For deployments (Render, Railway, etc.), ensure this step runs in build/install.
The `ingestion-service` now runs `python3 -m pip install -r python/requirements.txt` via `postinstall`.

- Windows: install Tesseract and add install directory (for example `C:\Program Files\Tesseract-OCR`) to `PATH`.
- If your shell cannot find `tesseract` yet, restart terminal/VS Code, or set `OCR_TESSERACT_CMD` (see env vars below).

## 2) Configure environment variables

Set these in the environment where `ingestion-service` runs:

- `OCR_PROVIDER=python`
- `OCR_PYTHON_BIN=python` (optional, defaults to `python`)
- `OCR_PYTHON_SCRIPT=<absolute-path>/ingestion-service/python/ocr_worker.py` (optional)
- `OCR_PYTHON_TIMEOUT_MS=45000` (optional)
- `OCR_PYTHON_SCAN_MODE=auto` (optional: `auto`, `fast`, `balanced`, `handwritten`)
- `OCR_TESSERACT_CMD=C:/Program Files/Tesseract-OCR/tesseract.exe` (optional, recommended on Windows if PATH is inconsistent)
- `OCR_ENABLE_TROCR=0` (optional: set to `1` to enable transformer-based HTR for handwritten mode)
- `OCR_TROCR_MODEL=microsoft/trocr-base-handwritten` (optional)

`OCR_PYTHON_SCAN_MODE=auto` uses:
- `fast` for typical digital receipts/invoices,
- `balanced` for utility bills/SOA (e.g., Converge/PLDT/Globe),
- `handwritten` for voucher-style handwritten forms.

The Python worker now applies OpenCV preprocessing (grayscale, denoise, adaptive threshold, deskew) before OCR scoring.

For handwritten scan mode, preprocessing now also removes form/grid lines before recognition. If `OCR_ENABLE_TROCR=1`, the worker runs TrOCR on segmented text lines and will use HTR output when confidence is sufficient; otherwise it falls back to Tesseract text while preserving token boxes for downstream UI mapping.

If Python OCR fails, the service automatically falls back to local OCR and returns a warning.

## 3) Current scope

- Python OCR path currently handles **image uploads** (`image/jpeg`, `image/png`).
- Non-image files continue through local OCR heuristics.

## 4) Existing backend integration (checked)

- Frontend OCR calls go directly to ingestion service endpoints:
  - `POST /api/ingest/upload`
  - `POST /api/ingest/confirm-save`
- PHP `api/routes/finance-payroll.php` is not in the OCR extraction request path and does not need changes for this provider switch.
