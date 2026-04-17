import React, { useEffect, useRef, useState } from 'react';
import { X, Plus, Trash2, Save, Wallet, ChevronDown, ChevronRight, Upload, Loader2 } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import apiService from '../../../../utils/api/api-service';
import { ToastContainer } from '../main_ui/Toast';
import { useToast } from '../../hooks/useToast';

function proofDocumentsJsonToText(value) {
  if (value == null || value === '') return '';

  let parsed = value;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return '';
    }
  }

  if (!Array.isArray(parsed)) return '';

  return parsed
    .map((entry) => {
      if (typeof entry === 'string') return entry.trim();
      if (!entry || typeof entry !== 'object') return '';
      const label = String(entry.label || entry.name || '').trim();
      const reference = String(entry.reference || entry.url || entry.path || '').trim();
      if (label && reference && label !== reference) return `${label} | ${reference}`;
      return label || reference;
    })
    .filter(Boolean)
    .join('\n');
}

function proofDocumentsTextToJson(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 20);

  if (lines.length === 0) return JSON.stringify([]);

  const docs = lines.map((line, index) => {
    const parts = line.split('|');
    if (parts.length > 1) {
      const label = (parts.shift() || '').trim();
      const reference = parts.join('|').trim();
      return {
        label: label || `Document ${index + 1}`,
        reference: reference || label || `Document ${index + 1}`,
      };
    }
    return {
      label: line,
      reference: line,
    };
  });

  return JSON.stringify(docs);
}

function uploadedProofDocumentToLine(uploaded, fallbackName) {
  const label = String(
    uploaded?.original_name || uploaded?.originalName || fallbackName || 'Document',
  ).trim();
  const reference = String(
    uploaded?.reference || uploaded?.url || uploaded?.path || '',
  ).trim();

  if (!reference) return '';
  if (label && label !== reference) return `${label} | ${reference}`;
  return reference;
}

function formatDateForInput(date) {
  return date.toISOString().split('T')[0];
}

function getNextPayrollDate(baseDateString) {
  const baseDate = new Date(baseDateString || new Date());
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const day = baseDate.getDate();

  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();

  if (day < 15) {
    return formatDateForInput(new Date(year, month, 15));
  }

  if (day < lastDayOfMonth) {
    return formatDateForInput(new Date(year, month, lastDayOfMonth));
  }

  return formatDateForInput(new Date(year, month + 1, 15));
}

function calculateInstallment(principalAmount, termsCutoffs) {
  const principal = Number(principalAmount);
  const terms = Number(termsCutoffs);

  if (!Number.isFinite(principal) || !Number.isFinite(terms) || principal <= 0 || terms <= 0) {
    return '';
  }

  return (principal / terms).toFixed(2);
}

function formatPeso(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function createEmptyVale(defaultValeType = 'regular_cash_advance') {
  const today = formatDateForInput(new Date());
  return {
    id: `vale-${Date.now()}-${Math.random()}`,
    employee_query: '',
    employee_id_number: '',
    vale_type: defaultValeType,
    principal_amount: '',
    installment_per_cutoff: '',
    disbursement_date: today,
    first_deduction_date: getNextPayrollDate(today),
    first_deduction_auto: true,
    terms_cutoffs: '',
    status: 'pending',
    remarks: '',
    proof_documents_text: '',
    expanded: true,
  };
}

export default function ValesBulkCreator({
  isOpen,
  onClose,
  onSubmit,
  isDarkMode: propIsDarkMode,
  editMode = false,
  initialData = null,
  defaultValeType = 'regular_cash_advance',
}) {
  const { isDarkMode: authIsDarkMode } = useAuth();
  const isDarkMode = typeof propIsDarkMode !== 'undefined' ? propIsDarkMode : authIsDarkMode;
  const { toasts, showError, showWarning, removeToast } = useToast();
  const modalRef = useRef(null);
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [activeEmployeeSearch, setActiveEmployeeSearch] = useState(null);
  const [uploadingProofValeId, setUploadingProofValeId] = useState(null);

  const buildValeFromInitialData = (data) => ([{
    id: `vale-${Date.now()}`,
    employee_query: String(data.employee_id_number ?? data.employeeIdNumber ?? data.employee_uid ?? data.employeeUid ?? ''),
    employee_id_number: String(data.employee_id_number ?? data.employeeIdNumber ?? data.employee_uid ?? data.employeeUid ?? ''),
    vale_type: data.vale_type || data.typeRaw || 'regular_cash_advance',
    principal_amount: String(data.principal_amount ?? data.amount ?? ''),
    installment_per_cutoff: String(data.installment_per_cutoff ?? data.installmentValue ?? ''),
    disbursement_date: (data.disbursement_date || '').slice(0, 10) || new Date().toISOString().split('T')[0],
    first_deduction_date: (data.first_deduction_date || '').slice(0, 10) || getNextPayrollDate((data.disbursement_date || '').slice(0, 10)),
    first_deduction_auto: !(data.first_deduction_date || '').slice(0, 10),
    terms_cutoffs: String(data.terms_cutoffs ?? ''),
    status: data.status || data.statusRaw || 'pending',
    remarks: data.remarks || '',
    proof_documents_text: proofDocumentsJsonToText(data.proof_documents_json),
    expanded: true,
  }]);

  const [vales, setVales] = useState(() => {
    if (editMode && initialData) {
      return buildValeFromInitialData(initialData);
    }
    return [createEmptyVale(defaultValeType)];
  });

  useEffect(() => {
    if (!isOpen) return;

    if (editMode) {
      if (initialData) {
        setVales(buildValeFromInitialData(initialData));
      }
      return;
    }

    setVales([createEmptyVale(defaultValeType)]);
  }, [isOpen, editMode, initialData?.id, initialData?.uid, initialData?.employee_uid, defaultValeType]);

  useEffect(() => {
    const loadEmployees = async () => {
      if (!isOpen) return;
      setLoadingEmployees(true);
      try {
        const response = await apiService.employees.getEmployees({ limit: 1000 });
        setEmployees(Array.isArray(response?.employees) ? response.employees : []);
      } catch (error) {
        setEmployees([]);
      } finally {
        setLoadingEmployees(false);
      }
    };

    loadEmployees();
  }, [isOpen]);


  useEffect(() => {
    const handleEsc = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const updateVale = (valeId, updates) => {
    setVales((prev) => prev.map((vale) => (vale.id === valeId ? { ...vale, ...updates } : vale)));
  };

  const normalizeEmployee = (employee = {}) => {
    const idNumber = String(employee.id_number ?? employee.idNumber ?? '').trim();
    const nameParts = [employee.first_name, employee.middle_name, employee.last_name].filter(Boolean);
    const fullName =
      employee.full_name ||
      employee.fullName ||
      employee.employee_name ||
      employee.name ||
      (nameParts.length ? nameParts.join(' ') : '');

    return {
      ...employee,
      idNumber,
      fullName: String(fullName || '').trim(),
    };
  };

  const findEmployeeByQuery = (query) => {
    const normalized = String(query || '').trim().toLowerCase();
    if (!normalized) return null;

    return employees
      .map(normalizeEmployee)
      .find((employee) =>
        employee.idNumber.toLowerCase() === normalized ||
        employee.fullName.toLowerCase() === normalized
      ) || null;
  };

  const getEmployeeMatches = (query) => {
    const normalized = String(query || '').trim().toLowerCase();
    if (!normalized) return [];

    return employees
      .map(normalizeEmployee)
      .filter((employee) =>
        employee.idNumber.toLowerCase().includes(normalized) ||
        employee.fullName.toLowerCase().includes(normalized)
      )
      .slice(0, 6);
  };

  const handleEmployeeQueryChange = (vale, query) => {
    const normalizedQuery = String(query || '').trim();
    const matchedEmployee = findEmployeeByQuery(normalizedQuery);

    if (matchedEmployee) {
      updateVale(vale.id, {
        employee_query: query,
        employee_id_number: matchedEmployee.idNumber,
      });
      return;
    }

    updateVale(vale.id, {
      employee_query: query,
      employee_id_number: /^\d+$/.test(normalizedQuery) ? normalizedQuery : '',
    });
  };

  const applyEmployeeSelection = (vale, employee) => {
    updateVale(vale.id, {
      employee_query: `${employee.fullName} • ${employee.idNumber}`,
      employee_id_number: employee.idNumber,
    });
    setActiveEmployeeSearch(null);
  };

  const updatePrincipal = (vale, value) => {
    const installment = calculateInstallment(value, vale.terms_cutoffs);
    updateVale(vale.id, {
      principal_amount: value,
      installment_per_cutoff: installment,
    });
  };

  const updateTerms = (vale, value) => {
    const installment = calculateInstallment(vale.principal_amount, value);
    updateVale(vale.id, {
      terms_cutoffs: value,
      installment_per_cutoff: installment,
    });
  };

  const updateDisbursementDate = (vale, dateValue) => {
    const nextUpdates = {
      disbursement_date: dateValue,
    };

    if (vale.first_deduction_auto) {
      nextUpdates.first_deduction_date = getNextPayrollDate(dateValue);
    }

    updateVale(vale.id, nextUpdates);
  };

  const addVale = () => {
    setVales((prev) => [...prev, createEmptyVale(defaultValeType)]);
  };

  const deleteVale = (valeId) => {
    if (vales.length === 1) return;
    setVales((prev) => prev.filter((vale) => vale.id !== valeId));
  };

  const toggleExpanded = (valeId) => {
    setVales((prev) => prev.map((vale) => (vale.id === valeId ? { ...vale, expanded: !vale.expanded } : vale)));
  };

  const handleProofUpload = async (valeId, event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;

    setUploadingProofValeId(valeId);
    try {
      const uploadedLines = [];

      for (const file of files) {
        const response = await apiService.finance.uploadProofDocument(file, {
          module: 'vales',
        });
        const uploaded = response?.uploaded || response?.data?.uploaded || null;
        const line = uploadedProofDocumentToLine(uploaded, file.name);
        if (line) uploadedLines.push(line);
      }

      if (!uploadedLines.length) return;

      setVales((prev) =>
        prev.map((vale) => {
          if (vale.id !== valeId) return vale;
          const existing = String(vale.proof_documents_text || '').trim();
          const nextText = existing
            ? `${existing}\n${uploadedLines.join('\n')}`
            : uploadedLines.join('\n');
          return { ...vale, proof_documents_text: nextText };
        }),
      );
    } catch (error) {
      console.error('Failed to upload proof document:', error);
      showError?.('Failed to upload proof document: ' + (error.message || 'Unknown error'));
    } finally {
      setUploadingProofValeId(null);
    }
  };

  const handleSave = async () => {
    const mapped = vales.map((vale) => ({
      employee_uid: resolveEmployeeUid(vale.employee_id_number) || null,
      employee_id_number: String(vale.employee_id_number || '').trim(),
      employee_name: resolveEmployeeName(vale.employee_id_number) || null,
      vale_type: vale.vale_type,
      principal_amount: Number(vale.principal_amount || 0),
      installment_per_cutoff: Number(vale.installment_per_cutoff || 0),
      disbursement_date: vale.disbursement_date,
      first_deduction_date: vale.first_deduction_date || null,
      terms_cutoffs: vale.terms_cutoffs ? Number(vale.terms_cutoffs) : null,
      status: vale.status || 'pending',
      remarks: vale.remarks || null,
      proof_documents_json: proofDocumentsTextToJson(vale.proof_documents_text),
    }));

    if (mapped.some((vale) => !vale.employee_id_number || vale.principal_amount <= 0 || vale.installment_per_cutoff <= 0 || !vale.disbursement_date || !vale.terms_cutoffs || vale.terms_cutoffs <= 0)) {
      showWarning?.('Please complete required fields for all vales.');
      return;
    }

    const invalidIdNumber = vales.find((vale) => vale.employee_id_number && !resolveEmployeeName(vale.employee_id_number));
    if (invalidIdNumber) {
      showWarning?.(`Employee ID Number ${invalidIdNumber.employee_id_number} was not found. Please use a valid ID number.`);
      return;
    }

    await onSubmit(editMode ? mapped[0] : mapped);
  };

  const resolveEmployee = (employeeIdNumber) => {
    const idNumber = String(employeeIdNumber || '').trim();
    if (!idNumber) return null;

    return employees.find((item) => {
      const value = String(item.id_number ?? item.idNumber ?? '').trim();
      return value === idNumber;
    }) || null;
  };

  const resolveEmployeeName = (employeeIdNumber) => {
    const employee = resolveEmployee(employeeIdNumber);
    if (!employee) return '';

    return normalizeEmployee(employee).fullName;
  };

  const resolveEmployeeUid = (employeeIdNumber) => {
    const employee = resolveEmployee(employeeIdNumber);
    if (!employee) return null;
    const uid = Number(employee.uid ?? employee.employee_uid ?? employee.id ?? 0);
    return Number.isFinite(uid) && uid > 0 ? uid : null;
  };

  if (!isOpen) return null;

  const bgBase = isDarkMode ? 'bg-stone-950' : 'bg-stone-100';
  const bgCard = isDarkMode ? 'bg-stone-900' : 'bg-white';
  const textPrimary = isDarkMode ? 'text-gray-100' : 'text-gray-900';
  const textSecondary = isDarkMode ? 'text-gray-400' : 'text-gray-500';
  const borderCol = isDarkMode ? 'border-gray-800' : 'border-gray-200';
  const inputBg = isDarkMode ? 'bg-stone-950 border-gray-700 focus:border-blue-500 text-white' : 'bg-white border-gray-300 focus:border-blue-500 text-gray-900';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 sm:p-6">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <div ref={modalRef} className={`w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden border ${borderCol} ${bgBase}`}>
        <div className={`sticky top-0 z-20 px-6 py-4 border-b ${borderCol} ${bgCard} flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0`}>
          <div>
            <h2 className={`text-xl font-bold flex items-center gap-2 ${textPrimary}`}>
              <Wallet className="w-5 h-5 text-blue-500" />
              {editMode ? 'Edit Vale' : 'Bulk Create Vales'}
            </h2>
            <p className={`mt-1 text-xs ${textSecondary}`}>Rows: {vales.length}</p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button onClick={handleSave} className="flex-1 sm:flex-none px-6 py-2 bg-gray-600 hover:bg-gray-500 text-white text-sm font-bold rounded-lg shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2">
              <Save size={16} /> {editMode ? 'Update Vale' : 'Save All'}
            </button>
            <button onClick={onClose} className={`p-2 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-stone-800 text-gray-400' : 'hover:bg-stone-200 text-gray-500'}`}>
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {vales.map((vale, index) => (
            <div key={vale.id} className={`rounded-xl border shadow-sm ${bgCard} ${borderCol}`}>
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <button onClick={() => toggleExpanded(vale.id)} className={`p-1 rounded-md transition-colors ${isDarkMode ? 'hover:bg-stone-800' : 'hover:bg-stone-100'}`}>
                      {vale.expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    </button>
                    <span className={`text-sm font-mono font-bold px-2 py-1 rounded ${isDarkMode ? 'bg-stone-800 text-blue-400' : 'bg-gray-50 text-blue-600'}`}>
                      Entry #{index + 1}
                    </span>
                    <span className={`text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                      {(() => {
                        const employeeName = resolveEmployeeName(vale.employee_id_number);
                        const principalAmount = formatPeso(vale.principal_amount);

                        if (employeeName && principalAmount) {
                          return `${employeeName} • ${principalAmount}`;
                        }

                        if (employeeName) {
                          return `${employeeName} • ID# ${vale.employee_id_number}`;
                        }

                        if (principalAmount) {
                          return `Pending employee • ${principalAmount}`;
                        }

                        return 'New Vale';
                      })()}
                    </span>
                  </div>

                  {!editMode && (
                    <button onClick={() => deleteVale(vale.id)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors">
                      <Trash2 size={18} />
                    </button>
                  )}
                </div>

                {vale.expanded && (
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    <div className="md:col-span-5 relative">
                      <label className={`block text-xs font-medium mb-1 ${textSecondary}`}>Employee *</label>
                      <input
                        type="text"
                        value={vale.employee_query || vale.employee_id_number}
                        onFocus={() => setActiveEmployeeSearch(vale.id)}
                        onBlur={() => setTimeout(() => setActiveEmployeeSearch(null), 120)}
                        onChange={(event) => handleEmployeeQueryChange(vale, event.target.value)}
                        className={`w-full px-2 py-1.5 text-sm rounded-lg border outline-none transition-all ${inputBg}`}
                        placeholder="Type employee ID or name"
                      />

                      {activeEmployeeSearch === vale.id && getEmployeeMatches(vale.employee_query || vale.employee_id_number).length > 0 && (
                        <div className={`absolute z-30 mt-1 w-full rounded-lg border shadow-lg overflow-hidden ${bgCard} ${borderCol}`}>
                          {getEmployeeMatches(vale.employee_query || vale.employee_id_number).map((employee) => (
                            <button
                              key={`${employee.idNumber}-${employee.uid || employee.id || employee.fullName}`}
                              type="button"
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => applyEmployeeSelection(vale, employee)}
                              className={`w-full px-3 py-2 text-left text-sm transition-colors ${isDarkMode ? 'hover:bg-stone-800 text-gray-100' : 'hover:bg-stone-50 text-gray-900'}`}
                            >
                              <span className="block font-medium">{employee.fullName || 'Unnamed Employee'}</span>
                              <span className={`block text-xs ${textSecondary}`}>ID# {employee.idNumber || '—'}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      <p className={`mt-1 inline-flex items-center rounded-md px-2 py-0.5 text-[11px] ${resolveEmployeeName(vale.employee_id_number) ? (isDarkMode ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-50 text-emerald-700') : (isDarkMode ? 'bg-amber-500/10 text-amber-300' : 'bg-amber-50 text-amber-700')}`}>
                        {resolveEmployeeName(vale.employee_id_number)
                          ? `Employee: ${resolveEmployeeName(vale.employee_id_number)}`
                          : loadingEmployees
                            ? 'Loading employees...'
                            : vale.employee_query || vale.employee_id_number
                              ? 'No exact employee match yet'
                              : 'Type or select an employee'}
                      </p>
                    </div>

                    <div className="md:col-span-3">
                      <label className={`block text-xs font-medium mb-1 ${textSecondary}`}>Type *</label>
                      <select value={vale.vale_type} onChange={(event) => updateVale(vale.id, { vale_type: event.target.value })} className={`w-full px-2 py-1.5 text-sm rounded-lg border outline-none transition-all ${inputBg}`}>
                        <option value="regular_cash_advance">Regular Cash Advance</option>
                        <option value="emergency_vale">Emergency Vale</option>
                        <option value="salary_advance">Salary Advance</option>
                        <option value="calamity_loan">Calamity Loan</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    <div className={`md:col-span-7 rounded-xl border p-3 ${borderCol} ${isDarkMode ? 'bg-stone-950/70' : 'bg-stone-50'}`}>
                      <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
                        <div className="md:col-span-2">
                          <label className={`block text-xs font-medium mb-1 ${textSecondary}`}>Principal *</label>
                          <input type="number" min="0" step="0.01" value={vale.principal_amount} onChange={(event) => updatePrincipal(vale, event.target.value)} className={`w-full px-2 py-1.5 text-sm rounded-lg border outline-none transition-all ${inputBg}`} />
                        </div>

                        <div className="md:col-span-2">
                          <label className={`block text-xs font-medium mb-1 ${textSecondary}`}>Terms (Cutoffs) *</label>
                          <input type="number" min="1" value={vale.terms_cutoffs} onChange={(event) => updateTerms(vale, event.target.value)} className={`w-full px-2 py-1.5 text-sm rounded-lg border outline-none transition-all ${inputBg}`} />
                        </div>

                        <div className="md:col-span-2">
                          <label className={`block text-xs font-medium mb-1 ${textSecondary}`}>Installment *</label>
                          <input type="number" min="0" step="0.01" value={vale.installment_per_cutoff} disabled className={`w-full px-2 py-1.5 text-sm rounded-lg border outline-none transition-all cursor-not-allowed ${isDarkMode ? 'bg-stone-800 border-gray-700 text-gray-300' : 'bg-stone-100 border-gray-300 text-gray-600'}`} />
                        </div>
                      </div>
                      <p className={`mt-2 text-[11px] ${textSecondary}`}>
                        Installment is auto-calculated from Principal ÷ Terms.
                      </p>
                    </div>

                    <div className="md:col-span-3">
                      <label className={`block text-xs font-medium mb-1 ${textSecondary}`}>Disbursement Date *</label>
                      <input type="date" value={vale.disbursement_date} onChange={(event) => updateDisbursementDate(vale, event.target.value)} className={`w-full px-2 py-1.5 text-sm rounded-lg border outline-none transition-all ${inputBg}`} />
                    </div>

                    <div className="md:col-span-3">
                      <label className={`block text-xs font-medium mb-1 ${textSecondary}`}>First Deduction</label>
                      <input type="date" value={vale.first_deduction_date} onChange={(event) => updateVale(vale.id, { first_deduction_date: event.target.value, first_deduction_auto: false })} className={`w-full px-2 py-1.5 text-sm rounded-lg border outline-none transition-all ${inputBg}`} />
                      <p className={`mt-1 text-[11px] ${textSecondary}`}>
                        Defaults to next payroll date.
                      </p>
                    </div>

                    <div className="md:col-span-2">
                      <label className={`block text-xs font-medium mb-1 ${textSecondary}`}>Status</label>
                      <select value={vale.status} onChange={(event) => updateVale(vale.id, { status: event.target.value })} className={`w-full px-2 py-1.5 text-sm rounded-lg border outline-none transition-all ${inputBg}`}>
                        <option value="pending">Pending</option>
                        <option value="approved">Approved</option>
                        <option value="released">Released</option>
                        <option value="active">Active</option>
                        <option value="fully_paid">Fully Paid</option>
                        <option value="defaulted">Defaulted</option>
                        <option value="cancelled">Cancelled</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </div>

                    <div className="md:col-span-12">
                      <label className={`block text-xs font-medium mb-1 ${textSecondary}`}>Remarks</label>
                      <textarea rows={2} value={vale.remarks} onChange={(event) => updateVale(vale.id, { remarks: event.target.value })} className={`w-full px-2 py-1.5 text-sm rounded-lg border outline-none transition-all resize-y ${inputBg}`} placeholder="Add optional notes for this vale" />
                    </div>

                    <div className="md:col-span-12">
                      <label className={`block text-xs font-medium mb-1 ${textSecondary}`}>Proof Documents (one per line)</label>
                      <textarea
                        rows={2}
                        value={vale.proof_documents_text || ''}
                        onChange={(event) => updateVale(vale.id, { proof_documents_text: event.target.value })}
                        className={`w-full px-2 py-1.5 text-sm rounded-lg border outline-none transition-all resize-y ${inputBg}`}
                        placeholder="Approval memo #123 | https://..."
                      />
                      <div className="mt-2 flex items-center gap-2">
                        <label
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-semibold cursor-pointer transition-colors ${
                            isDarkMode
                              ? 'bg-stone-900 border-gray-700 text-gray-200 hover:bg-stone-800'
                              : 'bg-stone-50 border-gray-300 text-gray-700 hover:bg-stone-100'
                          } ${uploadingProofValeId === vale.id ? 'opacity-60 cursor-not-allowed' : ''}`}
                        >
                          {uploadingProofValeId === vale.id ? (
                            <Loader2 size={12} className="animate-spin" />
                          ) : (
                            <Upload size={12} />
                          )}
                          {uploadingProofValeId === vale.id ? 'Uploading...' : 'Attach Files'}
                          <input
                            type="file"
                            multiple
                            className="hidden"
                            disabled={uploadingProofValeId === vale.id}
                            onChange={(event) => handleProofUpload(vale.id, event)}
                          />
                        </label>
                        <span className="text-[11px] text-gray-500">
                          Upload adds link entries automatically.
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {!editMode && (
            <button onClick={addVale} className={`w-full py-4 rounded-xl border-2 border-dashed flex items-center justify-center gap-2 transition-all opacity-70 hover:opacity-100 ${isDarkMode ? 'border-gray-800 hover:border-gray-700 text-gray-400 hover:bg-stone-900' : 'border-gray-300 hover:border-gray-400 text-gray-500 hover:bg-white'}`}>
              <Plus size={20} /> Add Another Vale
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
