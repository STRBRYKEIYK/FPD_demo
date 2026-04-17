export const BILL_CATEGORIES = [
  { value: 'electricity', label: 'Electricity', color: 'yellow' },
  { value: 'water', label: 'Water', color: 'blue' },
  { value: 'communications', label: 'Communications/Internet', color: 'purple' },
  { value: 'payment_fees', label: 'Payment Fees', color: 'orange' },
  { value: 'other', label: 'Other Services', color: 'gray' },
];

export const JJC_LOCATIONS = [
  { value: 'robinsons_lot18', label: 'Robinsons Lot 18' },
  { value: 'mission_hills', label: 'Mission Hills' },
  { value: 'hinapo', label: 'Hinapo' },
  { value: 'main_office', label: 'Main Office' },
];

export const BILL_STATUS = [
  { value: 'draft', label: 'Draft', color: 'gray' },
  { value: 'pending', label: 'Pending', color: 'yellow' },
  { value: 'paid', label: 'Paid', color: 'green' },
  { value: 'overdue', label: 'Overdue', color: 'red' },
  { value: 'cancelled', label: 'Cancelled', color: 'gray' },
];

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'check', label: 'Check' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'online', label: 'Online (GCash/PayMaya)' },
  { value: 'other', label: 'Other' },
];

export const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

export function getStatusLabel(status) {
  const st = BILL_STATUS.find((s) => s.value === status);
  return st ? st.label : status;
}

export function getStatusColorClasses(status) {
  const colorMap = {
    draft: 'bg-stone-100 text-gray-800 dark:bg-stone-800 dark:text-gray-300',
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
    paid: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
    overdue: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
    cancelled: 'bg-stone-100 text-gray-800 dark:bg-stone-800 dark:text-gray-300',
  };
  return colorMap[status] || colorMap.draft;
}

export function formatPeriod(month, year) {
  if (!month || !year) return '-';
  const m = MONTHS.find((mo) => mo.value === month);
  return `${m ? m.label : ''} ${year}`;
}
