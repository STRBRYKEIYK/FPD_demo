import json
import os
import re
import sys
import time
from typing import Any, Dict, List


_EASYOCR_READER: Any = None


def _json_error(message: str, details: Dict[str, Any] | None = None) -> None:
    payload: Dict[str, Any] = {"ok": False, "error": message}
    if details:
        payload["details"] = details
    print(json.dumps(payload, ensure_ascii=False))


def _normalize_mode(value: str) -> str:
    normalized = (value or "").strip().lower()
    if normalized in {"fast", "balanced", "handwritten", "auto"}:
        return normalized
    return "auto"


def _looks_like_handwritten_hint(document_type_hint: str) -> bool:
    normalized = (document_type_hint or "").strip().lower()
    return any(k in normalized for k in {"handwritten", "handwriting", "manual", "written"})


def _looks_like_digital_receipt_hint(document_type_hint: str) -> bool:
    normalized = (document_type_hint or "").strip().lower()
    return any(k in normalized for k in {
        "receipt", "official_receipt", "official-receipt",
        "sales_invoice", "sales-invoice", "invoice", "bill", "monthly_bill", "utility",
    })


def _looks_like_bill_hint(document_type_hint: str) -> bool:
    normalized = (document_type_hint or "").strip().lower()
    return any(k in normalized for k in {"bill", "monthly_bill", "utility"})


def _looks_like_voucher_hint(document_type_hint: str) -> bool:
    normalized = (document_type_hint or "").strip().lower()
    return any(k in normalized for k in {
        "voucher", "cash_voucher", "cash-voucher", "check_voucher",
        "check-voucher", "petty_cash_voucher", "petty-cash-voucher",
        "payment_voucher", "payment-voucher",
    })


def _resolve_scan_mode(requested_mode: str, document_type_hint: str) -> str:
    mode = _normalize_mode(requested_mode)
    if mode != "auto":
        return mode
    if _looks_like_handwritten_hint(document_type_hint):
        return "handwritten"
    if _looks_like_voucher_hint(document_type_hint):
        return "handwritten"
    if _looks_like_bill_hint(document_type_hint):
        return "balanced"
    if _looks_like_digital_receipt_hint(document_type_hint):
        return "fast"
    return "balanced"


def _get_easyocr_reader() -> Any:
    global _EASYOCR_READER
    if _EASYOCR_READER is not None:
        return _EASYOCR_READER
    try:
        import easyocr
    except Exception as exc:
        raise RuntimeError(
            "Missing EasyOCR dependencies. Install with: pip install -r python/requirements.txt"
        ) from exc

    gpu_enabled = os.environ.get("OCR_EASYOCR_GPU", "0").strip().lower() in {"1", "true", "yes", "on"}
    _EASYOCR_READER = easyocr.Reader(['en'], gpu=gpu_enabled, verbose=False)
    return _EASYOCR_READER


# ─────────────────────────────────────────────────────────────────────────────
#  NEW: OCR text artifact correction
# ─────────────────────────────────────────────────────────────────────────────

def _fix_text_ocr_artifacts(text: str) -> str:
    """
    Fix common OCR misreadings in extracted text.

    Key corrections:
    - '8' between letter-words → '&'  (e.g. "WORKS 8 GENERAL" → "WORKS & GENERAL")
    - 'S' prefixing a currency amount → '$' (less common in PH docs, skip)
    - Remove stray zero-width chars
    """
    if not text:
        return text

    # Fix: standalone '8' between two letter-words → '&'
    # Python re does not support variable-width lookbehinds, so we use a
    # capturing group for the prefix word-ending letters and put them back.
    # Pattern: (≥2 letters)(space 8 space)(≥2 letters ahead)
    text = re.sub(
        r'([A-Za-z]{2,}) 8 (?=[A-Za-z]{2,})',
        r'\1 & ',
        text,
    )

    # Fix: '§' sometimes OCR'd as 'S' before number — not needed in PH context.

    # Fix: remove zero-width / invisible Unicode characters
    text = text.replace('\u200b', '').replace('\ufeff', '').replace('\u00ad', '')

    # Fix: normalize curly quotes to straight
    text = text.replace('\u2018', "'").replace('\u2019', "'")
    text = text.replace('\u201c', '"').replace('\u201d', '"')

    # Fix: '©' or '®' sometimes OCR'd near company names — strip them
    text = re.sub(r'[©®™]', '', text)

    # Fix: lone 'l' or 'I' surrounded by digits → '1'
    # (e.g. "0667915l88" → "066791588" — only when flanked by digits)
    text = re.sub(r'(?<=\d)[lI](?=\d)', '1', text)

    # Fix: 'O' (capital O) inside a long numeric string → '0'
    # Only when the token looks like a pure number with a stray O
    text = re.sub(r'(?<=\d)O(?=\d)', '0', text)
    text = re.sub(r'(?<=\d)o(?=\d)', '0', text)

    return text


# ─────────────────────────────────────────────────────────────────────────────
#  Core preprocessing primitives
# ─────────────────────────────────────────────────────────────────────────────

def _select_best_channel(image_rgb: Any, cv2_module: Any, np_module: Any) -> Any:
    """
    Select the single channel (R/G/B or LAB-L) with the highest contrast
    (std-dev). This is critical for colored-header documents (PLDT, Meralco).
    """
    try:
        bgr = cv2_module.cvtColor(np_module.array(image_rgb), cv2_module.COLOR_RGB2BGR)
        b, g, r = cv2_module.split(bgr)
        lab = cv2_module.cvtColor(bgr, cv2_module.COLOR_BGR2LAB)
        lightness = lab[:, :, 0]
        best = max([b, g, r, lightness], key=lambda ch: float(np_module.std(ch)))
        if float(np_module.mean(best)) < 100:
            best = cv2_module.bitwise_not(best)
        return best
    except Exception:
        return cv2_module.cvtColor(np_module.array(image_rgb), cv2_module.COLOR_RGB2GRAY)


def _apply_clahe(gray_img: Any, cv2_module: Any, clip_limit: float = 2.0) -> Any:
    try:
        clahe = cv2_module.createCLAHE(clipLimit=clip_limit, tileGridSize=(8, 8))
        return clahe.apply(gray_img)
    except Exception:
        return gray_img


def _deskew_image(gray_img: Any, cv2_module: Any, np_module: Any) -> Any:
    try:
        _, binary = cv2_module.threshold(
            gray_img, 0, 255, cv2_module.THRESH_BINARY_INV + cv2_module.THRESH_OTSU
        )
        kernel = cv2_module.getStructuringElement(cv2_module.MORPH_RECT, (40, 3))
        dilated = cv2_module.dilate(binary, kernel, iterations=1)
        contours, _ = cv2_module.findContours(
            dilated, cv2_module.RETR_EXTERNAL, cv2_module.CHAIN_APPROX_SIMPLE
        )
        angles: List[float] = []
        for contour in contours:
            if cv2_module.contourArea(contour) < 300:
                continue
            rect = cv2_module.minAreaRect(contour)
            angle = float(rect[2])
            if angle < -45:
                angle += 90
            elif angle > 45:
                angle -= 90
            if abs(angle) <= 15:
                angles.append(angle)
        if not angles:
            return gray_img
        median_angle = float(np_module.median(angles))
        if abs(median_angle) < 0.4:
            return gray_img
        h, w = gray_img.shape[:2]
        M = cv2_module.getRotationMatrix2D((w // 2, h // 2), median_angle, 1.0)
        return cv2_module.warpAffine(
            gray_img, M, (w, h),
            flags=cv2_module.INTER_LINEAR,
            borderMode=cv2_module.BORDER_REPLICATE,
        )
    except Exception:
        return gray_img


def _apply_sauvola_threshold(
    gray_img: Any, cv2_module: Any, np_module: Any,
    window_size: int = 51, k: float = 0.25,
) -> Any:
    try:
        gray_f = gray_img.astype(np_module.float32)
        mean = cv2_module.boxFilter(gray_f, cv2_module.CV_32F, (window_size, window_size))
        mean_sq = cv2_module.boxFilter(gray_f * gray_f, cv2_module.CV_32F, (window_size, window_size))
        variance = np_module.maximum(mean_sq - mean * mean, 0.0)
        std = np_module.sqrt(variance)
        R = 128.0
        threshold = mean * (1.0 + k * (std / R - 1.0))
        return np_module.where(gray_f >= threshold, 255, 0).astype(np_module.uint8)
    except Exception:
        _, binary = cv2_module.threshold(
            gray_img, 0, 255, cv2_module.THRESH_BINARY + cv2_module.THRESH_OTSU
        )
        return binary


def _add_border_padding(gray_img: Any, cv2_module: Any, pad: int = 24) -> Any:
    try:
        return cv2_module.copyMakeBorder(
            gray_img, pad, pad, pad, pad,
            cv2_module.BORDER_CONSTANT, value=255,
        )
    except Exception:
        return gray_img


def _upscale_gray(gray_img: Any, cv2_module: Any, scale: float) -> Any:
    if abs(scale - 1.0) < 0.05:
        return gray_img
    try:
        h, w = gray_img.shape[:2]
        new_w = max(1, int(round(w * scale)))
        new_h = max(1, int(round(h * scale)))
        return cv2_module.resize(gray_img, (new_w, new_h), interpolation=cv2_module.INTER_LANCZOS4)
    except Exception:
        return gray_img


def _remove_form_lines(gray_img: Any, cv2_module: Any, np_module: Any) -> Any:
    try:
        h_kernel = cv2_module.getStructuringElement(cv2_module.MORPH_RECT, (50, 1))
        v_kernel = cv2_module.getStructuringElement(cv2_module.MORPH_RECT, (1, 50))
        h_lines = cv2_module.morphologyEx(gray_img, cv2_module.MORPH_OPEN, h_kernel, iterations=1)
        v_lines = cv2_module.morphologyEx(gray_img, cv2_module.MORPH_OPEN, v_kernel, iterations=1)
        line_mask = cv2_module.addWeighted(h_lines, 1.0, v_lines, 1.0, 0.0)
        cleaned = cv2_module.inpaint(gray_img, line_mask, 3, cv2_module.INPAINT_TELEA)
        return cv2_module.fastNlMeansDenoising(cleaned, h=9)
    except Exception:
        return gray_img


def _suppress_barcode_regions(gray_img: Any, cv2_module: Any, np_module: Any) -> Any:
    try:
        h, w = gray_img.shape[:2]
        sobelx = cv2_module.Sobel(gray_img, cv2_module.CV_64F, 1, 0, ksize=3)
        sobelx_abs = cv2_module.convertScaleAbs(sobelx)
        kernel_v = cv2_module.getStructuringElement(cv2_module.MORPH_RECT, (1, 20))
        dilated = cv2_module.dilate(sobelx_abs, kernel_v, iterations=2)
        _, thresh = cv2_module.threshold(dilated, 120, 255, cv2_module.THRESH_BINARY)
        kernel_h = cv2_module.getStructuringElement(cv2_module.MORPH_RECT, (30, 1))
        merged = cv2_module.dilate(thresh, kernel_h, iterations=3)
        contours, _ = cv2_module.findContours(merged, cv2_module.RETR_EXTERNAL, cv2_module.CHAIN_APPROX_SIMPLE)
        result = gray_img.copy()
        for contour in contours:
            x, y, bw, bh = cv2_module.boundingRect(contour)
            aspect = bw / max(bh, 1)
            density = bw * bh / max(w * h, 1)
            if aspect > 1.5 and density > 0.01 and bh < h * 0.25:
                cv2_module.rectangle(result, (x, y), (x + bw, y + bh), 255, -1)
        return result
    except Exception:
        return gray_img


# ─────────────────────────────────────────────────────────────────────────────
#  Variant generation — quality-focused, mode-aware
# ─────────────────────────────────────────────────────────────────────────────

# Border padding constant — must match _add_border_padding pad arg used in _finalize
_BORDER_PAD = 20


def _build_ocr_variants(
    image_rgb: Any,
    cv2_module: Any,
    np_module: Any,
    pil_module: Any,
    scan_mode: str,
    upscale_factor: float,
) -> List[tuple[str, Any]]:
    variants: List[tuple[str, Any]] = []

    try:
        arr = np_module.array(image_rgb)
        if arr.ndim == 2:
            gray_base = arr
        else:
            gray_base = cv2_module.cvtColor(arr, cv2_module.COLOR_RGB2GRAY)

        gray_best_ch = _select_best_channel(image_rgb, cv2_module, np_module)

        gray_no_bc = _suppress_barcode_regions(gray_base, cv2_module, np_module)
        gray_ch_no_bc = _suppress_barcode_regions(gray_best_ch, cv2_module, np_module)

        do_deskew = scan_mode != "fast"
        gray_deskewed = _deskew_image(gray_no_bc, cv2_module, np_module) if do_deskew else gray_no_bc
        gray_ch_deskewed = _deskew_image(gray_ch_no_bc, cv2_module, np_module) if do_deskew else gray_ch_no_bc

        gray_clahe = _apply_clahe(gray_deskewed, cv2_module, clip_limit=2.0)
        gray_ch_clahe = _apply_clahe(gray_ch_deskewed, cv2_module, clip_limit=2.0)

        gray_denoised = cv2_module.fastNlMeansDenoising(gray_clahe, h=10)
        gray_ch_denoised = cv2_module.fastNlMeansDenoising(gray_ch_clahe, h=10)

        def _finalize(img: Any, scale: float = upscale_factor) -> Any:
            up = _upscale_gray(img, cv2_module, scale)
            padded = _add_border_padding(up, cv2_module, pad=_BORDER_PAD)
            return pil_module.fromarray(padded)

        sauvola = _apply_sauvola_threshold(gray_denoised, cv2_module, np_module, window_size=51, k=0.25)
        sauvola_ch = _apply_sauvola_threshold(gray_ch_denoised, cv2_module, np_module, window_size=51, k=0.25)

        adaptive_tight = cv2_module.adaptiveThreshold(
            gray_denoised, 255, cv2_module.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2_module.THRESH_BINARY, 17, 10,
        )
        adaptive_loose = cv2_module.adaptiveThreshold(
            gray_denoised, 255, cv2_module.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2_module.THRESH_BINARY, 31, 12,
        )

        _, otsu = cv2_module.threshold(
            gray_denoised, 0, 255, cv2_module.THRESH_BINARY + cv2_module.THRESH_OTSU
        )

        morph_kernel = np_module.ones((2, 2), np_module.uint8)
        sauvola_morph = cv2_module.morphologyEx(sauvola, cv2_module.MORPH_OPEN, morph_kernel)

        sharpened = cv2_module.filter2D(
            gray_denoised, -1,
            np_module.array([[-1, -1, -1], [-1, 9, -1], [-1, -1, -1]], dtype=np_module.float32),
        )
        sharpened = np_module.clip(sharpened, 0, 255).astype(np_module.uint8)
        sauvola_sharp = _apply_sauvola_threshold(sharpened, cv2_module, np_module, window_size=41, k=0.20)

        if scan_mode == "fast":
            variants = [
                ("sauvola_ch",      _finalize(sauvola_ch, scale=2.2)),
                ("sauvola",         _finalize(sauvola, scale=2.2)),
                ("adaptive_loose_ch", _finalize(
                    cv2_module.adaptiveThreshold(
                        gray_ch_denoised, 255, cv2_module.ADAPTIVE_THRESH_GAUSSIAN_C,
                        cv2_module.THRESH_BINARY, 31, 12,
                    ), scale=2.2)),
                ("denoised",        _finalize(gray_denoised, scale=2.0)),
            ]

        elif scan_mode == "balanced":
            variants = [
                ("sauvola",         _finalize(sauvola, scale=2.5)),
                ("sauvola_ch",      _finalize(sauvola_ch, scale=2.5)),
                ("adaptive_tight",  _finalize(adaptive_tight, scale=2.5)),
                ("otsu",            _finalize(otsu, scale=2.5)),
                ("sauvola_morph",   _finalize(sauvola_morph, scale=2.5)),
                ("adaptive_loose_ch", _finalize(
                    cv2_module.adaptiveThreshold(
                        gray_ch_denoised, 255, cv2_module.ADAPTIVE_THRESH_GAUSSIAN_C,
                        cv2_module.THRESH_BINARY, 31, 12,
                    ), scale=2.5)),
            ]

        else:
            gray_form_clean = _remove_form_lines(gray_deskewed, cv2_module, np_module)
            gray_fc_clahe = _apply_clahe(gray_form_clean, cv2_module, clip_limit=1.5)
            gray_fc_denoised = cv2_module.fastNlMeansDenoising(gray_fc_clahe, h=8)
            sauvola_fc = _apply_sauvola_threshold(
                gray_fc_denoised, cv2_module, np_module, window_size=41, k=0.20
            )
            adaptive_fc = cv2_module.adaptiveThreshold(
                gray_fc_denoised, 255, cv2_module.ADAPTIVE_THRESH_GAUSSIAN_C,
                cv2_module.THRESH_BINARY, 31, 11,
            )

            variants = [
                ("sauvola_fc",      _finalize(sauvola_fc, scale=3.0)),
                ("adaptive_fc",     _finalize(adaptive_fc, scale=3.0)),
                ("sauvola_sharp",   _finalize(sauvola_sharp, scale=3.0)),
                ("sauvola",         _finalize(sauvola, scale=3.0)),
                ("adaptive_tight",  _finalize(adaptive_tight, scale=3.0)),
                ("sauvola_ch",      _finalize(sauvola_ch, scale=2.5)),
                ("otsu",            _finalize(otsu, scale=2.5)),
                ("sauvola_morph",   _finalize(sauvola_morph, scale=2.5)),
            ]

    except Exception:
        pass

    if not variants:
        try:
            from PIL import Image
            raw = pil_module.fromarray(np_module.array(image_rgb)).convert("L")
            variants = [("fallback_raw", raw)]
        except Exception:
            pass

    return variants


# ─────────────────────────────────────────────────────────────────────────────
#  EasyOCR-only runner
# ─────────────────────────────────────────────────────────────────────────────

def _run_easyocr(image_path: str, document_type_hint: str = "", requested_mode: str = "") -> Dict[str, Any]:
    try:
        from PIL import Image
        import cv2
        import numpy as np
    except Exception as exc:
        raise RuntimeError(
            "Missing EasyOCR runtime dependencies. Install pillow, opencv-python-headless, and numpy."
        ) from exc

    reader = _get_easyocr_reader()
    image = Image.open(image_path).convert("RGB")
    scan_mode = _resolve_scan_mode(
        requested_mode or os.environ.get("OCR_PYTHON_SCAN_MODE", "auto"),
        document_type_hint,
    )

    upscale_map = {"fast": 2.2, "balanced": 2.5, "handwritten": 3.0}
    upscale_factor = upscale_map.get(scan_mode, 2.5)
    image_variants = _build_ocr_variants(image, cv2, np, Image, scan_mode, upscale_factor)

    image_width = max(1, int(image.width))
    image_height = max(1, int(image.height))

    def _rescale_tokens(tokens: List[Dict[str, Any]], sx: float, sy: float, pad_x: int, pad_y: int) -> List[Dict[str, Any]]:
        scaled: List[Dict[str, Any]] = []
        for t in tokens:
            raw_x = float(t.get("x", 0)) - pad_x
            raw_y = float(t.get("y", 0)) - pad_y
            x = max(0, int(round(raw_x * sx)))
            y = max(0, int(round(raw_y * sy)))
            w = max(0, int(round(float(t.get("width", 0)) * sx)))
            h = max(0, int(round(float(t.get("height", 0)) * sy)))
            polygon = t.get("polygon") or []
            scaled_poly = [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]
            if isinstance(polygon, list) and len(polygon) == 4:
                try:
                    scaled_poly = [
                        [max(0, int(round((float(p[0]) - pad_x) * sx))), max(0, int(round((float(p[1]) - pad_y) * sy)))]
                        for p in polygon
                    ]
                except Exception:
                    pass
            scaled.append({**t, "x": x, "y": y, "width": w, "height": h, "polygon": scaled_poly})
        return scaled

    def _read_variant(variant_img: Any) -> tuple[str, List[Dict[str, Any]], float]:
        arr = np.array(variant_img)
        detections = reader.readtext(arr, detail=1, paragraph=False)
        tokens: List[Dict[str, Any]] = []
        words: List[str] = []
        confidences: List[float] = []
        for item in detections:
            try:
                bbox, text, conf = item
            except Exception:
                continue
            word = str(text or "").strip()
            if not word:
                continue
            xs = [int(round(float(p[0]))) for p in bbox]
            ys = [int(round(float(p[1]))) for p in bbox]
            x = max(0, min(xs))
            y = max(0, min(ys))
            w = max(0, max(xs) - x)
            h = max(0, max(ys) - y)
            confidence = max(0.0, min(float(conf), 1.0))
            tokens.append({
                "word": word,
                "confidence": round(confidence, 4),
                "x": x,
                "y": y,
                "width": w,
                "height": h,
                "polygon": [[int(round(float(p[0]))), int(round(float(p[1])))] for p in bbox[:4]],
            })
            words.append(word)
            confidences.append(confidence)

        joined_text = "\n".join(words)
        confidence_score = (sum(confidences) / len(confidences)) if confidences else 0.0
        return joined_text, tokens, confidence_score

    best_text = ""
    best_tokens: List[Dict[str, Any]] = []
    best_score = -1.0
    failures: List[str] = []
    started_at = time.perf_counter()

    for variant_name, variant_img in image_variants:
        try:
            text, tokens, mean_conf = _read_variant(variant_img)
        except Exception as exc:
            failures.append(f"{variant_name}: {exc}")
            continue

        variant_w = max(1, int(getattr(variant_img, "width", image_width) or image_width))
        variant_h = max(1, int(getattr(variant_img, "height", image_height) or image_height))
        pad = _BORDER_PAD
        sx = image_width / max(1, variant_w - 2 * pad)
        sy = image_height / max(1, variant_h - 2 * pad)
        normalized_tokens = _rescale_tokens(tokens, sx, sy, pad_x=pad, pad_y=pad)

        compact = "".join(ch for ch in text if not ch.isspace())
        token_bonus = min(len(normalized_tokens) / 120.0, 1.0)
        text_bonus = min(len(compact) / 900.0, 1.0)
        score = (mean_conf * 0.72) + (token_bonus * 0.18) + (text_bonus * 0.10)

        if score > best_score:
            best_score = score
            best_text = text
            best_tokens = normalized_tokens

    if best_score < 0:
        hint = "; ".join(failures[:3]) if failures else "unknown error"
        raise RuntimeError(f"EasyOCR failed for all image variants ({hint})")

    best_text = _fix_text_ocr_artifacts(best_text)
    for tok in best_tokens:
        tok["word"] = _fix_text_ocr_artifacts(str(tok.get("word", "")))

    elapsed_total_ms = int(round((time.perf_counter() - started_at) * 1000.0))
    warnings: List[str] = []
    if best_score < 0.28:
        warnings.append("OCR quality is low; verify extracted fields manually.")
    if scan_mode != "fast":
        warnings.append(f"EasyOCR scan mode: {scan_mode}.")
    if failures:
        warnings.append(f"Some EasyOCR variant passes failed ({len(failures)}); best valid pass was used.")
    warnings.append(f"EasyOCR processing time: {elapsed_total_ms}ms.")

    return {
        "ok": True,
        "text": best_text,
        "tokens": best_tokens,
        "warnings": warnings,
    }


# ─────────────────────────────────────────────────────────────────────────────
#  Entry points
# ─────────────────────────────────────────────────────────────────────────────

def main() -> int:
    if len(sys.argv) >= 2 and sys.argv[1] == "--server":
        return _run_server()
    if len(sys.argv) < 2:
        _json_error("Usage: ocr_worker.py <image_path> [document_type_hint] [mode]")
        return 1
    image_path = sys.argv[1]
    document_type_hint = sys.argv[2] if len(sys.argv) >= 3 else ""
    requested_mode = sys.argv[3] if len(sys.argv) >= 4 else ""
    if not os.path.isfile(image_path):
        _json_error("Image file does not exist", {"path": image_path})
        return 1
    try:
        result = _run_easyocr(image_path, document_type_hint=document_type_hint, requested_mode=requested_mode)
        print(json.dumps(result, ensure_ascii=False))
        return 0
    except Exception as exc:
        _json_error(str(exc))
        return 1


def _run_server() -> int:
    for raw_line in sys.stdin:
        line = (raw_line or "").strip()
        if not line:
            continue
        request_id = ""
        try:
            payload = json.loads(line)
            request_id = str(payload.get("id", ""))
            image_path = str(payload.get("image_path", ""))
            document_type_hint = str(payload.get("document_type_hint", ""))
            requested_mode = str(payload.get("requested_mode", ""))
            if not image_path:
                raise ValueError("Missing image_path")
            if not os.path.isfile(image_path):
                raise ValueError(f"Image file does not exist: {image_path}")
            result = _run_easyocr(
                image_path,
                document_type_hint=document_type_hint,
                requested_mode=requested_mode,
            )
            response = {"id": request_id, "ok": True, "result": result}
        except Exception as exc:
            response = {"id": request_id, "ok": False, "error": str(exc)}
        print(json.dumps(response, ensure_ascii=False), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())