const STORAGE_KEY = 'fpd_demo_mock_store_v1';
const LATENCY_MS = 35;
const EXPENSE_TARGET_AMOUNT = 12500000;

const clone = (value) => JSON.parse(JSON.stringify(value));
const nowIso = () => new Date().toISOString();
const today = () => nowIso().slice(0, 10);
const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const pad = (value, size = 2) => String(value).padStart(size, '0');
const formatSequence = (value, size = 6) => String(value).padStart(size, '0');

const respond = (payload) =>
  new Promise((resolve) => {
    setTimeout(() => resolve(clone(payload)), LATENCY_MS);
  });

const rejectWith = (message) =>
  new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), LATENCY_MS);
  });

const parseBody = (body) => {
  if (!body) return {};
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  if (typeof body === 'object') return body;
  return {};
};

const quarterFromDate = (dateValue) => {
  if (!dateValue) return null;
  const month = new Date(dateValue).getMonth() + 1;
  return `Q${Math.ceil(month / 3)}`;
};

const makeAvatarDataUri = (label = 'User') => {
  const safe = String(label || 'User').trim() || 'User';
  let hash = 0;
  for (let i = 0; i < safe.length; i += 1) {
    hash = safe.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  const initials = safe
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='96' height='96' viewBox='0 0 96 96'><rect width='96' height='96' rx='14' fill='hsl(${hue} 45% 42%)'/><text x='50%' y='54%' dominant-baseline='middle' text-anchor='middle' font-family='Arial, sans-serif' font-size='34' font-weight='700' fill='white'>${initials || 'U'}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

const getPeriodBounds = (period, cutoff) => {
  const [yearRaw, monthRaw] = String(period || `${new Date().getFullYear()}-${pad(new Date().getMonth() + 1)}`)
    .split('-')
    .map((value) => Number(value));

  const year = Number.isFinite(yearRaw) ? yearRaw : new Date().getFullYear();
  const month = Number.isFinite(monthRaw) ? monthRaw : new Date().getMonth() + 1;

  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);

  const start = cutoff === 15 ? 1 : 16;
  const end = cutoff === 15 ? 15 : lastDay.getDate();

  const startDate = new Date(year, month - 1, start).toISOString().slice(0, 10);
  const endDate = new Date(year, month - 1, end).toISOString().slice(0, 10);

  return {
    period: `${year}-${pad(month)}`,
    cutoff,
    startDate,
    endDate,
    days: cutoff === 15 ? 15 : Math.max(1, end - 15),
  };
};

const normalizeLineItems = (value, fallbackFactory = () => ({ id: `li-${Date.now()}-${Math.random()}`, amount: 0 })) => {
  if (!Array.isArray(value) || value.length === 0) return [fallbackFactory()];
  return value.map((item, index) => ({
    id: item.id ?? `li-${Date.now()}-${index}-${Math.random()}`,
    ...item,
    amount: toNumber(item.amount, 0),
  }));
};

const normalizeCashOrCheckVoucher = (voucher, type) => {
  const transactionType = String(voucher.transaction_type || 'debit').toLowerCase();
  const safeTransactionType = transactionType === 'credit' ? 'credit' : 'debit';

  const lineItems = normalizeLineItems(voucher.line_items || voucher.lineItems || [], () => ({
    id: `li-${Date.now()}-${Math.random()}`,
    amount: 0,
    with_copy: false,
  }));

  const lineItemTotal = lineItems.reduce((sum, item) => sum + toNumber(item.amount, 0), 0);
  const explicitTotal = toNumber(voucher.total_amount, 0);
  const fallbackTotal = toNumber(voucher.amount, 0);
  const totalAmount = explicitTotal > 0 ? explicitTotal : fallbackTotal > 0 ? fallbackTotal : lineItemTotal;

  const drAmount =
    safeTransactionType === 'debit'
      ? toNumber(voucher.dr_amount, totalAmount)
      : 0;
  const crAmount =
    safeTransactionType === 'credit'
      ? toNumber(voucher.cr_amount, totalAmount)
      : 0;

  const prefix = type === 'check' ? 'CHK' : 'CV';
  const currentNumber = String(voucher.voucher_number || '').trim();
  const voucherNumber = currentNumber || `${prefix}-${formatSequence(1)}`;

  return {
    ...voucher,
    voucher_number: voucherNumber,
    voucher_date: voucher.voucher_date || voucher.date || today(),
    transaction_type: safeTransactionType,
    status: String(voucher.status || 'pending').toLowerCase(),
    dr_amount: drAmount,
    cr_amount: crAmount,
    total_amount: totalAmount,
    line_items: lineItems,
    line_items_count: lineItems.length,
    with_copy_count: lineItems.filter((item) => Boolean(item.with_copy)).length,
    company_payee_payor: voucher.company_payee_payor || voucher.payee || '',
    remarks: voucher.remarks || '',
    proof_documents_json: voucher.proof_documents_json || '[]',
    updated_at: nowIso(),
  };
};

const normalizePettyCashVoucher = (voucher) => {
  const lineItems = normalizeLineItems(voucher.line_items || voucher.lineItems || [], () => ({
    id: `li-${Date.now()}-${Math.random()}`,
    amount: 0,
    vat_type: 'Non-VAT',
    includeInExpenses: false,
  }));

  const vatFromLines = lineItems
    .filter((item) => String(item.vat_type || '').toLowerCase().includes('vat'))
    .reduce((sum, item) => sum + toNumber(item.amount, 0), 0);

  const nonVatFromLines = lineItems
    .filter((item) => !String(item.vat_type || '').toLowerCase().includes('vat'))
    .reduce((sum, item) => sum + toNumber(item.amount, 0), 0);

  const amountVat = toNumber(voucher.amount_vat, vatFromLines);
  const amountNonVat = toNumber(voucher.amount_non_vat, nonVatFromLines);
  const totalAmount = amountVat + amountNonVat;

  const currentNumber = String(voucher.voucher_number || '').trim();
  const voucherNumber = currentNumber || `PCV-${formatSequence(1)}`;

  return {
    ...voucher,
    voucher_number: voucherNumber,
    voucher_date: voucher.voucher_date || voucher.date || today(),
    amount_vat: amountVat,
    amount_non_vat: amountNonVat,
    total_amount: totalAmount,
    status: String(voucher.status || 'draft').toLowerCase(),
    line_items: lineItems,
    line_items_count: lineItems.length,
    with_copy_count: lineItems.filter((item) => Boolean(item.with_copy)).length,
    account_classification: voucher.account_classification || voucher.particulars || '',
    company_supplier: voucher.company_supplier || voucher.company_payee_payor || '',
    particulars: voucher.particulars || '',
    proof_documents_json: voucher.proof_documents_json || '[]',
    updated_at: nowIso(),
  };
};

const normalizeBill = (bill) => {
  const items = Array.isArray(bill.items) ? bill.items : [];
  const normalizedItems = items.map((item, index) => ({
    id: item.id ?? `mbi-${bill.id || 'tmp'}-${index + 1}`,
    bill_id: bill.id || item.bill_id || null,
    provider_id: item.provider_id ?? null,
    provider_name: item.provider_name || '',
    category: item.category || 'other',
    description: item.description || item.remarks || '',
    amount: toNumber(item.amount, 0),
    due_date: item.due_date || bill.billing_period_end || today(),
    is_paid: Boolean(item.is_paid),
    remarks: item.remarks || '',
  }));

  const totals = {
    electricity_subtotal: 0,
    water_subtotal: 0,
    communications_subtotal: 0,
    rental_subtotal: 0,
    payment_fees_subtotal: 0,
    other_subtotal: 0,
    net_total: 0,
  };

  normalizedItems.forEach((item) => {
    const key = `${item.category}_subtotal`;
    if (Object.prototype.hasOwnProperty.call(totals, key)) {
      totals[key] += item.amount;
    } else {
      totals.other_subtotal += item.amount;
    }
    totals.net_total += item.amount;
  });

  return {
    ...bill,
    month: Number(bill.month) || new Date().getMonth() + 1,
    year: Number(bill.year) || new Date().getFullYear(),
    status: String(bill.status || 'pending').toLowerCase(),
    items: normalizedItems,
    ...totals,
    total_amount: totals.net_total,
    updated_at: nowIso(),
  };
};

const normalizeVale = (vale) => {
  const payments = Array.isArray(vale.payments)
    ? vale.payments.map((payment, index) => ({
        id: payment.id ?? `vp-${vale.id || 'tmp'}-${index + 1}`,
        payment_date: payment.payment_date || today(),
        amount: toNumber(payment.amount, 0),
        remarks: payment.remarks || '',
      }))
    : [];

  const principal = toNumber(vale.principal_amount, 0);
  const totalPaid = toNumber(
    vale.total_paid,
    payments.reduce((sum, payment) => sum + payment.amount, 0),
  );
  const balanceAmount = Math.max(0, principal - totalPaid);

  let status = String(vale.status || 'pending').toLowerCase();
  if (!['cancelled', 'rejected'].includes(status) && balanceAmount <= 0 && principal > 0) {
    status = 'fully_paid';
  }

  return {
    ...vale,
    payments,
    principal_amount: principal,
    installment_per_cutoff: toNumber(vale.installment_per_cutoff, 0),
    terms_cutoffs: toNumber(vale.terms_cutoffs, 0),
    total_paid: totalPaid,
    balance_amount: balanceAmount,
    status,
    updated_at: nowIso(),
  };
};

const normalizeCheckingRecord = (record) => {
  const additionalFees = Array.isArray(record.additional_fees)
    ? record.additional_fees.map((item, index) => ({
        id: item.id ?? `af-${record.id || 'tmp'}-${index + 1}`,
        label: item.label || '',
        amount: toNumber(item.amount, 0),
      }))
    : [];

  const reimbursements = Array.isArray(record.reimbursements)
    ? record.reimbursements.map((item, index) => ({
        id: item.id ?? `rb-${record.id || 'tmp'}-${index + 1}`,
        label: item.label || '',
        amount: toNumber(item.amount, 0),
      }))
    : [];

  const grossPayroll = toNumber(record.gross_payroll || record.gross_payroll_total, 0);
  const adjustment = toNumber(record.adjustment_cash, 0);
  const pettyCash = toNumber(record.petty_cash_replenishment, 50000);
  const canteen = toNumber(record.canteen, 7000);
  const monthlyBills = toNumber(record.monthly_bills_total, 0);

  const totalAdditionalFees = additionalFees.reduce((sum, item) => sum + item.amount, 0);
  const totalReimbursements = reimbursements.reduce((sum, item) => sum + item.amount, 0);

  return {
    ...record,
    gross_payroll: grossPayroll,
    gross_payroll_total: grossPayroll,
    adjustment_cash: adjustment,
    petty_cash_replenishment: pettyCash,
    canteen,
    monthly_bills_total: monthlyBills,
    additional_fees: additionalFees,
    reimbursements,
    total_additional_fees: totalAdditionalFees,
    total_reimbursements: totalReimbursements,
    total_cash_needed:
      grossPayroll +
      adjustment +
      pettyCash +
      canteen +
      monthlyBills +
      totalAdditionalFees +
      totalReimbursements,
    cutoff_date: record.cutoff_date || today(),
    cutoff_period: record.cutoff_period || '1st',
    status: String(record.status || 'draft').toLowerCase(),
    updated_at: nowIso(),
  };
};

const normalizeCashRequest = (record) => {
  const reimbursements = Array.isArray(record.reimbursements)
    ? record.reimbursements.map((item, index) => ({
        id: item.id ?? `cr-rb-${record.id || 'tmp'}-${index + 1}`,
        label: item.label || '',
        amount: toNumber(item.amount, 0),
      }))
    : [];

  const totalReimbursements = reimbursements.reduce((sum, item) => sum + item.amount, 0);
  const adjNetPayroll = toNumber(record.adj_net_payroll, 0);
  const pettyCash = toNumber(record.petty_cash_replenishment, 50000);
  const canteen = toNumber(record.canteen, 7000);
  const monthlyBills = toNumber(record.monthly_bills_total, 0);

  return {
    ...record,
    cutoff_date: record.cutoff_date || today(),
    cutoff_period: record.cutoff_period || '1st',
    adj_net_payroll: adjNetPayroll,
    petty_cash_replenishment: pettyCash,
    canteen,
    monthly_bills_total: monthlyBills,
    reimbursements,
    total_reimbursements: totalReimbursements,
    total_cash_needed: adjNetPayroll + pettyCash + canteen + monthlyBills + totalReimbursements,
    status: String(record.status || 'draft').toLowerCase(),
    updated_at: nowIso(),
  };
};

const createInitialStore = () => ({
  counters: {
    customer: 4,
    invoice: 104,
    cashVoucher: 103,
    checkVoucher: 103,
    pettyCashVoucher: 104,
    expense: 4,
    vale: 4,
    valePayment: 4,
    provider: 6,
    monthlyBill: 4,
    monthlyBillItem: 18,
    payrollChecking: 3,
    cashRequest: 3,
    proof: 1,
  },
  chartOfAccounts: [
    { id: 1, account_code: '5001', account_name: 'Office Supplies Expense' },
    { id: 2, account_code: '5002', account_name: 'Transportation Expense' },
    { id: 3, account_code: '5003', account_name: 'Utilities Expense' },
    { id: 4, account_code: '5004', account_name: 'Repairs and Maintenance' },
    { id: 5, account_code: '5005', account_name: 'Communication Expense' },
    { id: 6, account_code: '5006', account_name: 'Meals and Representation' },
    { id: 7, account_code: '5007', account_name: 'Fuel and Oil' },
    { id: 8, account_code: '5008', account_name: 'Miscellaneous Expense' },
  ],
  employees: [
    { uid: 1, id_number: '1001', employee_name: 'Maria Santos', first_name: 'Maria', last_name: 'Santos', department: 'Finance', position: 'Finance Manager', status: 'active', hourly_rate: 240 },
    { uid: 2, id_number: '1002', employee_name: 'Juan Dela Cruz', first_name: 'Juan', last_name: 'Dela Cruz', department: 'Operations', position: 'Site Supervisor', status: 'active', hourly_rate: 210 },
    { uid: 3, id_number: '1003', employee_name: 'Ana Reyes', first_name: 'Ana', last_name: 'Reyes', department: 'Engineering', position: 'Project Engineer', status: 'active', hourly_rate: 225 },
    { uid: 4, id_number: '1004', employee_name: 'Mark Javier', first_name: 'Mark', last_name: 'Javier', department: 'Operations', position: 'Foreman', status: 'active', hourly_rate: 195 },
    { uid: 5, id_number: '1005', employee_name: 'Leah Ramos', first_name: 'Leah', last_name: 'Ramos', department: 'Finance', position: 'Payroll Clerk', status: 'active', hourly_rate: 180 },
    { uid: 6, id_number: '1006', employee_name: 'Chris Mendoza', first_name: 'Chris', last_name: 'Mendoza', department: 'Engineering', position: 'Draftsman', status: 'active', hourly_rate: 175 },
  ],
  customers: [
    { id: 1, customer_name: 'Acme Builders Inc.', customer_address: 'Ortigas Ave, Pasig City', customer_tin: '009-455-781-000', remarks: '' },
    { id: 2, customer_name: 'Northwind Industrial Corp.', customer_address: 'Makati Avenue, Makati City', customer_tin: '217-556-331-000', remarks: '' },
    { id: 3, customer_name: 'Prime Utility Services', customer_address: 'Cainta, Rizal', customer_tin: '413-199-882-000', remarks: '' },
  ],
  invoices: [
    {
      id: 101,
      invoice_number: '000101',
      customer_name: 'Acme Builders Inc.',
      customer_address: 'Ortigas Ave, Pasig City',
      invoice_date: '2026-04-03',
      sale_type: 'vatable',
      total_amount: 125000,
      account_receivables: 125000,
      vat_amount: 13392.86,
      vatable_sales: 111607.14,
      zero_rated_sales: 0,
      status: 'approved',
      remarks: 'Structural works billing',
      items: [],
      created_by: 1,
      updated_at: nowIso(),
    },
    {
      id: 102,
      invoice_number: '000102',
      customer_name: 'Northwind Industrial Corp.',
      customer_address: 'Makati Avenue, Makati City',
      invoice_date: '2026-04-09',
      sale_type: 'vatable',
      total_amount: 98000,
      account_receivables: 98000,
      vat_amount: 10500,
      vatable_sales: 87500,
      zero_rated_sales: 0,
      status: 'pending',
      remarks: 'Mechanical installation',
      items: [],
      created_by: 1,
      updated_at: nowIso(),
    },
    {
      id: 103,
      invoice_number: '000103',
      customer_name: 'Prime Utility Services',
      customer_address: 'Cainta, Rizal',
      invoice_date: '2026-03-19',
      sale_type: 'zero_rated',
      total_amount: 56000,
      account_receivables: 56000,
      vat_amount: 0,
      vatable_sales: 0,
      zero_rated_sales: 56000,
      status: 'approved',
      remarks: 'Maintenance package',
      items: [],
      created_by: 1,
      updated_at: nowIso(),
    },
  ],
  cashVouchers: [
    {
      id: 101,
      voucher_number: 'CV-000101',
      voucher_date: '2026-04-02',
      transaction_type: 'debit',
      company_payee_payor: 'Metro Hardware Depot',
      cash_source: 'Main Cash',
      invoice_number: 'INV-4401',
      po_number: 'PO-1001',
      dr_amount: 8500,
      cr_amount: 0,
      total_amount: 8500,
      status: 'approved',
      remarks: 'Construction supplies',
      line_items: [
        { id: 'cv-101-1', description: 'Plywood and nails', reference: 'OR-441', amount: 8500, with_copy: true },
      ],
      line_items_count: 1,
      with_copy_count: 1,
      proof_documents_json: '[]',
      updated_at: nowIso(),
    },
    {
      id: 102,
      voucher_number: 'CV-000102',
      voucher_date: '2026-04-11',
      transaction_type: 'credit',
      company_payee_payor: 'Cash Return Adjustment',
      cash_source: 'Main Cash',
      invoice_number: '',
      po_number: '',
      dr_amount: 0,
      cr_amount: 2500,
      total_amount: 2500,
      status: 'pending',
      remarks: 'Unused cash return',
      line_items: [
        { id: 'cv-102-1', description: 'Cash return', reference: 'ADJ-11', amount: 2500, with_copy: false },
      ],
      line_items_count: 1,
      with_copy_count: 0,
      proof_documents_json: '[]',
      updated_at: nowIso(),
    },
  ],
  checkVouchers: [
    {
      id: 101,
      voucher_number: 'CHK-000101',
      voucher_date: '2026-04-06',
      transaction_type: 'debit',
      company_payee_payor: 'South Grid Electric',
      bank_check_no: 'BPI-220991',
      bank_deposited: 'BPI Main',
      dr_amount: 42000,
      cr_amount: 0,
      total_amount: 42000,
      status: 'approved',
      remarks: 'Utility disbursement',
      line_items: [
        { id: 'chk-101-1', po_number: '', si_number: 'SI-7791', dr_number: '', qi_number: '', remark: 'March electric bill', includeInExpenses: true, with_copy: true, amount: 42000 },
      ],
      line_items_count: 1,
      with_copy_count: 1,
      proof_documents_json: '[]',
      updated_at: nowIso(),
    },
    {
      id: 102,
      voucher_number: 'CHK-000102',
      voucher_date: '2026-04-14',
      transaction_type: 'debit',
      company_payee_payor: 'Solid Rentals Co.',
      bank_check_no: 'BDO-882172',
      bank_deposited: 'BDO Ortigas',
      dr_amount: 28000,
      cr_amount: 0,
      total_amount: 28000,
      status: 'pending',
      remarks: 'Equipment rental',
      line_items: [
        { id: 'chk-102-1', po_number: 'PO-5511', si_number: 'SI-5521', dr_number: '', qi_number: '', remark: 'Backhoe rental', includeInExpenses: true, with_copy: false, amount: 28000 },
      ],
      line_items_count: 1,
      with_copy_count: 0,
      proof_documents_json: '[]',
      updated_at: nowIso(),
    },
  ],
  pettyCashVouchers: [
    {
      id: 101,
      voucher_number: 'PCV-000101',
      voucher_date: '2026-04-01',
      account_classification: 'Office Supplies Expense',
      company_supplier: 'Paper Depot',
      particulars: 'Printer ink and bond paper',
      amount_vat: 1320,
      amount_non_vat: 0,
      total_amount: 1320,
      status: 'approved',
      line_items: [
        { id: 'pcv-101-1', account_id: 1, company_supplier: 'Paper Depot', particulars: 'Printer ink', amount: 820, vat_type: 'VAT', includeInExpenses: true, reference: 'OR-2201' },
        { id: 'pcv-101-2', account_id: 1, company_supplier: 'Paper Depot', particulars: 'Bond paper', amount: 500, vat_type: 'VAT', includeInExpenses: true, reference: 'OR-2202' },
      ],
      line_items_count: 2,
      with_copy_count: 0,
      proof_documents_json: '[]',
      updated_at: nowIso(),
    },
    {
      id: 102,
      voucher_number: 'PCV-000102',
      voucher_date: '2026-04-08',
      account_classification: 'Transportation Expense',
      company_supplier: 'RidePlus',
      particulars: 'Site visit transportation',
      amount_vat: 0,
      amount_non_vat: 1950,
      total_amount: 1950,
      status: 'pending',
      line_items: [
        { id: 'pcv-102-1', account_id: 2, company_supplier: 'RidePlus', particulars: 'Transport allowances', amount: 1950, vat_type: 'Non-VAT', includeInExpenses: true, reference: 'REC-9341' },
      ],
      line_items_count: 1,
      with_copy_count: 0,
      proof_documents_json: '[]',
      updated_at: nowIso(),
    },
    {
      id: 103,
      voucher_number: 'PCV-000103',
      voucher_date: '2026-03-27',
      account_classification: 'Miscellaneous Expense',
      company_supplier: 'CityMart',
      particulars: 'Emergency consumables',
      amount_vat: 340,
      amount_non_vat: 680,
      total_amount: 1020,
      status: 'cancelled',
      line_items: [
        { id: 'pcv-103-1', account_id: 8, company_supplier: 'CityMart', particulars: 'Misc supplies', amount: 1020, vat_type: 'Mixed', includeInExpenses: false, reference: 'OR-9981' },
      ],
      line_items_count: 1,
      with_copy_count: 0,
      proof_documents_json: '[]',
      updated_at: nowIso(),
    },
  ],
  expenses: [
    {
      id: 1,
      date: '2026-04-05',
      account_classification: 'Office Supplies Expense',
      company_supplier: 'Stationery Hub',
      address: 'Antipolo City',
      tin: '102-555-100-000',
      or_ci_si: 'OR-7011',
      particulars: 'Folders and filing materials',
      vat_amount: 210,
      non_vat_amount: 0,
      total_amount: 210,
      voucher_type: 'Expense',
      voucher_number: 'EXP-1',
      proof_documents_json: '[]',
      updated_at: nowIso(),
    },
    {
      id: 2,
      date: '2026-04-10',
      account_classification: 'Fuel and Oil',
      company_supplier: 'Shell EDSA',
      address: 'Quezon City',
      tin: '101-200-300-000',
      or_ci_si: 'OR-7120',
      particulars: 'Service vehicle fuel',
      vat_amount: 0,
      non_vat_amount: 1850,
      total_amount: 1850,
      voucher_type: 'Expense',
      voucher_number: 'EXP-2',
      proof_documents_json: '[]',
      updated_at: nowIso(),
    },
    {
      id: 3,
      date: '2026-03-22',
      account_classification: 'Communication Expense',
      company_supplier: 'TechNet',
      address: 'Pasig City',
      tin: '202-010-550-000',
      or_ci_si: 'SI-8812',
      particulars: 'Mobile data subscriptions',
      vat_amount: 360,
      non_vat_amount: 0,
      total_amount: 360,
      voucher_type: 'Expense',
      voucher_number: 'EXP-3',
      proof_documents_json: '[]',
      updated_at: nowIso(),
    },
  ],
  vales: [
    {
      id: 1,
      vale_number: 'VAL-0001',
      employee_uid: 2,
      employee_id_number: '1002',
      employee_name: 'Juan Dela Cruz',
      vale_type: 'regular_cash_advance',
      principal_amount: 5000,
      installment_per_cutoff: 500,
      terms_cutoffs: 10,
      disbursement_date: '2026-03-15',
      first_deduction_date: '2026-03-30',
      status: 'approved',
      remarks: 'School enrollment support',
      payments: [
        { id: 1, payment_date: '2026-03-30', amount: 500, remarks: 'Payroll deduction' },
        { id: 2, payment_date: '2026-04-15', amount: 500, remarks: 'Payroll deduction' },
        { id: 3, payment_date: '2026-04-30', amount: 500, remarks: 'Payroll deduction' },
      ],
      proof_documents_json: '[]',
      updated_at: nowIso(),
    },
    {
      id: 2,
      vale_number: 'VAL-0002',
      employee_uid: 4,
      employee_id_number: '1004',
      employee_name: 'Mark Javier',
      vale_type: 'salary_loan',
      principal_amount: 8000,
      installment_per_cutoff: 800,
      terms_cutoffs: 10,
      disbursement_date: '2026-02-28',
      first_deduction_date: '2026-03-15',
      status: 'fully_paid',
      remarks: 'Medical loan',
      payments: [
        { id: 4, payment_date: '2026-03-15', amount: 800, remarks: 'Payroll deduction' },
        { id: 5, payment_date: '2026-03-30', amount: 800, remarks: 'Payroll deduction' },
        { id: 6, payment_date: '2026-04-15', amount: 6400, remarks: 'Full settlement' },
      ],
      proof_documents_json: '[]',
      updated_at: nowIso(),
    },
    {
      id: 3,
      vale_number: 'VAL-0003',
      employee_uid: 6,
      employee_id_number: '1006',
      employee_name: 'Chris Mendoza',
      vale_type: 'regular_cash_advance',
      principal_amount: 3000,
      installment_per_cutoff: 300,
      terms_cutoffs: 10,
      disbursement_date: '2026-04-01',
      first_deduction_date: '2026-04-15',
      status: 'pending',
      remarks: 'Family emergency',
      payments: [],
      proof_documents_json: '[]',
      updated_at: nowIso(),
    },
  ],
  providers: [
    { id: 1, provider_name: 'Meralco', category: 'electricity', is_active: true, updated_at: nowIso() },
    { id: 2, provider_name: 'Manila Water', category: 'water', is_active: true, updated_at: nowIso() },
    { id: 3, provider_name: 'PLDT', category: 'communications', is_active: true, updated_at: nowIso() },
    { id: 4, provider_name: 'Globe', category: 'communications', is_active: true, updated_at: nowIso() },
    { id: 5, provider_name: 'Landlord Rental', category: 'rental', is_active: true, updated_at: nowIso() },
  ],
  monthlyBills: [
    {
      id: 1,
      month: 4,
      year: 2026,
      billing_period_start: '2026-04-01',
      billing_period_end: '2026-04-30',
      status: 'pending',
      prepared_by: 'FPD Demo Admin',
      remarks: 'April recurring bills',
      proof_documents_json: '[]',
      items: [
        { id: 1, provider_id: 1, provider_name: 'Meralco', category: 'electricity', amount: 12000, due_date: '2026-04-10', description: 'Main office electric bill' },
        { id: 2, provider_id: 2, provider_name: 'Manila Water', category: 'water', amount: 4300, due_date: '2026-04-12', description: 'Water bill' },
        { id: 3, provider_id: 3, provider_name: 'PLDT', category: 'communications', amount: 3500, due_date: '2026-04-19', description: 'Internet and phone' },
        { id: 4, provider_id: 5, provider_name: 'Landlord Rental', category: 'rental', amount: 22000, due_date: '2026-04-25', description: 'Office rent' },
      ],
      updated_at: nowIso(),
    },
    {
      id: 2,
      month: 3,
      year: 2026,
      billing_period_start: '2026-03-01',
      billing_period_end: '2026-03-31',
      status: 'paid',
      prepared_by: 'FPD Demo Admin',
      remarks: 'March recurring bills',
      proof_documents_json: '[]',
      items: [
        { id: 5, provider_id: 1, provider_name: 'Meralco', category: 'electricity', amount: 10900, due_date: '2026-03-09', description: 'Main office electric bill', is_paid: true },
        { id: 6, provider_id: 2, provider_name: 'Manila Water', category: 'water', amount: 4000, due_date: '2026-03-12', description: 'Water bill', is_paid: true },
        { id: 7, provider_id: 3, provider_name: 'PLDT', category: 'communications', amount: 3400, due_date: '2026-03-18', description: 'Internet and phone', is_paid: true },
      ],
      payment_date: '2026-03-28',
      payment_method: 'Bank transfer',
      paid_by: 'FPD Demo Admin',
      updated_at: nowIso(),
    },
  ],
  payrollCheckingRecords: [
    {
      id: 1,
      cutoff_date: '2026-04-15',
      cutoff_period: '1st',
      gross_payroll: 185000,
      adjustment_cash: 0,
      petty_cash_replenishment: 50000,
      canteen: 7000,
      monthly_bills_total: 24000,
      additional_fees: [{ id: 1, label: 'Government Fees', amount: 2500 }],
      reimbursements: [{ id: 1, label: 'Vehicle fuel reimbursement', amount: 1800 }],
      status: 'draft',
      remarks: 'Prepared for approval',
      created_by: 1,
      updated_at: nowIso(),
    },
    {
      id: 2,
      cutoff_date: '2026-03-30',
      cutoff_period: '2nd',
      gross_payroll: 176500,
      adjustment_cash: 1200,
      petty_cash_replenishment: 50000,
      canteen: 7000,
      monthly_bills_total: 18300,
      additional_fees: [{ id: 2, label: 'ATM Charges', amount: 980 }],
      reimbursements: [],
      status: 'approved',
      remarks: 'Released to cashier',
      created_by: 1,
      updated_at: nowIso(),
    },
  ],
  cashRequests: [
    {
      id: 1,
      request_number: 'CR-0001',
      cutoff_date: '2026-04-15',
      cutoff_period: '1st',
      adj_net_payroll: 160000,
      petty_cash_replenishment: 50000,
      canteen: 7000,
      monthly_bills_total: 24000,
      reimbursements: [{ id: 1, label: 'Fuel reimbursement', amount: 1800 }],
      remarks: 'For scheduled disbursement',
      requested_by: 1,
      status: 'submitted',
      updated_at: nowIso(),
    },
    {
      id: 2,
      request_number: 'CR-0002',
      cutoff_date: '2026-03-30',
      cutoff_period: '2nd',
      adj_net_payroll: 154000,
      petty_cash_replenishment: 50000,
      canteen: 7000,
      monthly_bills_total: 18300,
      reimbursements: [],
      remarks: 'Released request',
      requested_by: 1,
      status: 'released',
      updated_at: nowIso(),
    },
  ],
  pettyCashBudget: {
    beginning_balance: 250000,
    replenished_amount: 50000,
  },
  payrollCache: {},
  pushSubscriptions: [],
});

const normalizeStore = (input) => {
  const base = createInitialStore();
  const merged = {
    ...base,
    ...(input || {}),
    counters: { ...base.counters, ...(input?.counters || {}) },
  };

  merged.chartOfAccounts = Array.isArray(merged.chartOfAccounts) ? merged.chartOfAccounts : base.chartOfAccounts;
  merged.employees = Array.isArray(merged.employees) ? merged.employees : base.employees;
  merged.customers = Array.isArray(merged.customers) ? merged.customers : base.customers;
  merged.invoices = Array.isArray(merged.invoices) ? merged.invoices : base.invoices;
  merged.cashVouchers = Array.isArray(merged.cashVouchers) ? merged.cashVouchers : base.cashVouchers;
  merged.checkVouchers = Array.isArray(merged.checkVouchers) ? merged.checkVouchers : base.checkVouchers;
  merged.pettyCashVouchers = Array.isArray(merged.pettyCashVouchers) ? merged.pettyCashVouchers : base.pettyCashVouchers;
  merged.expenses = Array.isArray(merged.expenses) ? merged.expenses : base.expenses;
  merged.vales = Array.isArray(merged.vales) ? merged.vales : base.vales;
  merged.providers = Array.isArray(merged.providers) ? merged.providers : base.providers;
  merged.monthlyBills = Array.isArray(merged.monthlyBills) ? merged.monthlyBills : base.monthlyBills;
  merged.payrollCheckingRecords = Array.isArray(merged.payrollCheckingRecords) ? merged.payrollCheckingRecords : base.payrollCheckingRecords;
  merged.cashRequests = Array.isArray(merged.cashRequests) ? merged.cashRequests : base.cashRequests;
  merged.pettyCashBudget = {
    beginning_balance: toNumber(merged.pettyCashBudget?.beginning_balance, base.pettyCashBudget.beginning_balance),
    replenished_amount: toNumber(merged.pettyCashBudget?.replenished_amount, base.pettyCashBudget.replenished_amount),
  };
  merged.payrollCache = typeof merged.payrollCache === 'object' && merged.payrollCache ? merged.payrollCache : {};
  merged.pushSubscriptions = Array.isArray(merged.pushSubscriptions) ? merged.pushSubscriptions : [];

  merged.cashVouchers = merged.cashVouchers.map((voucher) => normalizeCashOrCheckVoucher(voucher, 'cash'));
  merged.checkVouchers = merged.checkVouchers.map((voucher) => normalizeCashOrCheckVoucher(voucher, 'check'));
  merged.pettyCashVouchers = merged.pettyCashVouchers.map((voucher) => normalizePettyCashVoucher(voucher));
  merged.monthlyBills = merged.monthlyBills.map((bill) => normalizeBill(bill));
  merged.vales = merged.vales.map((vale) => normalizeVale(vale));
  merged.payrollCheckingRecords = merged.payrollCheckingRecords.map((record) => normalizeCheckingRecord(record));
  merged.cashRequests = merged.cashRequests.map((record) => normalizeCashRequest(record));

  return merged;
};

const loadStore = () => {
  if (typeof window === 'undefined') {
    return normalizeStore(null);
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return normalizeStore(null);
    }
    return normalizeStore(JSON.parse(raw));
  } catch {
    return normalizeStore(null);
  }
};

let store = loadStore();

const persistStore = () => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore storage quota issues in demo mode
  }
};

const nextId = (counterKey) => {
  const current = toNumber(store.counters[counterKey], 0) + 1;
  store.counters[counterKey] = current;
  return current;
};

const getEmployeeByUid = (uid) => {
  const key = String(uid || '');
  return store.employees.find((employee) => String(employee.uid) === key || String(employee.id) === key) || null;
};

const getEmployeeByIdNumber = (idNumber) => {
  const key = String(idNumber || '').trim();
  if (!key) return null;
  return store.employees.find((employee) => String(employee.id_number || '').trim() === key) || null;
};

const getNextVoucherNumber = (prefix) => {
  const source = [...store.cashVouchers, ...store.checkVouchers, ...store.pettyCashVouchers];
  const needle = `${prefix}-`;
  const max = source.reduce((acc, voucher) => {
    const number = String(voucher.voucher_number || '').toUpperCase();
    if (!number.startsWith(needle)) return acc;
    const seq = Number(number.replace(needle, ''));
    if (!Number.isFinite(seq)) return acc;
    return Math.max(acc, seq);
  }, 0);
  return `${prefix}-${formatSequence(max + 1)}`;
};

const filterByMonthYear = (list, dateField, params = {}) => {
  const selectedMonth = params.month;
  const selectedYear = params.year;

  return list.filter((item) => {
    const dateValue = item?.[dateField];
    if (!dateValue) return false;
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return false;

    const monthOk = selectedMonth === undefined || selectedMonth === null || selectedMonth === 'all'
      ? true
      : date.getMonth() + 1 === Number(selectedMonth);

    const yearOk = selectedYear === undefined || selectedYear === null || selectedYear === 'all'
      ? true
      : date.getFullYear() === Number(selectedYear);

    return monthOk && yearOk;
  });
};

const applySearch = (list, query, fields) => {
  const needle = String(query || '').trim().toLowerCase();
  if (!needle) return list;
  return list.filter((item) =>
    fields.some((field) => String(item?.[field] || '').toLowerCase().includes(needle)),
  );
};

const getMonthlyTrends = (list, dateField, amountField) => {
  const grouped = new Map();
  list.forEach((item) => {
    const date = new Date(item?.[dateField]);
    if (Number.isNaN(date.getTime())) return;
    const key = `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
    const prev = grouped.get(key) || 0;
    grouped.set(key, prev + toNumber(item?.[amountField], 0));
  });

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([key, total]) => ({
      month: key,
      total: Number(total.toFixed(2)),
    }));
};

const buildDashboardData = () => {
  const invoices = store.invoices;
  const activePetty = store.pettyCashVouchers.filter((voucher) => voucher.status !== 'cancelled');
  const activeVales = store.vales.map((vale) => normalizeVale(vale));
  const monthlyBills = store.monthlyBills;

  const salesTotal = invoices.reduce((sum, invoice) => sum + toNumber(invoice.total_amount, 0), 0);
  const vatableSales = invoices.reduce((sum, invoice) => sum + toNumber(invoice.vatable_sales, 0), 0);
  const vatAmount = invoices.reduce((sum, invoice) => sum + toNumber(invoice.vat_amount, 0), 0);
  const zeroRated = invoices.reduce((sum, invoice) => sum + toNumber(invoice.zero_rated_sales, 0), 0);

  const allVouchers = [...store.cashVouchers, ...store.checkVouchers];
  const vouchersTotalAmount = allVouchers.reduce((sum, voucher) => sum + toNumber(voucher.total_amount, 0), 0);

  const valesPending = activeVales.filter((vale) => vale.status === 'pending').length;
  const valesApproved = activeVales.filter((vale) => vale.status === 'approved').length;
  const valesDefaulted = activeVales.filter((vale) => vale.status === 'defaulted').length;
  const valesFullyPaid = activeVales.filter((vale) => vale.status === 'fully_paid').length;

  const monthlyBillsTotal = monthlyBills.reduce((sum, bill) => sum + toNumber(bill.net_total, 0), 0);
  const monthlyBillsPaid = monthlyBills
    .filter((bill) => bill.status === 'paid')
    .reduce((sum, bill) => sum + toNumber(bill.net_total, 0), 0);
  const monthlyBillsPending = monthlyBillsTotal - monthlyBillsPaid;

  const pettyExpenses = activePetty.reduce((sum, voucher) => sum + toNumber(voucher.total_amount, 0), 0);

  return {
    dashboardSummary: {
      generated_at: nowIso(),
      invoices_total: invoices.length,
      vouchers_total: allVouchers.length,
      petty_cash_total: activePetty.length,
      vales_total: activeVales.length,
      monthly_bills_total: monthlyBills.length,
    },
    salesInvoices: {
      total: invoices.length,
      totalAmount: Number(salesTotal.toFixed(2)),
      totalVatableSales: Number(vatableSales.toFixed(2)),
      totalVat: Number(vatAmount.toFixed(2)),
      totalZeroRated: Number(zeroRated.toFixed(2)),
      chart: getMonthlyTrends(invoices, 'invoice_date', 'total_amount'),
    },
    expenses: {
      total: Number(pettyExpenses.toFixed(2)),
      monthly: Number(pettyExpenses.toFixed(2)),
      count: activePetty.length,
      chart: getMonthlyTrends(activePetty, 'voucher_date', 'total_amount'),
    },
    vouchers: {
      total: allVouchers.length,
      approved: allVouchers.filter((voucher) => voucher.status === 'approved').length,
      pending: allVouchers.filter((voucher) => voucher.status === 'pending').length,
      rejected: allVouchers.filter((voucher) => voucher.status === 'rejected').length,
      totalAmount: Number(vouchersTotalAmount.toFixed(2)),
      chart: getMonthlyTrends(allVouchers, 'voucher_date', 'total_amount'),
    },
    vales: {
      total: activeVales.length,
      pending: valesPending,
      approved: valesApproved,
      active: activeVales.filter((vale) => ['pending', 'approved'].includes(vale.status) && vale.balance_amount > 0).length,
      fullyPaid: valesFullyPaid,
      defaulted: valesDefaulted,
      totalAmount: Number(activeVales.reduce((sum, vale) => sum + toNumber(vale.principal_amount, 0), 0).toFixed(2)),
      totalOutstanding: Number(activeVales.reduce((sum, vale) => sum + toNumber(vale.balance_amount, 0), 0).toFixed(2)),
      activeBalance: Number(activeVales.filter((vale) => ['pending', 'approved'].includes(vale.status)).reduce((sum, vale) => sum + toNumber(vale.balance_amount, 0), 0).toFixed(2)),
    },
    monthlyBills: {
      total: monthlyBills.length,
      paid: monthlyBills.filter((bill) => bill.status === 'paid').length,
      pending: monthlyBills.filter((bill) => bill.status !== 'paid').length,
      totalAmount: Number(monthlyBillsTotal.toFixed(2)),
      paidAmount: Number(monthlyBillsPaid.toFixed(2)),
      pendingAmount: Number(monthlyBillsPending.toFixed(2)),
    },
  };
};

const socketListeners = new Map();

const socketService = {
  subscribeToUpdates(event, callback) {
    if (!socketListeners.has(event)) {
      socketListeners.set(event, new Set());
    }
    const listeners = socketListeners.get(event);
    listeners.add(callback);

    return () => {
      listeners.delete(callback);
      if (listeners.size === 0) {
        socketListeners.delete(event);
      }
    };
  },

  emit(event, payload) {
    const listeners = socketListeners.get(event);
    if (!listeners) return;
    listeners.forEach((listener) => {
      try {
        listener(payload);
      } catch {
        // ignore individual callback errors in demo mode
      }
    });
  },

  initialize() {},
  disconnect() {
    socketListeners.clear();
  },
};

const financeService = {
  async request(path, options = {}) {
    const method = String(options.method || 'GET').toUpperCase();
    const body = parseBody(options.body);
    const url = new URL(path, 'http://localhost');

    if (url.pathname === '/api/finance-payroll/chart-of-accounts') {
      return respond({ success: true, accounts: store.chartOfAccounts });
    }

    if (url.pathname === '/api/finance-payroll/invoices/validate-number') {
      const number = String(url.searchParams.get('number') || '').trim();
      const exists = store.invoices.some((invoice) => String(invoice.invoice_number || '').toLowerCase() === number.toLowerCase());
      return respond({ available: !exists });
    }

    if (url.pathname === '/api/finance-payroll/petty-cash-vouchers' && url.searchParams.get('action') === 'next-voucher-number') {
      return respond({ voucher_number: getNextVoucherNumber('PCV') });
    }

    if (url.pathname === '/api/finance-payroll/petty-cash-budget') {
      if (method === 'POST') {
        const action = String(body.action || '').toLowerCase();
        if (action === 'set_beginning') {
          store.pettyCashBudget.beginning_balance = toNumber(body.amount, store.pettyCashBudget.beginning_balance);
        } else if (action === 'replenish') {
          store.pettyCashBudget.replenished_amount += toNumber(body.amount, 0);
        }
        persistStore();
      }

      const month = url.searchParams.get('month');
      const year = url.searchParams.get('year');
      const filtered = filterByMonthYear(
        store.pettyCashVouchers.filter((voucher) => voucher.status !== 'cancelled'),
        'voucher_date',
        { month: month || 'all', year: year || 'all' },
      );
      const totalExpenses = filtered.reduce((sum, voucher) => sum + toNumber(voucher.total_amount, 0), 0);
      const totalBudget =
        toNumber(store.pettyCashBudget.beginning_balance, 0) +
        toNumber(store.pettyCashBudget.replenished_amount, 0);

      return respond({
        success: true,
        data: {
          beginning_balance: store.pettyCashBudget.beginning_balance,
          replenished_amount: store.pettyCashBudget.replenished_amount,
          total_budget: Number(totalBudget.toFixed(2)),
          total_expenses: Number(totalExpenses.toFixed(2)),
          current_balance: Number((totalBudget - totalExpenses).toFixed(2)),
        },
      });
    }

    const importVoucherRoute = (type, incomingRows = []) => {
      const rows = Array.isArray(incomingRows) ? incomingRows : [];
      const skippedDetails = [];
      let imported = 0;
      let updated = 0;
      let skipped = 0;

      rows.forEach((row, index) => {
        const existingNumber = String(row?.voucher_number || '').trim();
        if (!existingNumber) {
          skipped += 1;
          skippedDetails.push({ row: index + 1, reason: 'voucher_number is required' });
          return;
        }

        if (type === 'cash') {
          const idx = store.cashVouchers.findIndex(
            (voucher) => String(voucher.voucher_number).toLowerCase() === existingNumber.toLowerCase(),
          );
          const normalized = normalizeCashOrCheckVoucher({
            ...row,
            id: idx >= 0 ? store.cashVouchers[idx].id : nextId('cashVoucher'),
            voucher_number: existingNumber,
          }, 'cash');

          if (idx >= 0) {
            store.cashVouchers[idx] = normalized;
            updated += 1;
          } else {
            store.cashVouchers.push(normalized);
            imported += 1;
          }
        }

        if (type === 'check') {
          const idx = store.checkVouchers.findIndex(
            (voucher) => String(voucher.voucher_number).toLowerCase() === existingNumber.toLowerCase(),
          );
          const normalized = normalizeCashOrCheckVoucher({
            ...row,
            id: idx >= 0 ? store.checkVouchers[idx].id : nextId('checkVoucher'),
            voucher_number: existingNumber,
          }, 'check');

          if (idx >= 0) {
            store.checkVouchers[idx] = normalized;
            updated += 1;
          } else {
            store.checkVouchers.push(normalized);
            imported += 1;
          }
        }

        if (type === 'petty') {
          const idx = store.pettyCashVouchers.findIndex(
            (voucher) => String(voucher.voucher_number).toLowerCase() === existingNumber.toLowerCase(),
          );
          const normalized = normalizePettyCashVoucher({
            ...row,
            id: idx >= 0 ? store.pettyCashVouchers[idx].id : nextId('pettyCashVoucher'),
            voucher_number: existingNumber,
          });

          if (idx >= 0) {
            store.pettyCashVouchers[idx] = normalized;
            updated += 1;
          } else {
            store.pettyCashVouchers.push(normalized);
            imported += 1;
          }
        }
      });

      persistStore();

      return {
        success: true,
        data: {
          stats: { imported, updated, skipped },
          skipped_details: skippedDetails,
        },
      };
    };

    if (url.pathname === '/api/finance-payroll/cash-vouchers/import' && method === 'POST') {
      return respond(importVoucherRoute('cash', body.vouchers));
    }

    if (url.pathname === '/api/finance-payroll/check-vouchers/import' && method === 'POST') {
      return respond(importVoucherRoute('check', body.vouchers));
    }

    if (url.pathname === '/api/finance-payroll/petty-cash-vouchers/import' && method === 'POST') {
      return respond(importVoucherRoute('petty', body.vouchers));
    }

    return respond({ success: true, data: {} });
  },

  async getDashboardData() {
    return respond(buildDashboardData());
  },

  async getCustomers() {
    return respond({ customers: store.customers });
  },

  async getCustomer(customerId) {
    const customer = store.customers.find((row) => Number(row.id) === Number(customerId));
    if (!customer) return rejectWith('Customer not found');
    return respond({ customer });
  },

  async createCustomer(payload) {
    const customerName = String(payload?.customer_name || payload?.name || '').trim();
    if (!customerName) return rejectWith('Customer name is required');

    const customer = {
      id: nextId('customer'),
      customer_name: customerName,
      customer_address: payload.customer_address || payload.address || '',
      customer_tin: payload.customer_tin || payload.tin || '',
      remarks: payload.remarks || '',
      created_by: payload.created_by || null,
      updated_at: nowIso(),
    };

    store.customers.push(customer);
    persistStore();
    return respond({ success: true, customer });
  },

  async updateCustomer(customerId, payload) {
    const idx = store.customers.findIndex((row) => Number(row.id) === Number(customerId));
    if (idx < 0) return rejectWith('Customer not found');

    store.customers[idx] = {
      ...store.customers[idx],
      ...payload,
      updated_at: nowIso(),
    };

    persistStore();
    return respond({ success: true, customer: store.customers[idx] });
  },

  async deleteCustomer(customerId) {
    const before = store.customers.length;
    store.customers = store.customers.filter((row) => Number(row.id) !== Number(customerId));
    if (store.customers.length === before) return rejectWith('Customer not found');
    persistStore();
    return respond({ success: true });
  },

  async getInvoices(filters = {}) {
    let list = store.invoices.map((invoice) => ({
      ...invoice,
      quarter: quarterFromDate(invoice.invoice_date),
    }));

    if (filters.quarter) {
      const selected = String(filters.quarter).toUpperCase();
      list = list.filter((invoice) => String(invoice.quarter || '').toUpperCase() === selected);
    }

    list = list.sort((a, b) => new Date(b.invoice_date).getTime() - new Date(a.invoice_date).getTime());

    return respond({ invoices: list });
  },

  async createInvoice(payload) {
    const numberInput = String(payload?.invoice_number || '').trim();
    const invoiceNumber = numberInput || formatSequence(nextId('invoice'));

    const exists = store.invoices.some(
      (invoice) => String(invoice.invoice_number || '').toLowerCase() === invoiceNumber.toLowerCase(),
    );
    if (exists) {
      return rejectWith(`Invoice number ${invoiceNumber} already exists`);
    }

    const totalAmount = toNumber(payload.total_amount ?? payload.account_receivables, 0);
    const saleType = String(payload.sale_type || (payload.zero_rated_sales ? 'zero_rated' : 'vatable')).toLowerCase();

    const vatAmount = payload.vat_amount != null
      ? toNumber(payload.vat_amount, 0)
      : saleType === 'vatable'
      ? Number((totalAmount * 0.12 / 1.12).toFixed(2))
      : 0;

    const vatableSales = payload.vatable_sales != null
      ? toNumber(payload.vatable_sales, 0)
      : saleType === 'vatable'
      ? Number((totalAmount - vatAmount).toFixed(2))
      : 0;

    const zeroRatedSales = payload.zero_rated_sales != null
      ? toNumber(payload.zero_rated_sales, 0)
      : saleType === 'zero_rated'
      ? totalAmount
      : 0;

    const invoice = {
      id: nextId('invoice'),
      invoice_number: invoiceNumber,
      customer_name: payload.customer_name || payload.customer || 'Walk-in Client',
      customer_address: payload.customer_address || '',
      customer_tin: payload.customer_tin || '',
      invoice_date: payload.invoice_date || today(),
      sale_type: saleType,
      total_amount: totalAmount,
      account_receivables: totalAmount,
      vat_amount: vatAmount,
      vatable_sales: vatableSales,
      zero_rated_sales: zeroRatedSales,
      status: String(payload.status || 'pending').toLowerCase(),
      payment_terms: payload.payment_terms || '',
      remarks: payload.remarks || '',
      items: Array.isArray(payload.items) ? payload.items : [],
      created_by: payload.created_by || null,
      updated_at: nowIso(),
    };

    store.invoices.push(invoice);
    persistStore();
    socketService.emit('finance:invoice_created', { invoice });
    return respond({ success: true, invoice });
  },

  async updateInvoice(invoiceId, payload) {
    const idx = store.invoices.findIndex((invoice) => Number(invoice.id) === Number(invoiceId));
    if (idx < 0) return rejectWith('Invoice not found');

    const current = store.invoices[idx];
    const saleType = String(payload.sale_type || current.sale_type || 'vatable').toLowerCase();
    const totalAmount = toNumber(payload.total_amount ?? payload.account_receivables ?? current.total_amount, current.total_amount);

    const vatAmount = payload.vat_amount != null
      ? toNumber(payload.vat_amount, 0)
      : saleType === 'vatable'
      ? Number((totalAmount * 0.12 / 1.12).toFixed(2))
      : 0;

    const vatableSales = payload.vatable_sales != null
      ? toNumber(payload.vatable_sales, 0)
      : saleType === 'vatable'
      ? Number((totalAmount - vatAmount).toFixed(2))
      : 0;

    const zeroRatedSales = payload.zero_rated_sales != null
      ? toNumber(payload.zero_rated_sales, 0)
      : saleType === 'zero_rated'
      ? totalAmount
      : 0;

    store.invoices[idx] = {
      ...current,
      ...payload,
      sale_type: saleType,
      total_amount: totalAmount,
      account_receivables: totalAmount,
      vat_amount: vatAmount,
      vatable_sales: vatableSales,
      zero_rated_sales: zeroRatedSales,
      updated_at: nowIso(),
    };

    persistStore();
    socketService.emit('finance:invoice_updated', { invoice: store.invoices[idx] });
    return respond({ success: true, invoice: store.invoices[idx] });
  },

  async deleteInvoice(invoiceId) {
    const before = store.invoices.length;
    store.invoices = store.invoices.filter((invoice) => Number(invoice.id) !== Number(invoiceId));
    if (store.invoices.length === before) return rejectWith('Invoice not found');
    persistStore();
    socketService.emit('finance:invoice_deleted', { id: invoiceId });
    return respond({ success: true });
  },

  async importInvoices(importedInvoices = []) {
    const rows = Array.isArray(importedInvoices) ? importedInvoices : [];
    const createdInvoices = [];
    const updatedInvoices = [];
    const errors = [];

    rows.forEach((row, index) => {
      try {
        const invoiceNumber = String(row?.invoice_number || '').trim();
        if (!invoiceNumber) {
          errors.push({ row: index + 1, message: 'invoice_number is required' });
          return;
        }

        const idx = store.invoices.findIndex(
          (invoice) => String(invoice.invoice_number || '').toLowerCase() === invoiceNumber.toLowerCase(),
        );

        if (idx >= 0) {
          const merged = {
            ...store.invoices[idx],
            ...row,
          };
          const totalAmount = toNumber(merged.total_amount ?? merged.account_receivables, 0);
          merged.total_amount = totalAmount;
          merged.account_receivables = totalAmount;
          merged.updated_at = nowIso();
          store.invoices[idx] = merged;
          updatedInvoices.push(merged);
        } else {
          const created = {
            id: nextId('invoice'),
            invoice_number: invoiceNumber,
            customer_name: row.customer_name || 'Imported Customer',
            customer_address: row.customer_address || '',
            customer_tin: row.customer_tin || '',
            invoice_date: row.invoice_date || today(),
            sale_type: row.sale_type || 'vatable',
            total_amount: toNumber(row.total_amount ?? row.account_receivables, 0),
            account_receivables: toNumber(row.total_amount ?? row.account_receivables, 0),
            vat_amount: toNumber(row.vat_amount, 0),
            vatable_sales: toNumber(row.vatable_sales, 0),
            zero_rated_sales: toNumber(row.zero_rated_sales, 0),
            status: String(row.status || 'pending').toLowerCase(),
            payment_terms: row.payment_terms || '',
            remarks: row.remarks || '',
            items: Array.isArray(row.items) ? row.items : [],
            created_by: row.created_by || null,
            updated_at: nowIso(),
          };
          store.invoices.push(created);
          createdInvoices.push(created);
        }
      } catch (error) {
        errors.push({ row: index + 1, message: error?.message || 'Import failed' });
      }
    });

    persistStore();
    socketService.emit('finance:invoices_imported', {
      created: createdInvoices.length,
      updated: updatedInvoices.length,
      errors: errors.length,
    });

    return respond({ data: { created_invoices: createdInvoices, updated_invoices: updatedInvoices, errors } });
  },

  async getChartOfAccounts() {
    return respond({ accounts: store.chartOfAccounts });
  },

  async getCashVouchers(params = {}) {
    let list = [...store.cashVouchers];

    if (params.status && params.status !== 'all') {
      list = list.filter((voucher) => String(voucher.status) === String(params.status).toLowerCase());
    }

    list = filterByMonthYear(list, 'voucher_date', params);

    list = applySearch(list, params.search, [
      'voucher_number',
      'company_payee_payor',
      'cash_source',
      'invoice_number',
      'po_number',
      'remarks',
    ]);

    list.sort((a, b) => new Date(b.voucher_date).getTime() - new Date(a.voucher_date).getTime());

    return respond({ data: { vouchers: list } });
  },

  async getCashVoucher(voucherId) {
    const voucher = store.cashVouchers.find((row) => Number(row.id) === Number(voucherId));
    if (!voucher) return rejectWith('Cash voucher not found');
    return respond({ data: voucher });
  },

  async createCashVoucher(payload) {
    const normalized = normalizeCashOrCheckVoucher(
      {
        ...payload,
        id: nextId('cashVoucher'),
        voucher_number: payload.voucher_number || getNextVoucherNumber('CV'),
        created_by: payload.created_by || null,
      },
      'cash',
    );

    store.cashVouchers.push(normalized);
    persistStore();
    socketService.emit('finance:cash_voucher_created', { voucher: normalized });
    return respond({ success: true, data: normalized });
  },

  async updateCashVoucher(voucherId, payload) {
    const idx = store.cashVouchers.findIndex((row) => Number(row.id) === Number(voucherId));
    if (idx < 0) return rejectWith('Cash voucher not found');

    const merged = normalizeCashOrCheckVoucher(
      {
        ...store.cashVouchers[idx],
        ...payload,
      },
      'cash',
    );

    store.cashVouchers[idx] = merged;
    persistStore();
    socketService.emit('finance:cash_voucher_updated', { voucher: merged });
    return respond({ success: true, data: merged });
  },

  async deleteCashVoucher(voucherId) {
    const before = store.cashVouchers.length;
    store.cashVouchers = store.cashVouchers.filter((row) => Number(row.id) !== Number(voucherId));
    if (store.cashVouchers.length === before) return rejectWith('Cash voucher not found');
    persistStore();
    socketService.emit('finance:cash_voucher_deleted', { id: voucherId });
    return respond({ success: true });
  },

  async getNextCashVoucherNumber() {
    return respond({ next_voucher_number: getNextVoucherNumber('CV') });
  },

  async getCheckVouchers(params = {}) {
    let list = [...store.checkVouchers];

    if (params.status && params.status !== 'all') {
      list = list.filter((voucher) => String(voucher.status) === String(params.status).toLowerCase());
    }

    list = filterByMonthYear(list, 'voucher_date', params);

    list = applySearch(list, params.search, [
      'voucher_number',
      'company_payee_payor',
      'bank_check_no',
      'bank_deposited',
      'remarks',
    ]);

    list.sort((a, b) => new Date(b.voucher_date).getTime() - new Date(a.voucher_date).getTime());

    return respond({ data: { vouchers: list } });
  },

  async getCheckVoucher(voucherId) {
    const voucher = store.checkVouchers.find((row) => Number(row.id) === Number(voucherId));
    if (!voucher) return rejectWith('Check voucher not found');
    return respond({ data: voucher });
  },

  async createCheckVoucher(payload) {
    const normalized = normalizeCashOrCheckVoucher(
      {
        ...payload,
        id: nextId('checkVoucher'),
        voucher_number: payload.voucher_number || getNextVoucherNumber('CHK'),
        created_by: payload.created_by || null,
      },
      'check',
    );

    store.checkVouchers.push(normalized);
    persistStore();
    socketService.emit('finance:check_voucher_created', { voucher: normalized });
    return respond({ success: true, data: normalized });
  },

  async createCheckVouchersBulk(payload) {
    const list = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.vouchers)
      ? payload.vouchers
      : [payload];

    const created = [];
    for (const entry of list) {
      const response = await this.createCheckVoucher(entry || {});
      created.push(response.data);
    }
    return respond({ success: true, data: created });
  },

  async updateCheckVoucher(voucherId, payload) {
    const idx = store.checkVouchers.findIndex((row) => Number(row.id) === Number(voucherId));
    if (idx < 0) return rejectWith('Check voucher not found');

    const merged = normalizeCashOrCheckVoucher(
      {
        ...store.checkVouchers[idx],
        ...payload,
      },
      'check',
    );

    store.checkVouchers[idx] = merged;
    persistStore();
    socketService.emit('finance:check_voucher_updated', { voucher: merged });
    return respond({ success: true, data: merged });
  },

  async deleteCheckVoucher(voucherId) {
    const before = store.checkVouchers.length;
    store.checkVouchers = store.checkVouchers.filter((row) => Number(row.id) !== Number(voucherId));
    if (store.checkVouchers.length === before) return rejectWith('Check voucher not found');
    persistStore();
    socketService.emit('finance:check_voucher_deleted', { id: voucherId });
    return respond({ success: true });
  },

  async approveCheckVoucher(voucherId, payload = {}) {
    return this.updateCheckVoucher(voucherId, {
      status: 'approved',
      approved_by: payload?.approved_by || payload?.actor_id || null,
    });
  },

  async cancelCheckVoucher(voucherId, payload = {}) {
    return this.updateCheckVoucher(voucherId, {
      status: 'cancelled',
      cancel_reason: payload?.reason || payload?.cancel_reason || '',
      cancelled_by: payload?.actor_id || null,
    });
  },

  async getNextCheckVoucherNumber() {
    return respond({ next_voucher_number: getNextVoucherNumber('CHK') });
  },

  async getPettyCashVouchers(params = {}) {
    let list = [...store.pettyCashVouchers];

    if (params.status && params.status !== 'all') {
      list = list.filter((voucher) => String(voucher.status) === String(params.status).toLowerCase());
    }

    if (params.vatable_type && params.vatable_type !== 'all') {
      const selectedType = String(params.vatable_type).toLowerCase();
      list = list.filter((voucher) => {
        if (selectedType === 'vat') return toNumber(voucher.amount_vat, 0) > 0;
        if (selectedType === 'non_vat') return toNumber(voucher.amount_non_vat, 0) > 0;
        return true;
      });
    }

    list = filterByMonthYear(list, 'voucher_date', params);

    list = applySearch(list, params.search, [
      'voucher_number',
      'company_supplier',
      'particulars',
      'account_classification',
      'remarks',
    ]);

    list.sort((a, b) => new Date(b.voucher_date).getTime() - new Date(a.voucher_date).getTime());

    return respond({ data: { vouchers: list } });
  },

  async getPettyCashVoucher(voucherId) {
    const voucher = store.pettyCashVouchers.find((row) => Number(row.id) === Number(voucherId));
    if (!voucher) return rejectWith('Petty cash voucher not found');
    return respond({ voucher });
  },

  async createPettyCashVoucher(payload) {
    const normalized = normalizePettyCashVoucher({
      ...payload,
      id: nextId('pettyCashVoucher'),
      voucher_number: payload.voucher_number || getNextVoucherNumber('PCV'),
      created_by: payload.created_by || null,
    });

    store.pettyCashVouchers.push(normalized);
    persistStore();
    socketService.emit('finance:petty_cash_voucher_created', { voucher: normalized });
    return respond({ success: true, voucher: normalized });
  },

  async updatePettyCashVoucher(voucherId, payload) {
    const idx = store.pettyCashVouchers.findIndex((row) => Number(row.id) === Number(voucherId));
    if (idx < 0) return rejectWith('Petty cash voucher not found');

    const merged = normalizePettyCashVoucher({
      ...store.pettyCashVouchers[idx],
      ...payload,
    });

    store.pettyCashVouchers[idx] = merged;
    persistStore();
    socketService.emit('finance:petty_cash_voucher_updated', { voucher: merged });
    return respond({ success: true, voucher: merged });
  },

  async deletePettyCashVoucher(voucherId) {
    const before = store.pettyCashVouchers.length;
    store.pettyCashVouchers = store.pettyCashVouchers.filter((row) => Number(row.id) !== Number(voucherId));
    if (store.pettyCashVouchers.length === before) return rejectWith('Petty cash voucher not found');
    persistStore();
    socketService.emit('finance:petty_cash_voucher_deleted', { id: voucherId });
    return respond({ success: true });
  },

  async approvePettyCashVoucher(voucherId, payload = {}) {
    return this.updatePettyCashVoucher(voucherId, {
      status: 'approved',
      approved_by: payload?.approved_by || payload?.actor_id || null,
    });
  },

  async cancelPettyCashVoucher(voucherId, payload = {}) {
    return this.updatePettyCashVoucher(voucherId, {
      status: 'cancelled',
      cancel_reason: payload?.reason || payload?.cancel_reason || '',
      cancelled_by: payload?.actor_id || null,
    });
  },

  async bulkDeleteVouchers(type, voucherIds = []) {
    const ids = Array.isArray(voucherIds) ? voucherIds.map(Number) : [];

    if (type === 'cash') {
      const before = store.cashVouchers.length;
      store.cashVouchers = store.cashVouchers.filter((voucher) => !ids.includes(Number(voucher.id)));
      const deleted = before - store.cashVouchers.length;
      persistStore();
      return respond({ attempted_count: ids.length, deleted_count: deleted, failed_count: Math.max(0, ids.length - deleted) });
    }

    if (type === 'check') {
      const before = store.checkVouchers.length;
      store.checkVouchers = store.checkVouchers.filter((voucher) => !ids.includes(Number(voucher.id)));
      const deleted = before - store.checkVouchers.length;
      persistStore();
      return respond({ attempted_count: ids.length, deleted_count: deleted, failed_count: Math.max(0, ids.length - deleted) });
    }

    if (type === 'petty-cash' || type === 'petty_cash') {
      const before = store.pettyCashVouchers.length;
      store.pettyCashVouchers = store.pettyCashVouchers.filter((voucher) => !ids.includes(Number(voucher.id)));
      const deleted = before - store.pettyCashVouchers.length;
      persistStore();
      return respond({ attempted_count: ids.length, deleted_count: deleted, failed_count: Math.max(0, ids.length - deleted) });
    }

    return rejectWith('Unsupported voucher type');
  },

  async getExpenseLineItems(params = {}) {
    const direct = store.expenses.map((expense) => ({
      id: `direct-${expense.id}`,
      date: expense.date,
      account_classification: expense.account_classification,
      company_supplier: expense.company_supplier,
      address: expense.address,
      tin: expense.tin,
      or_ci_si: expense.or_ci_si,
      particulars: expense.particulars,
      vat_amount: toNumber(expense.vat_amount, 0),
      non_vat_amount: toNumber(expense.non_vat_amount, 0),
      total_amount: toNumber(expense.total_amount, 0),
      voucher_type: 'Expense',
      voucher_number: expense.voucher_number || `EXP-${expense.id}`,
      proof_documents_json: expense.proof_documents_json || '[]',
    }));

    const checkDerived = store.checkVouchers.flatMap((voucher) =>
      (voucher.line_items || [])
        .filter((item) => Boolean(item.includeInExpenses))
        .map((item, index) => ({
          id: `check-${voucher.id}-${index + 1}`,
          date: voucher.voucher_date,
          account_classification: item.account_classification || 'Check Voucher Expense',
          company_supplier: voucher.company_payee_payor,
          address: '',
          tin: '',
          or_ci_si: item.si_number || item.dr_number || item.reference || '',
          particulars: item.remark || item.description || 'Check voucher line item',
          vat_amount: 0,
          non_vat_amount: toNumber(item.amount, 0),
          total_amount: toNumber(item.amount, 0),
          voucher_type: 'Check Voucher',
          voucher_number: voucher.voucher_number,
          proof_documents_json: voucher.proof_documents_json || '[]',
        })),
    );

    const pettyDerived = store.pettyCashVouchers.flatMap((voucher) =>
      (voucher.line_items || [])
        .filter((item) => Boolean(item.includeInExpenses))
        .map((item, index) => {
          const amount = toNumber(item.amount, 0);
          const vat = String(item.vat_type || '').toLowerCase().includes('vat') ? amount : 0;
          const nonVat = vat > 0 ? 0 : amount;
          return {
            id: `petty-${voucher.id}-${index + 1}`,
            date: voucher.voucher_date,
            account_classification: voucher.account_classification || item.account_classification || 'Petty Cash',
            company_supplier: item.company_supplier || voucher.company_supplier,
            address: '',
            tin: '',
            or_ci_si: item.reference || '',
            particulars: item.particulars || voucher.particulars || 'Petty cash line item',
            vat_amount: vat,
            non_vat_amount: nonVat,
            total_amount: amount,
            voucher_type: 'Petty Cash',
            voucher_number: voucher.voucher_number,
            proof_documents_json: voucher.proof_documents_json || '[]',
          };
        }),
    );

    let lineItems = [...direct, ...checkDerived, ...pettyDerived];

    if (params.month && params.month !== 'all') {
      lineItems = lineItems.filter((item) => new Date(item.date).getMonth() + 1 === Number(params.month));
    }

    if (params.year && params.year !== 'all') {
      lineItems = lineItems.filter((item) => new Date(item.date).getFullYear() === Number(params.year));
    }

    const summary = {
      total_amount: Number(lineItems.reduce((sum, item) => sum + toNumber(item.total_amount, 0), 0).toFixed(2)),
      current_amount: Number(lineItems.reduce((sum, item) => sum + toNumber(item.total_amount, 0), 0).toFixed(2)),
      target_amount: EXPENSE_TARGET_AMOUNT,
      amount_needed: Number(Math.max(0, EXPENSE_TARGET_AMOUNT - lineItems.reduce((sum, item) => sum + toNumber(item.total_amount, 0), 0)).toFixed(2)),
      vat_amount: Number(lineItems.reduce((sum, item) => sum + toNumber(item.vat_amount, 0), 0).toFixed(2)),
      non_vat_amount: Number(lineItems.reduce((sum, item) => sum + toNumber(item.non_vat_amount, 0), 0).toFixed(2)),
      total_count: lineItems.length,
    };

    return respond({ data: { line_items: lineItems, summary } });
  },

  async createExpensesBulk(payload) {
    const rows = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.expenses)
      ? payload.expenses
      : [];

    rows.forEach((row) => {
      const id = nextId('expense');
      store.expenses.push({
        id,
        date: row.date || today(),
        account_classification: row.account_classification || row.accountClassification || '',
        company_supplier: row.company_supplier || row.companySupplier || '',
        address: row.address || '',
        tin: row.tin || '',
        or_ci_si: row.or_ci_si || row.orCiSi || '',
        particulars: row.particulars || '',
        vat_amount: toNumber(row.vat_amount, 0),
        non_vat_amount: toNumber(row.non_vat_amount, 0),
        total_amount: toNumber(row.total_amount, toNumber(row.vat_amount, 0) + toNumber(row.non_vat_amount, 0)),
        voucher_type: 'Expense',
        voucher_number: `EXP-${id}`,
        proof_documents_json: row.proof_documents_json || '[]',
        created_by: row.created_by || null,
        updated_at: nowIso(),
      });
    });

    persistStore();
    return respond({ success: true, created_count: rows.length });
  },

  async updateExpense(rawId, payload) {
    const idx = store.expenses.findIndex((expense) => Number(expense.id) === Number(rawId));
    if (idx < 0) return rejectWith('Expense not found');

    store.expenses[idx] = {
      ...store.expenses[idx],
      ...payload,
      id: store.expenses[idx].id,
      total_amount: toNumber(payload.total_amount, toNumber(payload.vat_amount, 0) + toNumber(payload.non_vat_amount, 0)),
      vat_amount: toNumber(payload.vat_amount, store.expenses[idx].vat_amount),
      non_vat_amount: toNumber(payload.non_vat_amount, store.expenses[idx].non_vat_amount),
      updated_at: nowIso(),
    };

    persistStore();
    return respond({ success: true, expense: store.expenses[idx] });
  },

  async deleteExpense(rawId) {
    const before = store.expenses.length;
    store.expenses = store.expenses.filter((expense) => Number(expense.id) !== Number(rawId));
    if (store.expenses.length === before) return rejectWith('Expense not found');
    persistStore();
    return respond({ success: true });
  },

  async getVales() {
    store.vales = store.vales.map((vale) => normalizeVale(vale));
    persistStore();
    return respond({ vales: store.vales });
  },

  async getVale(valeId) {
    const vale = store.vales.find((entry) => Number(entry.id) === Number(valeId));
    if (!vale) return rejectWith('Vale not found');
    const normalized = normalizeVale(vale);
    return respond({ vale: normalized });
  },

  async createVale(payload) {
    const employee = getEmployeeByUid(payload.employee_uid) || getEmployeeByIdNumber(payload.employee_id_number);

    const vale = normalizeVale({
      ...payload,
      id: nextId('vale'),
      vale_number: payload.vale_number || `VAL-${formatSequence(nextId('vale'))}`,
      employee_uid: payload.employee_uid || employee?.uid || null,
      employee_id_number: payload.employee_id_number || employee?.id_number || '',
      employee_name: payload.employee_name || employee?.employee_name || 'Unknown Employee',
      status: payload.status || 'pending',
      payments: [],
      created_by: payload.created_by || null,
      updated_at: nowIso(),
    });

    store.vales.push(vale);
    persistStore();
    return respond({ success: true, vale });
  },

  async updateVale(valeId, payload) {
    const idx = store.vales.findIndex((entry) => Number(entry.id) === Number(valeId));
    if (idx < 0) return rejectWith('Vale not found');

    const employee = getEmployeeByUid(payload.employee_uid) || getEmployeeByIdNumber(payload.employee_id_number);

    store.vales[idx] = normalizeVale({
      ...store.vales[idx],
      ...payload,
      employee_uid: payload.employee_uid || employee?.uid || store.vales[idx].employee_uid,
      employee_id_number: payload.employee_id_number || employee?.id_number || store.vales[idx].employee_id_number,
      employee_name: payload.employee_name || employee?.employee_name || store.vales[idx].employee_name,
    });

    persistStore();
    return respond({ success: true, vale: store.vales[idx] });
  },

  async recordValePayment(valeId, payload = {}) {
    const idx = store.vales.findIndex((entry) => Number(entry.id) === Number(valeId));
    if (idx < 0) return rejectWith('Vale not found');

    const amount = toNumber(payload.amount, 0);
    if (amount <= 0) return rejectWith('Payment amount must be greater than zero');

    const current = store.vales[idx];
    const nextPayments = [
      ...(Array.isArray(current.payments) ? current.payments : []),
      {
        id: nextId('valePayment'),
        payment_date: payload.payment_date || today(),
        amount,
        remarks: payload.remarks || 'Recorded payment',
      },
    ];

    store.vales[idx] = normalizeVale({
      ...current,
      payments: nextPayments,
      status: payload.status || current.status,
    });

    persistStore();
    return respond({ success: true, vale: store.vales[idx] });
  },

  async deleteVale(valeId) {
    const before = store.vales.length;
    store.vales = store.vales.filter((entry) => Number(entry.id) !== Number(valeId));
    if (store.vales.length === before) return rejectWith('Vale not found');
    persistStore();
    return respond({ success: true });
  },

  async getPayrollCheckingRecords() {
    store.payrollCheckingRecords = store.payrollCheckingRecords.map((record) => normalizeCheckingRecord(record));
    store.payrollCheckingRecords.sort((a, b) => new Date(b.cutoff_date).getTime() - new Date(a.cutoff_date).getTime());
    persistStore();
    return respond({ data: store.payrollCheckingRecords });
  },

  async getPayrollCheckingRecord(recordId) {
    const record = store.payrollCheckingRecords.find((entry) => Number(entry.id) === Number(recordId));
    if (!record) return rejectWith('Payroll checking record not found');
    return respond({ data: normalizeCheckingRecord(record) });
  },

  async createPayrollCheckingRecord(payload) {
    const record = normalizeCheckingRecord({
      ...payload,
      id: nextId('payrollChecking'),
      status: payload.status || 'draft',
      created_by: payload.created_by || null,
      updated_at: nowIso(),
    });

    store.payrollCheckingRecords.push(record);
    persistStore();
    return respond({ success: true, data: record });
  },

  async updatePayrollCheckingRecord(recordId, payload) {
    const idx = store.payrollCheckingRecords.findIndex((entry) => Number(entry.id) === Number(recordId));
    if (idx < 0) return rejectWith('Payroll checking record not found');

    store.payrollCheckingRecords[idx] = normalizeCheckingRecord({
      ...store.payrollCheckingRecords[idx],
      ...payload,
    });

    persistStore();
    return respond({ success: true, data: store.payrollCheckingRecords[idx] });
  },

  async deletePayrollCheckingRecord(recordId) {
    const before = store.payrollCheckingRecords.length;
    store.payrollCheckingRecords = store.payrollCheckingRecords.filter((entry) => Number(entry.id) !== Number(recordId));
    if (store.payrollCheckingRecords.length === before) return rejectWith('Payroll checking record not found');
    persistStore();
    return respond({ success: true });
  },

  async lockPayrollCheckingRecord(recordId, actorId = null) {
    return this.updatePayrollCheckingRecord(recordId, { status: 'locked', locked_by: actorId });
  },

  async approvePayrollCheckingRecord(recordId, actorId = null) {
    return this.updatePayrollCheckingRecord(recordId, { status: 'approved', approved_by: actorId });
  },

  async revertPayrollCheckingToDraft(recordId, actorId = null) {
    return this.updatePayrollCheckingRecord(recordId, { status: 'draft', reverted_by: actorId });
  },

  async getCashRequests() {
    store.cashRequests = store.cashRequests.map((record) => normalizeCashRequest(record));
    store.cashRequests.sort((a, b) => new Date(b.cutoff_date).getTime() - new Date(a.cutoff_date).getTime());
    persistStore();
    return respond({ data: store.cashRequests });
  },

  async createCashRequest(payload) {
    const record = normalizeCashRequest({
      ...payload,
      id: nextId('cashRequest'),
      request_number: payload.request_number || `CR-${formatSequence(nextId('cashRequest'))}`,
      status: payload.status || 'draft',
      updated_at: nowIso(),
    });

    store.cashRequests.push(record);
    persistStore();
    return respond({ success: true, data: record });
  },

  async updateCashRequest(requestId, payload) {
    const idx = store.cashRequests.findIndex((entry) => Number(entry.id) === Number(requestId));
    if (idx < 0) return rejectWith('Cash request not found');

    store.cashRequests[idx] = normalizeCashRequest({
      ...store.cashRequests[idx],
      ...payload,
    });

    persistStore();
    return respond({ success: true, data: store.cashRequests[idx] });
  },

  async deleteCashRequest(requestId) {
    const before = store.cashRequests.length;
    store.cashRequests = store.cashRequests.filter((entry) => Number(entry.id) !== Number(requestId));
    if (store.cashRequests.length === before) return rejectWith('Cash request not found');
    persistStore();
    return respond({ success: true });
  },

  async submitCashRequest(requestId, actorId = null) {
    return this.updateCashRequest(requestId, { status: 'submitted', submitted_by: actorId });
  },

  async approveCashRequest(requestId, actorId = null) {
    return this.updateCashRequest(requestId, { status: 'approved', approved_by: actorId });
  },

  async releaseCashRequest(requestId, actorId = null) {
    return this.updateCashRequest(requestId, { status: 'released', released_by: actorId, released_at: nowIso() });
  },

  async cancelCashRequest(requestId, reason = '', actorId = null) {
    return this.updateCashRequest(requestId, {
      status: 'cancelled',
      cancellation_reason: reason,
      cancelled_by: actorId,
    });
  },

  async uploadProofDocument(file, options = {}) {
    const id = nextId('proof');
    const name = String(file?.name || options?.name || 'document').trim() || `document-${id}`;
    const reference = `mock://proof/${id}/${encodeURIComponent(name)}`;

    const uploaded = {
      id,
      original_name: name,
      reference,
      url: reference,
      path: reference,
      uploaded_at: nowIso(),
    };

    persistStore();
    return respond({ success: true, uploaded });
  },
};

const monthlyBillsService = {
  async getMonthlyBills(filters = {}) {
    let list = [...store.monthlyBills];

    if (filters.year) {
      list = list.filter((bill) => Number(bill.year) === Number(filters.year));
    }

    if (filters.status) {
      list = list.filter((bill) => String(bill.status) === String(filters.status).toLowerCase());
    }

    return respond(list.map((bill) => normalizeBill(bill)));
  },

  async getBill(billId) {
    const bill = store.monthlyBills.find((entry) => Number(entry.id) === Number(billId));
    if (!bill) return rejectWith('Monthly bill not found');
    return respond(normalizeBill(bill));
  },

  async getBillBreakdown(billId) {
    const bill = store.monthlyBills.find((entry) => Number(entry.id) === Number(billId));
    if (!bill) return rejectWith('Monthly bill not found');

    const normalized = normalizeBill(bill);

    const categoryBreakdown = {
      electricity: [],
      water: [],
      communications: [],
      rental: [],
      payment_fees: [],
      other: [],
    };

    normalized.items.forEach((item) => {
      const key = categoryBreakdown[item.category] ? item.category : 'other';
      categoryBreakdown[key].push(item);
    });

    return respond({
      ...normalized,
      categoryBreakdown,
      totals: {
        electricity: toNumber(normalized.electricity_subtotal, 0),
        water: toNumber(normalized.water_subtotal, 0),
        communications: toNumber(normalized.communications_subtotal, 0),
        rental: toNumber(normalized.rental_subtotal, 0),
        payment_fees: toNumber(normalized.payment_fees_subtotal, 0),
        other: toNumber(normalized.other_subtotal, 0),
        net_total: toNumber(normalized.net_total, 0),
      },
    });
  },

  async createMonthlyBill(payload) {
    const id = nextId('monthlyBill');
    const items = Array.isArray(payload.items)
      ? payload.items.map((item) => ({ ...item, id: item.id ?? nextId('monthlyBillItem'), bill_id: id }))
      : [];

    const bill = normalizeBill({
      ...payload,
      id,
      items,
      status: payload.status || 'pending',
      billing_period_start: payload.billing_period_start || `${payload.year || new Date().getFullYear()}-${pad(payload.month || new Date().getMonth() + 1)}-01`,
      billing_period_end: payload.billing_period_end || `${payload.year || new Date().getFullYear()}-${pad(payload.month || new Date().getMonth() + 1)}-28`,
      updated_at: nowIso(),
    });

    store.monthlyBills.push(bill);
    persistStore();
    socketService.emit('finance:monthly_bill_created', { bill });
    return respond({ success: true, data: bill });
  },

  async updateBill(billId, payload) {
    const idx = store.monthlyBills.findIndex((entry) => Number(entry.id) === Number(billId));
    if (idx < 0) return rejectWith('Monthly bill not found');

    const current = store.monthlyBills[idx];
    const items = Array.isArray(payload.items)
      ? payload.items.map((item) => ({
          ...item,
          id: item.id ?? nextId('monthlyBillItem'),
          bill_id: current.id,
        }))
      : current.items;

    store.monthlyBills[idx] = normalizeBill({
      ...current,
      ...payload,
      items,
      updated_at: nowIso(),
    });

    persistStore();
    socketService.emit('finance:monthly_bill_updated', { bill: store.monthlyBills[idx] });
    return respond({ success: true, data: store.monthlyBills[idx] });
  },

  async deleteBill(billId) {
    const before = store.monthlyBills.length;
    store.monthlyBills = store.monthlyBills.filter((entry) => Number(entry.id) !== Number(billId));
    if (store.monthlyBills.length === before) return rejectWith('Monthly bill not found');
    persistStore();
    socketService.emit('finance:monthly_bill_deleted', { id: billId });
    return respond({ success: true });
  },

  async markAsPaid(billId, paymentData = {}) {
    return this.updateBill(billId, {
      status: 'paid',
      payment_date: paymentData.payment_date || today(),
      payment_method: paymentData.payment_method || '',
      paid_by: paymentData.paid_by || null,
    });
  },

  async createBillItem(billId, payload) {
    const idx = store.monthlyBills.findIndex((entry) => Number(entry.id) === Number(billId));
    if (idx < 0) return rejectWith('Monthly bill not found');

    const bill = store.monthlyBills[idx];
    const item = {
      ...payload,
      id: nextId('monthlyBillItem'),
      bill_id: bill.id,
      amount: toNumber(payload.amount, 0),
      due_date: payload.due_date || bill.billing_period_end || today(),
    };

    bill.items = [...(bill.items || []), item];
    store.monthlyBills[idx] = normalizeBill(bill);
    persistStore();
    return respond({ success: true, data: item });
  },

  async updateBillItem(billId, itemId, payload) {
    const idx = store.monthlyBills.findIndex((entry) => Number(entry.id) === Number(billId));
    if (idx < 0) return rejectWith('Monthly bill not found');

    const bill = store.monthlyBills[idx];
    const itemIndex = (bill.items || []).findIndex((item) => Number(item.id) === Number(itemId));
    if (itemIndex < 0) return rejectWith('Bill item not found');

    bill.items[itemIndex] = {
      ...bill.items[itemIndex],
      ...payload,
      amount: toNumber(payload.amount, bill.items[itemIndex].amount),
    };

    store.monthlyBills[idx] = normalizeBill(bill);
    persistStore();
    return respond({ success: true, data: bill.items[itemIndex] });
  },

  async deleteBillItem(billId, itemId) {
    const idx = store.monthlyBills.findIndex((entry) => Number(entry.id) === Number(billId));
    if (idx < 0) return rejectWith('Monthly bill not found');

    const bill = store.monthlyBills[idx];
    const before = (bill.items || []).length;
    bill.items = (bill.items || []).filter((item) => Number(item.id) !== Number(itemId));

    if (bill.items.length === before) return rejectWith('Bill item not found');

    store.monthlyBills[idx] = normalizeBill(bill);
    persistStore();
    return respond({ success: true, data: { deleted: true } });
  },

  async getProviders(filters = {}) {
    let list = [...store.providers];

    if (filters.category) {
      list = list.filter((provider) => String(provider.category) === String(filters.category));
    }

    if (filters.active_only !== undefined) {
      const required = String(filters.active_only) === 'true' || filters.active_only === true;
      list = list.filter((provider) => Boolean(provider.is_active) === required);
    }

    return respond(list);
  },

  async createProvider(payload) {
    const providerName = String(payload?.provider_name || '').trim();
    if (!providerName) return rejectWith('Provider name is required');

    const provider = {
      id: nextId('provider'),
      provider_name: providerName,
      category: payload.category || 'other',
      is_active: payload.is_active !== undefined ? Boolean(payload.is_active) : true,
      updated_at: nowIso(),
    };

    store.providers.push(provider);
    persistStore();
    return respond({ success: true, data: provider });
  },

  async updateProvider(providerId, payload) {
    const idx = store.providers.findIndex((entry) => Number(entry.id) === Number(providerId));
    if (idx < 0) return rejectWith('Provider not found');

    store.providers[idx] = {
      ...store.providers[idx],
      ...payload,
      is_active: payload.is_active !== undefined ? Boolean(payload.is_active) : store.providers[idx].is_active,
      updated_at: nowIso(),
    };

    persistStore();
    return respond({ success: true, data: store.providers[idx] });
  },

  async deleteProvider(providerId) {
    const before = store.providers.length;
    store.providers = store.providers.filter((entry) => Number(entry.id) !== Number(providerId));
    if (store.providers.length === before) return rejectWith('Provider not found');
    persistStore();
    return respond({ success: true });
  },
};

const buildPayrollRecords = (period, cutoff) => {
  const key = `${period}-${cutoff}`;
  if (Array.isArray(store.payrollCache[key])) {
    return store.payrollCache[key];
  }

  const bounds = getPeriodBounds(period, cutoff);
  const records = store.employees.map((employee) => {
    const seed = toNumber(employee.uid, 0) * 17 + cutoff;
    const regular = cutoff === 15 ? 88 : 92;
    const overtime = (seed % 4) * 2;
    const sunday = seed % 3 === 0 ? 8 : 0;
    const regularHoliday = seed % 5 === 0 ? 8 : 0;
    const specialHoliday = seed % 7 === 0 ? 4 : 0;

    const rate = toNumber(employee.hourly_rate, 180);

    const grossPay = Number(
      (
        rate * regular +
        rate * 1.25 * overtime +
        rate * 1.3 * sunday +
        rate * 2 * regularHoliday +
        rate * 1.3 * specialHoliday
      ).toFixed(2),
    );

    const deductions = Number((grossPay * 0.12).toFixed(2));
    const netPay = Number((grossPay - deductions).toFixed(2));

    return {
      id: `${bounds.period}-${cutoff}-${employee.uid}`,
      employeeId: employee.uid,
      employeeUid: employee.uid,
      employeeName: employee.employee_name,
      period: bounds.period,
      cutoff,
      cutoffStartDate: bounds.startDate,
      cutoffEndDate: bounds.endDate,
      rate,
      hours: {
        regular,
        overtime,
        sunday,
        regularHoliday,
        specialHoliday,
      },
      earnings: {
        grossPay,
      },
      deductions: {
        total: deductions,
      },
      netPay,
      status: 'pending',
      department: employee.department,
      position: employee.position,
    };
  });

  store.payrollCache[key] = records;
  persistStore();
  return records;
};

const payrollService = {
  async getPayrollRecords(filters = {}) {
    const now = new Date();
    const period = filters.period || `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
    const cutoff = Number(filters.cutoff || 15);

    let rows = buildPayrollRecords(period, cutoff);

    if (filters.employee_id) {
      rows = rows.filter((row) => Number(row.employeeId) === Number(filters.employee_id));
    }

    if (filters.status && filters.status !== 'all') {
      rows = rows.filter((row) => String(row.status) === String(filters.status).toLowerCase());
    }

    if (typeof filters.offset === 'number' && typeof filters.limit === 'number') {
      rows = rows.slice(filters.offset, filters.offset + filters.limit);
    }

    return respond({ data: rows });
  },

  async getPayrollSummary(period, cutoff) {
    const response = await this.getPayrollRecords({ period, cutoff });
    const rows = response.data || [];

    return respond({
      success: true,
      summary: {
        total_employees: rows.length,
        total_gross: Number(rows.reduce((sum, row) => sum + toNumber(row.earnings?.grossPay, 0), 0).toFixed(2)),
        total_deductions: Number(rows.reduce((sum, row) => sum + toNumber(row.deductions?.total, 0), 0).toFixed(2)),
        total_net: Number(rows.reduce((sum, row) => sum + toNumber(row.netPay, 0), 0).toFixed(2)),
      },
    });
  },

  async approvePayroll(period, cutoff) {
    const now = new Date();
    const resolvedPeriod = period || `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
    const resolvedCutoff = Number(cutoff || 15);
    const key = `${resolvedPeriod}-${resolvedCutoff}`;

    const rows = buildPayrollRecords(resolvedPeriod, resolvedCutoff).map((row) => ({
      ...row,
      status: 'approved',
    }));

    store.payrollCache[key] = rows;
    persistStore();
    socketService.emit('payroll_approved', { period: resolvedPeriod, cutoff: resolvedCutoff });

    return respond({ success: true, message: 'Payroll approved successfully' });
  },

  async downloadPayrollTableExcel(period, cutoff) {
    const response = await this.getPayrollRecords({ period, cutoff });
    const rows = response.data || [];

    const header = 'Employee,Period,Cutoff,Gross,Deductions,Net,Status';
    const lines = rows.map((row) =>
      [
        row.employeeName,
        row.period,
        row.cutoff,
        toNumber(row.earnings?.grossPay, 0),
        toNumber(row.deductions?.total, 0),
        toNumber(row.netPay, 0),
        row.status,
      ].join(','),
    );

    return new Blob([`${header}\n${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
  },

  async downloadWholeMonthTableExcel(period) {
    const first = await this.getPayrollRecords({ period, cutoff: 15 });
    const second = await this.getPayrollRecords({ period, cutoff: 30 });
    const rows = [...(first.data || []), ...(second.data || [])];

    const header = 'Employee,Period,Cutoff,Gross,Deductions,Net,Status';
    const lines = rows.map((row) =>
      [
        row.employeeName,
        row.period,
        row.cutoff,
        toNumber(row.earnings?.grossPay, 0),
        toNumber(row.deductions?.total, 0),
        toNumber(row.netPay, 0),
        row.status,
      ].join(','),
    );

    return new Blob([`${header}\n${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
  },

  downloadBlobAsFile(blob, fileName) {
    if (typeof window === 'undefined') return;
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = fileName || 'payroll.csv';
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  },
};

const employeesService = {
  async getEmployee(uid) {
    const employee = getEmployeeByUid(uid);
    if (!employee) return rejectWith('Employee not found');
    return respond({ success: true, employee });
  },

  async getEmployees(filters = {}) {
    let list = [...store.employees];

    if (filters.department) {
      list = list.filter((employee) => String(employee.department).toLowerCase() === String(filters.department).toLowerCase());
    }

    if (filters.status) {
      list = list.filter((employee) => String(employee.status).toLowerCase() === String(filters.status).toLowerCase());
    }

    if (Number.isFinite(Number(filters.limit))) {
      list = list.slice(0, Number(filters.limit));
    }

    return respond({
      success: true,
      employees: list,
      pagination: {
        total: list.length,
        limit: Number(filters.limit || list.length || 1),
        offset: Number(filters.offset || 0),
      },
      departments: [...new Set(store.employees.map((employee) => employee.department))],
    });
  },
};

const profilesService = {
  async getProfileByUid(uid) {
    const employee = getEmployeeByUid(uid);
    const url = makeAvatarDataUri(employee?.employee_name || employee?.name || `User ${uid}`);
    return respond({ success: true, url });
  },

  getProfileUrlByUid(uid) {
    const employee = getEmployeeByUid(uid);
    return makeAvatarDataUri(employee?.employee_name || employee?.name || `User ${uid}`);
  },

  clearProfileCache() {},
};

const summaryService = {
  async getDailySummaryByDates(payload = {}) {
    const employeeUid = Number(payload.employee_uid || 0);
    const dates = String(payload.dates || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    const rows = dates.map((date, index) => {
      const day = new Date(`${date}T00:00:00`).getDay();
      const isSunday = day === 0;
      const seed = (employeeUid || 1) * 13 + index;
      const overtime = seed % 5 === 0 ? 2 : 0;
      const regularHours = isSunday ? 0 : 8;

      return {
        id: `${employeeUid || 'emp'}-${date}`,
        date,
        employee_uid: employeeUid || null,
        regular_hours: regularHours,
        sunday_hours: isSunday ? 8 : 0,
        overtime_hours: overtime,
        regular_holiday_hours: 0,
        special_holiday_hours: 0,
        morning_in: regularHours > 0 ? '08:00' : null,
        morning_out: regularHours > 0 ? '12:00' : null,
        afternoon_in: regularHours > 0 ? '13:00' : null,
        afternoon_out: regularHours > 0 ? '17:00' : null,
        evening_in: overtime > 0 ? '17:30' : null,
        evening_out: overtime > 0 ? '19:30' : null,
        remarks: isSunday ? 'Sunday' : null,
      };
    });

    return respond({ success: true, data: rows });
  },

  async getDailySummaryRecords(payload = {}) {
    return this.getDailySummaryByDates(payload);
  },
};

const pushService = {
  async saveSubscription(payload = {}) {
    store.pushSubscriptions.push({
      ...payload,
      id: store.pushSubscriptions.length + 1,
      saved_at: nowIso(),
    });
    persistStore();
    return respond({ success: true });
  },

  async deleteSubscription(userId) {
    store.pushSubscriptions = store.pushSubscriptions.filter(
      (entry) => String(entry.userId || entry.uid || '') !== String(userId || ''),
    );
    persistStore();
    return respond({ success: true });
  },
};

const apiService = {
  auth: {},
  employees: employeesService,
  files: {},
  profiles: profilesService,
  attendance: {},
  recruitment: {},
  document: {},
  summary: summaryService,
  items: {},
  purchaseOrders: {},
  suppliers: {},
  employeeLogs: {},
  editAttendance: {},
  announcements: {},
  email: {},
  materials: {},
  employeeInventory: {},
  finance: financeService,
  payroll: payrollService,
  monthlyBills: monthlyBillsService,
  commandQueue: {},
  jobOrders: {},
  checkoutRequests: {},
  push: pushService,
  toolboxItems: {},
  toolboxTransactions: {},
  toolboxEmployees: {},
  toolboxConnection: {},
  socket: socketService,
  initialize() {},
  cleanup() {},
};

persistStore();

export default apiService;

export const {
  auth,
  employees,
  files,
  profiles,
  attendance,
  recruitment,
  document,
  summary,
  items,
  purchaseOrders,
  employeeLogs,
  editAttendance,
  suppliers,
  announcements,
  email,
  materials,
  employeeInventory,
  finance,
  payroll,
  monthlyBills,
  commandQueue,
  jobOrders,
  toolboxItems,
  toolboxTransactions,
  toolboxEmployees,
  toolboxConnection,
  checkoutRequests,
  push,
} = apiService;

export const getSocket = () => apiService.socket;
