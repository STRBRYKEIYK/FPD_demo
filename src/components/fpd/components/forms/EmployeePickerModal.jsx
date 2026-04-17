import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../../../contexts/AuthContext";
import { useToast } from "../../hooks/useToast";
import { X, Calendar, Loader2, ZoomIn } from "lucide-react";

const getInitials = (name = "") =>
  (name || "").split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase() || "??";

const AVATAR_COLORS = [
  "from-violet-500 to-indigo-600", "from-blue-500 to-cyan-600",
  "from-emerald-500 to-teal-600",  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",     "from-fuchsia-500 to-purple-600",
  "from-sky-500 to-blue-600",      "from-lime-500 to-green-600",
];
const avatarGradient = (name = "") => {
  let h = 0;
  for (const c of name) h = c.charCodeAt(0) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
};

const fmtCurrency = (v) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2 }).format(v || 0);

const fmtTime = (dt) => {
  if (!dt || dt === "00:00:00" || dt.includes("00:00:00")) return "—";
  const t = dt.includes(" ") ? dt.split(" ")[1] : dt;
  return t ? t.substring(0, 5) : "—";
};

const fmtLastFirst = (name = "") => {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  const last = parts[parts.length - 1];
  const rest = parts.slice(0, parts.length - 1).join(" ");
  return `${last}, ${rest}`;
};

// ── Full-panel profile photo for left sidebar ────────────────────────────────
function ProfilePhotoPanel({ uid, name, apiService, dm, onExpand }) {
  const [imgUrl, setImgUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const { showWarning } = useToast();
  const gradient = avatarGradient(name || "");
  const initials = getInitials(name);

  useEffect(() => {
    let cancelled = false, blobUrlRef = null;
    setImgUrl(null); setLoading(true);
    if (!uid || !apiService?.profiles) { setLoading(false); return; }
    apiService.profiles.getProfileByUid(uid)
      .then((res) => {
        if (cancelled) return;
        if (res?.success && res?.url) { blobUrlRef = res.url; setImgUrl(res.url); }
      })
      .catch((err) => {
        console.error('getProfileByUid failed', err);
        showWarning?.('Failed to load profile image');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; if (blobUrlRef) { try { URL.revokeObjectURL(blobUrlRef); } catch (err) { console.error('revokeObjectURL failed', err); showWarning?.('Failed to clean up image resource'); } } };
  }, [uid, apiService]);

  return (
    <div
      className="w-full h-full relative cursor-pointer group"
      onClick={() => imgUrl && onExpand(imgUrl)}
    >
      {imgUrl ? (
        <>
          <img src={imgUrl} alt={initials} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" onError={() => setImgUrl(null)} />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex flex-col items-center justify-center gap-1">
            <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200 drop-shadow-lg" />
            <span className="text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200 drop-shadow-lg">Click to enlarge</span>
          </div>
        </>
      ) : (
        <div className={`w-full h-full bg-gradient-to-br ${gradient} flex flex-col items-center justify-center gap-2`}>
          {loading
            ? <Loader2 className="w-10 h-10 text-white/60 animate-spin" />
            : <>
                <span className="text-white font-bold text-5xl tracking-tight select-none">{initials}</span>
                <span className="text-white/50 text-xs">{name}</span>
              </>
          }
        </div>
      )}
    </div>
  );
}

// ── Lightbox ─────────────────────────────────────────────────────────────────
function ImageLightbox({ imgUrl, name, onClose }) {
  useEffect(() => {
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6" onClick={onClose}>
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" />
      <div className="relative max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-4 -right-4 z-10 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="rounded-3xl overflow-hidden shadow-2xl ring-1 ring-white/10">
          <img src={imgUrl} alt={name} className="w-full h-full object-cover" style={{ maxHeight: "70vh" }} />
        </div>
        <p className="text-center text-white/60 text-sm mt-3 font-medium">{fmtLastFirst(name)}</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function EmployeePickerModal({
  isOpen, onClose, record,
  attendanceData = [], loadingAttendance = false,
  apiService, isDarkMode: propIsDarkMode = false,
}) {
  const { isDarkMode: authIsDarkMode } = useAuth();
  const dm = typeof propIsDarkMode !== 'undefined' ? propIsDarkMode : authIsDarkMode;
  const leftRef  = useRef(null);
  const rightRef = useRef(null);
  const [lightboxUrl, setLightboxUrl] = useState(null);

  useEffect(() => {
    if (isOpen) { leftRef.current?.scrollTo(0,0); rightRef.current?.scrollTo(0,0); }
  }, [isOpen, record]);

  useEffect(() => {
    if (!isOpen) return;
    const h = (e) => { if (e.key === "Escape") { if (lightboxUrl) setLightboxUrl(null); else onClose(); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [isOpen, onClose, lightboxUrl]);

  if (!isOpen || !record) return null;

  const div = dm ? "border-gray-800" : "border-gray-100";
  const uid = record.employeeId || record.employeeUid || record.uid;

  const hasOT      = (record.hours?.overtime       || 0) > 0;
  const hasSunday  = (record.hours?.sunday          || 0) > 0;
  const hasHoliday = (record.hours?.regularHoliday  || 0) > 0 || (record.hours?.specialHoliday || 0) > 0;

  const totalAllowances =
    (record.allowances?.dailyAllowance         || 0) +
    (record.allowances?.managersAllowance      || 0) +
    (record.allowances?.otherAllowances        || 0) +
    (record.allowances?.payrollAdjustmentPlus  || 0) -
    (record.allowances?.payrollAdjustmentMinus || 0);

  const allowanceItems = [
    { label: "Daily Allowance",     value: record.allowances?.dailyAllowance       || 0 },
    { label: "Manager's Allowance", value: record.allowances?.managersAllowance    || 0 },
    { label: "Other Allowances",    value: record.allowances?.otherAllowances      || 0 },
    { label: "Adjustment (+)",      value: record.allowances?.payrollAdjustmentPlus || 0, positive: true },
    { label: "Adjustment (−)",      value: -(record.allowances?.payrollAdjustmentMinus || 0), negative: true },
  ].filter((i) => i.value !== 0);

  const deductionItems = [
    { label: "Pag-IBIG",      value: record.deductions?.pagibig     || 0 },
    { label: "Pag-IBIG Loan", value: record.deductions?.pagibigLoan || 0 },
    { label: "CA to JIC",     value: record.deductions?.caToJic     || 0 },
    { label: "CA to Jerome",  value: record.deductions?.caToJerome  || 0 },
    { label: "Water",         value: record.deductions?.water       || 0 },
    { label: "WSP",           value: record.deductions?.wsp         || 0 },
    { label: "Electricity",   value: record.deductions?.electricity || 0 },
  ].filter((i) => i.value > 0);

  const hoursBreakdown = [
    { label: "Regular",      value: record.hours?.regular,        pay: record.earnings?.regularPay,        color: "green",  mult: null    },
    { label: "Overtime",     value: record.hours?.overtime,       pay: record.earnings?.overtimePay,       color: "orange", mult: "×1.25" },
    { label: "Sunday",       value: record.hours?.sunday,         pay: record.earnings?.sundayPay,         color: "yellow", mult: "×1.3"  },
    { label: "Reg Holiday",  value: record.hours?.regularHoliday, pay: record.earnings?.regularHolidayPay, color: "red",    mult: "×1.0"  },
    { label: "Spec Holiday", value: record.hours?.specialHoliday, pay: record.earnings?.specialHolidayPay, color: "purple", mult: "×1.3"  },
  ];

  const sectionCard = `rounded-xl border ${dm ? "bg-stone-800/40 border-gray-700/60" : "bg-stone-50 border-gray-100"}`;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

        <div
          className={`relative w-full max-w-[98vw] h-[95vh] flex flex-col rounded-2xl border shadow-2xl
            ${dm ? "bg-stone-900 border-gray-800" : "bg-white border-gray-200"}`}
          style={{ boxShadow: dm ? "0 0 80px rgba(0,0,0,.8)" : "0 0 60px rgba(0,0,0,.2)" }}
        >
          {/* ── HEADER — name, badges, pay summary, close ───────────── */}
          <div className={`flex-shrink-0 px-5 py-3 border-b ${div} flex items-center justify-between gap-4`}>
            <div className="flex items-center gap-4 min-w-0 flex-1">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className={`text-base font-bold leading-tight ${dm ? "text-white" : "text-gray-900"}`}>
                    {fmtLastFirst(record.employeeName)}
                  </h2>
                  {hasOT      && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-500/15 text-orange-400">OT</span>}
                  {hasSunday  && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-500/15 text-yellow-500">SUN</span>}
                  {hasHoliday && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/15 text-red-400">HOL</span>}
                </div>
                <p className={`text-xs mt-0.5 ${dm ? "text-gray-400" : "text-gray-500"}`}>
                  ₱{(record.rate || 0).toFixed(2)}/hr · {(record.hours?.regular || 0).toFixed(1)} reg hrs
                </p>
              </div>
              {/* Pay summary */}
              <div className={`hidden md:flex items-center gap-5 pl-5 border-l ${div}`}>
                {[
                  { label: "Gross",   value: fmtCurrency(record.earnings?.grossPay), cls: dm ? "text-gray-100" : "text-gray-900" },
                  { label: "Deduct",  value: fmtCurrency(record.deductions?.total),  cls: "text-rose-400" },
                  { label: "Net Pay", value: fmtCurrency(record.netPay),             cls: "text-emerald-400" },
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-5">
                    {i > 0 && <div className={`w-px h-6 ${dm ? "bg-stone-700" : "bg-stone-200"}`} />}
                    <div>
                      <p className={`text-[11px] ${dm ? "text-gray-500" : "text-gray-400"}`}>{s.label}</p>
                      <p className={`text-sm font-bold ${s.cls}`}>{s.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={onClose}
              className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors
                ${dm ? "bg-stone-800 hover:bg-stone-700 text-gray-400" : "bg-stone-100 hover:bg-stone-200 text-gray-500"}`}>
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* ── TWO-COLUMN BODY ─────────────────────────────────────── */}
          <div className="flex-1 flex overflow-hidden min-h-0">

            {/* LEFT panel */}
            <div ref={leftRef}
              className={`w-72 flex-shrink-0 flex flex-col overflow-y-auto p-4 gap-3 border-r ${div}`}>

              {/* Profile photo — full width square, centered, clickable */}
              <div
                className={`${sectionCard} overflow-hidden`}
                style={{ aspectRatio: "1 / 1" }}
              >
                <ProfilePhotoPanel
                  uid={uid}
                  name={record.employeeName}
                  apiService={apiService}
                  dm={dm}
                  onExpand={setLightboxUrl}
                />
              </div>

              {/* KPIs */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Allowances", value: fmtCurrency(totalAllowances),          color: "blue"    },
                  { label: "Gross Pay",  value: fmtCurrency(record.earnings?.grossPay), color: "emerald" },
                  { label: "Deductions", value: fmtCurrency(record.deductions?.total),  color: "rose"    },
                  { label: "Net Pay",    value: fmtCurrency(record.netPay),             color: "violet"  },
                ].map((k) => (
                  <div key={k.label} className={`${sectionCard} px-3 py-2.5`}>
                    <p className={`text-[11px] mb-0.5 ${dm ? "text-gray-500" : "text-gray-400"}`}>{k.label}</p>
                    <p className={`font-bold text-sm text-${k.color}-500`}>{k.value}</p>
                  </div>
                ))}
              </div>

              {/* Hours */}
              <div className={`${sectionCard} overflow-hidden`}>
                <p className={`text-[11px] font-bold uppercase tracking-wider px-3 pt-3 pb-2 ${dm ? "text-gray-500" : "text-gray-400"}`}>
                  ⏱ Hours Breakdown
                </p>
                {hoursBreakdown.map((h, i) => (
                  <div key={h.label}
                    className={`flex items-center justify-between px-3 py-2
                      ${i < hoursBreakdown.length - 1 ? `border-b ${dm ? "border-gray-700/50" : "border-gray-100"}` : ""}
                      ${(h.value || 0) === 0 ? "opacity-35" : ""}`}>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs ${dm ? "text-gray-300" : "text-gray-600"}`}>{h.label}</span>
                      {h.mult && (h.value || 0) > 0 &&
                        <span className={`text-[10px] font-semibold text-${h.color}-400`}>{h.mult}</span>}
                    </div>
                    <div className="text-right">
                      <span className={`text-sm font-bold text-${h.color}-500`}>{(h.value || 0).toFixed(1)}h</span>
                      {(h.value || 0) > 0 &&
                        <span className={`block text-[11px] text-${h.color}-400 leading-tight`}>{fmtCurrency(h.pay)}</span>}
                    </div>
                  </div>
                ))}
              </div>

              {/* Allowances */}
              <div className={`${sectionCard} px-3 py-3`}>
                <p className="text-[11px] font-bold uppercase tracking-wider mb-2 text-blue-500">💰 Allowances</p>
                {allowanceItems.length === 0
                  ? <p className={`text-xs ${dm ? "text-gray-600" : "text-gray-400"}`}>None this period.</p>
                  : <div className="space-y-1.5">
                      {allowanceItems.map((i) => (
                        <div key={i.label} className="flex justify-between gap-2">
                          <span className={`text-xs truncate ${dm ? "text-gray-400" : "text-gray-500"}`}>{i.label}</span>
                          <span className={`text-xs font-semibold whitespace-nowrap ${i.positive ? "text-emerald-500" : i.negative ? "text-rose-500" : dm ? "text-gray-200" : "text-gray-800"}`}>
                            {fmtCurrency(Math.abs(i.value))}
                          </span>
                        </div>
                      ))}
                    </div>
                }
              </div>

              {/* Deductions */}
              <div className={`${sectionCard} px-3 py-3`}>
                <p className="text-[11px] font-bold uppercase tracking-wider mb-2 text-rose-500">📋 Deductions</p>
                {deductionItems.length === 0
                  ? <p className={`text-xs ${dm ? "text-gray-600" : "text-gray-400"}`}>None this period.</p>
                  : <div className="space-y-1.5">
                      {deductionItems.map((i) => (
                        <div key={i.label} className="flex justify-between gap-2">
                          <span className={`text-xs truncate ${dm ? "text-gray-400" : "text-gray-500"}`}>{i.label}</span>
                          <span className="text-xs font-semibold text-rose-500 whitespace-nowrap">-{fmtCurrency(i.value)}</span>
                        </div>
                      ))}
                      <div className={`flex justify-between font-bold pt-2 mt-1 border-t text-sm ${dm ? "border-gray-700" : "border-gray-100"}`}>
                        <span>Total</span>
                        <span className="text-rose-500">-{fmtCurrency(record.deductions?.total)}</span>
                      </div>
                    </div>
                }
              </div>
            </div>

            {/* RIGHT — attendance table fills all remaining space */}
            <div ref={rightRef} className="flex-1 flex flex-col overflow-hidden min-w-0 p-4">
              <div className={`flex-1 rounded-xl border flex flex-col overflow-hidden min-h-0 ${dm ? "border-gray-700" : "border-gray-200"}`}>
                <div className={`flex-shrink-0 px-4 py-2.5 border-b flex items-center gap-2
                  ${dm ? "bg-stone-800/80 border-gray-700" : "bg-stone-50 border-gray-200"}`}>
                  <Calendar className="w-4 h-4 text-blue-500" />
                  <h4 className={`text-xs font-bold uppercase tracking-wider ${dm ? "text-gray-300" : "text-gray-600"}`}>
                    📅 Daily Attendance
                  </h4>
                </div>

                {loadingAttendance ? (
                  <div className="flex-1 flex items-center justify-center gap-3">
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <span className={`text-sm ${dm ? "text-gray-400" : "text-gray-500"}`}>Loading attendance…</span>
                  </div>
                ) : attendanceData.length === 0 ? (
                  <div className={`flex-1 flex items-center justify-center text-sm ${dm ? "text-gray-500" : "text-gray-400"}`}>
                    No attendance records found.
                  </div>
                ) : (
                  <div className="flex-1 overflow-auto min-h-0">
                    <table className="w-full text-xs border-collapse">
                      <thead className={`sticky top-0 z-10 ${dm ? "bg-stone-800" : "bg-stone-50"}`}>
                        <tr>
                          {["Date","AM In","AM Out","PM In","PM Out","Eve In","Eve Out","Reg","Sun","OT","Reg Hol","Spec Hol","Remarks"].map((h) => (
                            <th key={h} className={`px-3 py-2.5 text-left font-semibold whitespace-nowrap text-xs
                              ${dm ? "text-gray-400 border-b border-gray-700" : "text-gray-500 border-b border-gray-200"}`}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {attendanceData.map((day, idx) => {
                          let rowBg = "";
                          const rem = (day.remarks || "").toUpperCase();
                          if (rem.includes("ABSENT") || rem.includes("LATE"))    rowBg = dm ? "bg-red-900/20"    : "bg-red-50";
                          else if (rem.includes("VL") || rem.includes("SL"))     rowBg = dm ? "bg-yellow-900/20" : "bg-yellow-50";
                          else if (day.is_regular_holiday)                        rowBg = dm ? "bg-orange-900/20" : "bg-orange-50";
                          else if (day.is_special_holiday)                        rowBg = dm ? "bg-purple-900/20" : "bg-purple-50";
                          else if (day.is_sunday && day.sunday_hours > 0)         rowBg = dm ? "bg-yellow-900/10" : "bg-yellow-50";

                          return (
                            <tr key={idx} className={`${rowBg} ${dm ? "border-b border-gray-800 hover:bg-stone-800/50" : "border-b border-gray-50 hover:bg-gray-50/30"} transition-colors`}>
                              <td className={`px-3 py-2 font-medium whitespace-nowrap ${dm ? "text-gray-300" : "text-gray-700"}`}>
                                {day.date}{day.is_sunday ? " ☀️" : ""}
                              </td>
                              {[day.morning_in, day.morning_out, day.afternoon_in, day.afternoon_out, day.evening_in, day.evening_out].map((t, ti) => (
                                <td key={ti} className={`px-3 py-2 whitespace-nowrap ${dm ? "text-gray-400" : "text-gray-500"}`}>{fmtTime(t)}</td>
                              ))}
                              <td className={`px-3 py-2 font-semibold ${(day.regular_hours        ||0)>0 ? "text-green-500"  : dm ? "text-gray-700" : "text-gray-300"}`}>{(day.regular_hours        ||0).toFixed(2)}</td>
                              <td className={`px-3 py-2 font-semibold ${(day.sunday_hours         ||0)>0 ? "text-yellow-500" : dm ? "text-gray-700" : "text-gray-300"}`}>{day.sunday_hours            ? day.sunday_hours.toFixed(2) : "—"}</td>
                              <td className={`px-3 py-2 font-semibold ${(day.overtime_hours       ||0)>0 ? "text-orange-500" : dm ? "text-gray-700" : "text-gray-300"}`}>{(day.overtime_hours         ||0).toFixed(2)}</td>
                              <td className={`px-3 py-2 font-semibold ${(day.regular_holiday_hours||0)>0 ? "text-red-500"   : dm ? "text-gray-700" : "text-gray-300"}`}>{(day.regular_holiday_hours  ||0).toFixed(2)}</td>
                              <td className={`px-3 py-2 font-semibold ${(day.special_holiday_hours||0)>0 ? "text-purple-500": dm ? "text-gray-700" : "text-gray-300"}`}>{(day.special_holiday_hours  ||0).toFixed(2)}</td>
                              <td className={`px-3 py-2 max-w-[200px] truncate ${dm ? "text-gray-400" : "text-gray-500"}`} title={day.remarks || ""}>{day.remarks || "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── FOOTER ──────────────────────────────────────────────── */}
          <div className={`flex-shrink-0 px-5 py-3 border-t ${div}`}>
            <button onClick={onClose}
              className={`w-full py-2 rounded-xl text-sm font-semibold transition-colors
                ${dm ? "bg-stone-800 hover:bg-stone-700 text-gray-300" : "bg-stone-100 hover:bg-stone-200 text-gray-700"}`}>
              Close
            </button>
          </div>
        </div>
      </div>

      {/* ── LIGHTBOX ────────────────────────────────────────────────── */}
      {lightboxUrl && (
        <ImageLightbox
          imgUrl={lightboxUrl}
          name={record.employeeName}
          onClose={() => setLightboxUrl(null)}
        />
      )}
    </>
  );
}