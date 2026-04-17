import { useState, useEffect } from 'react';
import { useAuth } from "../../../contexts/AuthContext";
import { useToast } from "../hooks/useToast";
import ConfirmDialog from "../components/main_ui/ConfirmDialog";
import { ToastContainer } from "../components/main_ui/Toast";
import {
  CheckCircle, Clock, TrendingUp, Users,
  Calendar, Search, ArrowUpDown, Download, ChevronLeft, ChevronRight, Loader2,
  FileSpreadsheet, CalendarRange, FolderOpen
} from 'lucide-react';
import EmployeePickerModal from '../components/forms/EmployeePickerModal';

// ── Card avatar ───────────────────────────────────────────────────────────────
function CardAvatar({ uid, name, apiService, showWarning }) {
  const [imgUrl, setImgUrl] = useState(null);
  const [loading, setLoading] = useState(true);

  const COLORS = ['bg-violet-500', 'bg-gray-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-cyan-500', 'bg-fuchsia-500', 'bg-indigo-500'];
  let hash = 0;
  for (const c of (name || '')) hash = c.charCodeAt(0) + ((hash << 5) - hash);
  const bg = COLORS[Math.abs(hash) % COLORS.length];
  const initials = (name || '').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || '??';

  useEffect(() => {
    let cancelled = false, blobUrlRef = null;
    setImgUrl(null); setLoading(true);
    if (!uid || !apiService?.profiles) { setLoading(false); return; }
    apiService.profiles.getProfileByUid(uid)
      .then(res => {
        if (cancelled) return;
        if (res?.success && res?.url) { blobUrlRef = res.url; setImgUrl(res.url); }
      })
      .catch((err) => {
        console.error('getProfileByUid failed', err);
        showWarning?.('Failed to load avatar');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; if (blobUrlRef) { try { URL.revokeObjectURL(blobUrlRef); } catch (err) { console.error('revokeObjectURL failed', err); showWarning?.('Failed to clean up avatar resource'); } } };
  }, [uid, apiService, showWarning]);

  return (
    <div className={`w-11 h-11 rounded-xl flex-shrink-0 overflow-hidden ${!imgUrl ? bg : ''}`}>
      {imgUrl ? (
        <img src={imgUrl} alt={initials} className="w-full h-full object-cover" onError={() => setImgUrl(null)} />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          {loading
            ? <Loader2 className="w-4 h-4 text-white/60 animate-spin" />
            : <span className="text-white font-bold text-sm">{initials}</span>
          }
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
export default function PayrollMasterlist({ apiService, isDarkMode: propIsDarkMode, user: propUser }) {
  const { isDarkMode: authIsDarkMode, user: authUser } = useAuth();
  const isDarkMode = typeof propIsDarkMode !== 'undefined' ? propIsDarkMode : authIsDarkMode;
  const user = propUser ?? authUser;
  const { toasts, removeToast, showSuccess, showError, showWarning, showInfo } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState('asc');
  const [payrollRecords, setPayrollRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedCutoff, setSelectedCutoff] = useState(15);
  const [approving, setApproving] = useState(false);
  const [approveConfirmOpen, setApproveConfirmOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage] = useState(12);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);

  const [attendanceData, setAttendanceData] = useState({});
  const [loadingAttendance, setLoadingAttendance] = useState({});

  const [modalOpen, setModalOpen] = useState(false);
  const [modalRecord, setModalRecord] = useState(null);

  useEffect(() => {
    fetchPayrollData();
    const unsub = apiService.socket.subscribeToUpdates('payroll_approved', () => fetchPayrollData());
    return () => unsub?.();
  }, [selectedPeriod, selectedCutoff]);

  useEffect(() => { setCurrentPage(1); }, [selectedPeriod, selectedCutoff]);

  const fmtLastFirst = (name = '') => {
    const parts = name.trim().split(/\s+/);
    if (parts.length < 2) return name;
    const last = parts[parts.length - 1];
    const rest = parts.slice(0, parts.length - 1).join(' ');
    return `${last}, ${rest}`;
  };

  const fetchPayrollData = async () => {
    try {
      setLoading(true);
      const res = await apiService.payroll.getPayrollRecords({
        period: selectedPeriod,
        cutoff: selectedCutoff,
        // Remove status filter and to_approve — fetch all records
      });
      setPayrollRecords(res.data || []);
      await apiService.payroll.getPayrollSummary(selectedPeriod, selectedCutoff);
    } catch (err) {
      console.error('Error fetching payroll:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendanceForEmployee = async (employeeId) => {
    if (attendanceData[employeeId] || loadingAttendance[employeeId]) return;
    try {
      setLoadingAttendance(prev => ({ ...prev, [employeeId]: true }));
      const rec = payrollRecords.find(r => r.employeeId === employeeId);
      if (!rec) return;

      const dates = [];
      const cur = new Date(rec.cutoffStartDate);
      const end = new Date(rec.cutoffEndDate);
      while (cur <= end) { dates.push(cur.toISOString().split('T')[0]); cur.setDate(cur.getDate() + 1); }

      const res = await apiService.summary.getDailySummaryByDates({ employee_uid: employeeId, dates: dates.join(',') });
      const raw = res.data || [];

      const regHolDates = [], specHolDates = [];
      raw.forEach(s => {
        const r = (s.remarks || '').toUpperCase();
        if (r.includes('REGULAR HOLIDAY') || r.includes('REG HOLIDAY')) regHolDates.push(s.date);
        if (r.includes('SPECIAL HOLIDAY') || r.includes('SPEC HOLIDAY') || r.includes('SPC HOLIDAY')) specHolDates.push(s.date);
      });
      const notesMap = {};
      raw.forEach(s => { if (s.remarks?.trim()) notesMap[s.date] = s.remarks; });

      const processed = dates.map(date => {
        const s = raw.find(x => x.date === date);
        const isSun = new Date(date + 'T00:00:00').getDay() === 0;
        const isRegHol = regHolDates.includes(date);
        const isSpcHol = specHolDates.includes(date);

        if (s) {
          const dbReg = parseFloat(s.regular_hours || 0);
          const dbSun = parseFloat(s.sunday_hours || 0);
          const dbRHol = parseFloat(s.regular_holiday_hours || 0);
          const dbSHol = parseFloat(s.special_holiday_hours || 0);
          const dbOT = parseFloat(s.overtime_hours || 0);
          let finalReg = 0, finalSun = 0, finalRHol = 0, finalSHol = 0;
          if (isRegHol) finalRHol = dbRHol > 0 ? dbRHol : dbReg;
          else if (isSpcHol) finalSHol = dbSHol > 0 ? dbSHol : dbReg;
          else if (isSun) finalSun = dbSun > 0 ? dbSun : dbReg;
          else finalReg = dbReg;
          return {
            date, is_sunday: isSun, is_regular_holiday: isRegHol, is_special_holiday: isSpcHol,
            regular_hours: finalReg, sunday_hours: finalSun, overtime_hours: dbOT,
            regular_holiday_hours: finalRHol, special_holiday_hours: finalSHol,
            morning_in: s.morning_in, morning_out: s.morning_out,
            afternoon_in: s.afternoon_in, afternoon_out: s.afternoon_out,
            evening_in: s.evening_in, evening_out: s.evening_out,
            remarks: notesMap[date] || null,
          };
        }
        return {
          date, is_sunday: isSun, is_regular_holiday: isRegHol, is_special_holiday: isSpcHol,
          regular_hours: 0, sunday_hours: 0, overtime_hours: 0, regular_holiday_hours: 0, special_holiday_hours: 0,
          morning_in: null, morning_out: null, afternoon_in: null, afternoon_out: null,
          evening_in: null, evening_out: null, remarks: notesMap[date] || null,
        };
      });
      setAttendanceData(prev => ({ ...prev, [employeeId]: processed }));
    } catch (err) {
      console.error('Error fetching attendance:', err);
    } finally {
      setLoadingAttendance(prev => ({ ...prev, [employeeId]: false }));
    }
  };

  const handleCardClick = (record) => {
    setModalRecord(record);
    setModalOpen(true);
    fetchAttendanceForEmployee(record.employeeId);
  };

  const handleDownloadCurrent = async () => {
    try {
      const blob = await apiService.payroll.downloadPayrollTableExcel(selectedPeriod, selectedCutoff);
      apiService.payroll.downloadBlobAsFile(blob, `Payroll_${selectedPeriod}_Cutoff${selectedCutoff}.xlsx`);
    } catch (err) { showError?.('Failed to download: ' + (err?.message || 'Unknown error')); }
  };
  const handleDownloadWholeMonth = async (e) => {
    if (e) e.preventDefault();
    try {
      const blob = await apiService.payroll.downloadWholeMonthTableExcel(selectedPeriod);
      apiService.payroll.downloadBlobAsFile(blob, `Payroll_${selectedPeriod}_WholeMonth.xlsx`);
    } catch (err) { showError?.('Failed to download: ' + (err?.message || 'Unknown error')); }
  };

  const approvePayrollNow = async () => {
    if (approving) return;
    if (isApproved || payrollRecords[0]?.status === 'approved') { showWarning?.('This payroll has already been approved'); return; }
    if (!payrollRecords.length) { showWarning?.('No payroll records to approve'); return; }
    try {
      setApproving(true);
      const res = await apiService.payroll.approvePayroll(selectedPeriod, selectedCutoff, user?.name);
      showSuccess?.(res?.message || 'Payroll approved successfully!');
      await fetchPayrollData();
    } catch (err) {
      showError?.('Failed to approve payroll: ' + (err?.message || 'Unknown error'));
    }
    finally { setApproving(false); }
  };

  const handleApprovePayroll = async () => {
    if (isApproved) { showInfo?.('This payroll has already been approved'); return; }
    if (!payrollRecords.length) { showWarning?.('No payroll records to approve'); return; }
    if (payrollRecords[0]?.status === 'approved') { showInfo?.('This payroll has already been approved'); return; }
    setApproveConfirmOpen(true);
  };

  const getFiltered = () => {
    let list = payrollRecords;
    if (searchTerm.trim()) list = list.filter(r => r.employeeName.toLowerCase().includes(searchTerm.toLowerCase()));
    return [...list].sort((a, b) => {
      const na = fmtLastFirst(a.employeeName).toLowerCase();
      const nb = fmtLastFirst(b.employeeName).toLowerCase();
      return sortOrder === 'asc' ? na.localeCompare(nb) : nb.localeCompare(na);
    });
  };

  const fmtCurrency = (v) =>
    new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(v || 0);
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

  const getPeriodDisplay = () => {
    if (!payrollRecords.length) return '';
    const r = payrollRecords[0];
    return `${fmtDate(r.cutoffStartDate)} – ${fmtDate(r.cutoffEndDate)}`;
  };

  const calcTotals = (records) => records.reduce((t, r) => ({
    totalNetPay: t.totalNetPay + (r.netPay || 0),
    totalGrossPay: t.totalGrossPay + (r.earnings?.grossPay || 0),
    totalDeductions: t.totalDeductions + (r.deductions?.total || 0),
  }), { totalNetPay: 0, totalGrossPay: 0, totalDeductions: 0 });

  const filtered = getFiltered();
  const totalPages = Math.ceil(filtered.length / recordsPerPage);
  const paginated = filtered.slice((currentPage - 1) * recordsPerPage, currentPage * recordsPerPage);
  const grandTotals = calcTotals(filtered);
  const isApproved = payrollRecords.length > 0 && payrollRecords.every(r => r.status === 'approved');
  const dm = isDarkMode;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center space-y-4">
        <div className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center ${dm ? 'bg-stone-800' : 'bg-stone-100'}`}>
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-500 border-t-transparent" />
        </div>
        <p className={`text-sm font-medium ${dm ? 'text-gray-400' : 'text-gray-500'}`}>Loading payroll data…</p>
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen p-6 space-y-6 ${dm ? 'bg-stone-950 text-gray-100' : 'bg-slate-50 text-gray-900'}`}>

      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <ConfirmDialog
        isOpen={approveConfirmOpen}
        onClose={() => setApproveConfirmOpen(false)}
        onConfirm={approvePayrollNow}
        title="Approve Payroll"
        message={`Approve payroll for ${selectedPeriod} (Cutoff: ${selectedCutoff === 15 ? '1-15' : '16-30/31'})? This will approve ${payrollRecords.length} employee records.`}
        confirmText={approving ? 'Approving…' : 'Approve'}
        cancelText="Cancel"
        type="warning"
      />

      {/* ── HEADER ──────────────────────────────────────────────────────── */}
      <div className={`rounded-2xl p-6 border ${dm ? 'bg-stone-900 border-gray-800' : 'bg-white border-gray-100'} shadow-sm`}>
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              {/* Peso sign icon instead of DollarSign */}
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${dm ? 'bg-gray-500/20' : 'bg-gray-50'}`}>
                <span className="text-blue-500 font-black text-lg leading-none select-none">₱</span>
              </div>
              <div>
                {/* Heavy black font with clamp sizing, matching the HR page style */}
                <h1
                  className="font-black tracking-tight leading-none"
                  style={{ fontSize: 'clamp(1.25rem, 3vw, 2rem)' }}
                >
                  Payroll Masterlist
                </h1>
                <p className={`text-xs mt-0.5 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>JJC ENGINEERING WORKS & GENERAL SERVICES</p>
              </div>
            </div>
            {payrollRecords.length > 0 && (
              <div className="flex flex-wrap items-center gap-3">
                <div className={`flex items-center gap-2 flex-1 min-w-52 px-3 py-2 rounded-xl border ${dm ? 'bg-stone-900 border-gray-800' : 'bg-white border-gray-100'} shadow-sm`}>
                  <Search className={`w-4 h-4 flex-shrink-0 ${dm ? 'text-gray-500' : 'text-gray-400'}`} />
                  <input type="text" placeholder="Search employee…" value={searchTerm}
                    onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                    className="bg-transparent text-sm flex-1 outline-none placeholder-gray-400" />
                </div>

                <button onClick={() => setSortOrder(p => p === 'asc' ? 'desc' : 'asc')}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${dm ? 'bg-stone-900 border-gray-800 hover:bg-stone-800' : 'bg-white border-gray-100 hover:bg-stone-50'} shadow-sm`}>
                  <ArrowUpDown className="w-4 h-4" /> {sortOrder === 'asc' ? 'A → Z' : 'Z → A'}
                </button>

                {/* Export Excel — always visible when records exist */}
                <div className="relative">
                  <button onClick={() => setShowDownloadMenu(p => !p)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${dm ? 'bg-stone-900 border-gray-800 hover:bg-stone-800' : 'bg-white border-gray-100 hover:bg-stone-50'} shadow-sm`}>
                    <Download className="w-4 h-4 text-emerald-500" /> Export Excel
                  </button>
                  {showDownloadMenu && (
                    <div className={`absolute right-0 top-full mt-2 w-48 rounded-xl border shadow-lg z-20 overflow-hidden ${dm ? 'bg-stone-800 border-gray-700' : 'bg-white border-gray-100'}`}>
                      <button onClick={() => { handleDownloadCurrent(); setShowDownloadMenu(false); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-gray-500/10 transition-colors">
                        <FileSpreadsheet className="w-4 h-4 text-blue-500" /> Current Cutoff
                      </button>
                      <button onClick={e => { handleDownloadWholeMonth(e); setShowDownloadMenu(false); }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-violet-500/10 transition-colors">
                        <CalendarRange className="w-4 h-4 text-violet-500" /> Whole Month
                      </button>
                    </div>
                  )}
                </div>

                {/* Approve button — hidden once all records are approved */}
                {!isApproved && (
                  <button onClick={handleApprovePayroll} disabled={approving}
                    className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm
                    ${approving
                        ? 'bg-gray-500/50 text-white cursor-not-allowed'
                        : 'bg-gray-500 hover:bg-gray-600 text-white'
                      }`}>
                    {approving
                      ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Approving…</>
                      : <><CheckCircle className="w-4 h-4" /> Approve Payroll</>
                    }
                  </button>
                )}

                {/* Approved badge — shown when all records are approved */}
                {isApproved && (
                  <div className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold bg-emerald-500/15 text-emerald-500">
                    <CheckCircle className="w-4 h-4" /> All Approved
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${dm ? 'text-gray-400' : 'text-gray-500'}`}>PERIOD</label>
              <input type="month" value={selectedPeriod} onChange={e => setSelectedPeriod(e.target.value)}
                className={`px-3 py-2 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-blue-500 ${dm ? 'bg-stone-800 border-gray-700 text-gray-100' : 'bg-stone-50 border-gray-200 text-gray-900'}`} />
            </div>
            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${dm ? 'text-gray-400' : 'text-gray-500'}`}>CUTOFF</label>
              <select value={selectedCutoff} onChange={e => setSelectedCutoff(Number(e.target.value))}
                className={`px-3 py-2 rounded-xl text-sm border focus:outline-none focus:ring-2 focus:ring-blue-500 ${dm ? 'bg-stone-800 border-gray-700 text-gray-100' : 'bg-stone-50 border-gray-200 text-gray-900'}`}>
                <option value={15}>1st – 15th</option>
                <option value={30}>16th – 30th/31st</option>
              </select>
            </div>
          </div>
        </div>

        {/* KPI strip */}
        {payrollRecords.length > 0 && (
          <div className={`grid grid-cols-2 md:grid-cols-4 gap-3 mt-5 pt-5 border-t border-dashed ${dm ? 'border-gray-700' : 'border-gray-200'}`}>
            {[
              { label: 'Employees', value: filtered.length, icon: Users, color: 'blue' },
              { label: 'Total Net Pay', value: fmtCurrency(grandTotals.totalNetPay), icon: TrendingUp, color: 'emerald' },
              { label: 'Total Gross', value: fmtCurrency(grandTotals.totalGrossPay), icon: null, color: 'violet', peso: true },
              { label: 'Total Deductions', value: fmtCurrency(grandTotals.totalDeductions), icon: Clock, color: 'rose' },
            ].map(kpi => (
              <div key={kpi.label} className={`rounded-xl p-4 ${dm ? 'bg-stone-800/60' : 'bg-stone-50'}`}>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 bg-${kpi.color}-500/15`}>
                  {kpi.peso
                    ? <span className={`text-${kpi.color}-500 font-black text-base leading-none`}>₱</span>
                    : <kpi.icon className={`w-4 h-4 text-${kpi.color}-500`} />
                  }
                </div>
                <div className="text-lg font-bold">{kpi.value}</div>
                <div className={`text-xs ${dm ? 'text-gray-500' : 'text-gray-400'}`}>{kpi.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── TOOLBAR ─────────────────────────────────────────────────────── */}
      {payrollRecords.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <div className={`flex items-center gap-2 flex-1 min-w-52 px-3 py-2 rounded-xl border ${dm ? 'bg-stone-900 border-gray-800' : 'bg-white border-gray-100'} shadow-sm`}>
            <Search className={`w-4 h-4 flex-shrink-0 ${dm ? 'text-gray-500' : 'text-gray-400'}`} />
            <input type="text" placeholder="Search employee…" value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="bg-transparent text-sm flex-1 outline-none placeholder-gray-400" />
          </div>

          <button onClick={() => setSortOrder(p => p === 'asc' ? 'desc' : 'asc')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${dm ? 'bg-stone-900 border-gray-800 hover:bg-stone-800' : 'bg-white border-gray-100 hover:bg-stone-50'} shadow-sm`}>
            <ArrowUpDown className="w-4 h-4" /> {sortOrder === 'asc' ? 'A → Z' : 'Z → A'}
          </button>

          <div className="relative">
            <button onClick={() => setShowDownloadMenu(p => !p)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${dm ? 'bg-stone-900 border-gray-800 hover:bg-stone-800' : 'bg-white border-gray-100 hover:bg-stone-50'} shadow-sm`}>
              <Download className="w-4 h-4 text-emerald-500" /> Export Excel
            </button>
            {showDownloadMenu && (
              <div className={`absolute right-0 top-full mt-2 w-48 rounded-xl border shadow-lg z-20 overflow-hidden ${dm ? 'bg-stone-800 border-gray-700' : 'bg-white border-gray-100'}`}>
                <button onClick={() => { handleDownloadCurrent(); setShowDownloadMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-gray-500/10 transition-colors">
                  <FileSpreadsheet className="w-4 h-4 text-blue-500" /> Current Cutoff
                </button>
                <button onClick={e => { handleDownloadWholeMonth(e); setShowDownloadMenu(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-sm hover:bg-violet-500/10 transition-colors">
                  <CalendarRange className="w-4 h-4 text-violet-500" /> Whole Month
                </button>
              </div>
            )}
          </div>

          <button onClick={handleApprovePayroll} disabled={approving || isApproved}
            className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm
              ${isApproved ? 'bg-emerald-500/20 text-emerald-500 cursor-not-allowed'
                : approving ? 'bg-gray-500/50 text-white cursor-not-allowed'
                  : 'bg-gray-500 hover:bg-gray-600 text-white'}`}>
            {approving
              ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Approving…</>
              : isApproved ? <><CheckCircle className="w-4 h-4" /> Approved</>
                : <><CheckCircle className="w-4 h-4" /> Approve Payroll</>
            }
          </button>
        </div>
      )}

      {/* ── EMPLOYEE CARDS ───────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className={`rounded-2xl p-16 text-center border ${dm ? 'bg-stone-900 border-gray-800' : 'bg-white border-gray-100'}`}>
          <div className={`w-16 h-16 mx-auto mb-3 rounded-2xl flex items-center justify-center ${dm ? 'bg-stone-800' : 'bg-stone-100'}`}>
            <FolderOpen className={`w-8 h-8 ${dm ? 'text-gray-400' : 'text-gray-500'}`} />
          </div>
          <p className="font-semibold">No payroll records found</p>
          <p className={`text-sm mt-1 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
            {searchTerm ? `No employees match "${searchTerm}"` : 'Select a different period or cutoff.'}
          </p>
          {searchTerm && <button onClick={() => setSearchTerm('')} className="mt-3 text-sm text-blue-500 hover:underline">Clear search</button>}
        </div>
      ) : (
        <>
          <div className={`text-xs font-semibold px-1 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
            SHOWING {(currentPage - 1) * recordsPerPage + 1}–{Math.min(currentPage * recordsPerPage, filtered.length)} OF {filtered.length} EMPLOYEES
          </div>

          <div className="space-y-3">
            {paginated.map((record) => {
              const hasOT = (record.hours?.overtime || 0) > 0;
              const hasSunday = (record.hours?.sunday || 0) > 0;
              const hasHoliday = (record.hours?.regularHoliday || 0) > 0 || (record.hours?.specialHoliday || 0) > 0;
              const uid = record.employeeId || record.employeeUid;

              return (
                <div
                  key={record.id}
                  onClick={() => handleCardClick(record)}
                  className={`rounded-2xl border overflow-hidden transition-all cursor-pointer group
                    ${dm
                      ? 'bg-stone-900 border-gray-800 hover:border-gray-600 hover:bg-stone-800/60'
                      : 'bg-white border-gray-100 hover:border-gray-300 hover:shadow-md'
                    } shadow-sm`}
                >
                  <div className="p-4">
                    <div className="flex items-center gap-4">
                      <CardAvatar uid={uid} name={record.employeeName} apiService={apiService} showWarning={showWarning} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-semibold truncate transition-colors ${dm ? 'group-hover:text-blue-400' : 'group-hover:text-blue-600'}`}>
                            {fmtLastFirst(record.employeeName)}
                          </span>
                          {hasOT && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-500/15 text-orange-500">OT</span>}
                          {hasSunday && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/15 text-yellow-600">SUN</span>}
                          {hasHoliday && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/15 text-red-500">HOL</span>}
                        </div>
                        <p className={`text-xs mt-0.5 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>
                          ₱{(record.rate || 0).toFixed(2)}/hr · {(record.hours?.regular || 0).toFixed(1)} reg hrs
                        </p>
                      </div>

                      <div className="hidden lg:flex items-center gap-6 text-center">
                        <div>
                          <div className={`text-xs mb-0.5 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>Gross Pay</div>
                          <div className="text-sm font-semibold">{fmtCurrency(record.earnings?.grossPay)}</div>
                        </div>
                        <div className={`w-px h-8 ${dm ? 'bg-stone-800' : 'bg-stone-100'}`} />
                        <div>
                          <div className={`text-xs mb-0.5 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>Deductions</div>
                          <div className="text-sm font-semibold text-rose-500">-{fmtCurrency(record.deductions?.total)}</div>
                        </div>
                        <div className={`w-px h-8 ${dm ? 'bg-stone-800' : 'bg-stone-100'}`} />
                        <div>
                          <div className={`text-xs mb-0.5 ${dm ? 'text-gray-500' : 'text-gray-400'}`}>Net Pay</div>
                          <div className="text-base font-bold text-emerald-500">{fmtCurrency(record.netPay)}</div>
                        </div>
                      </div>

                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors
                        ${dm ? 'bg-stone-800 group-hover:bg-stone-700' : 'bg-stone-50 group-hover:bg-stone-100'}`}>
                        <svg className={`w-4 h-4 transition-colors ${dm ? 'text-gray-500 group-hover:text-blue-400' : 'text-gray-400 group-hover:text-blue-500'}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    </div>

                    <div className={`flex lg:hidden items-center justify-between mt-3 pt-3 border-t border-dashed ${dm ? 'border-gray-800' : 'border-gray-100'}`}>
                      <div className="text-center">
                        <div className={`text-xs ${dm ? 'text-gray-500' : 'text-gray-400'}`}>Gross</div>
                        <div className="text-sm font-semibold">{fmtCurrency(record.earnings?.grossPay)}</div>
                      </div>
                      <div className="text-center">
                        <div className={`text-xs ${dm ? 'text-gray-500' : 'text-gray-400'}`}>Deductions</div>
                        <div className="text-sm font-semibold text-rose-500">-{fmtCurrency(record.deductions?.total)}</div>
                      </div>
                      <div className="text-center">
                        <div className={`text-xs ${dm ? 'text-gray-500' : 'text-gray-400'}`}>Net Pay</div>
                        <div className="text-base font-bold text-emerald-500">{fmtCurrency(record.netPay)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className={`flex items-center justify-between rounded-2xl p-4 border ${dm ? 'bg-stone-900 border-gray-800' : 'bg-white border-gray-100'} shadow-sm`}>
              <span className={`text-sm ${dm ? 'text-gray-500' : 'text-gray-400'}`}>Page {currentPage} of {totalPages}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${currentPage === 1 ? 'opacity-30 cursor-not-allowed' : dm ? 'bg-stone-800 hover:bg-stone-700' : 'bg-stone-100 hover:bg-stone-200'}`}>First</button>
                <button onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1}
                  className={`p-1.5 rounded-lg transition-colors ${currentPage === 1 ? 'opacity-30 cursor-not-allowed' : dm ? 'bg-stone-800 hover:bg-stone-700' : 'bg-stone-100 hover:bg-stone-200'}`}>
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const page = Math.max(1, Math.min(currentPage - 2, totalPages - 4)) + i;
                  return (
                    <button key={page} onClick={() => setCurrentPage(page)}
                      className={`w-8 h-8 rounded-lg text-xs font-semibold transition-colors ${page === currentPage ? 'bg-gray-500 text-white' : dm ? 'bg-stone-800 hover:bg-stone-700' : 'bg-stone-100 hover:bg-stone-200'}`}>
                      {page}
                    </button>
                  );
                })}
                <button onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages}
                  className={`p-1.5 rounded-lg transition-colors ${currentPage === totalPages ? 'opacity-30 cursor-not-allowed' : dm ? 'bg-stone-800 hover:bg-stone-700' : 'bg-stone-100 hover:bg-stone-200'}`}>
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${currentPage === totalPages ? 'opacity-30 cursor-not-allowed' : dm ? 'bg-stone-800 hover:bg-stone-700' : 'bg-stone-100 hover:bg-stone-200'}`}>Last</button>
              </div>
            </div>
          )}
        </>
      )}

      <EmployeePickerModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        record={modalRecord}
        attendanceData={modalRecord ? (attendanceData[modalRecord.employeeId] || []) : []}
        loadingAttendance={modalRecord ? (!!loadingAttendance[modalRecord.employeeId]) : false}
        apiService={apiService}
        isDarkMode={isDarkMode}
      />
    </div>
  );
}
