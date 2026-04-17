import { Navigate, Route, Routes, Link } from 'react-router-dom';
import FinancePayrollDepartment from './components/department/FinancePayrollDepartment';
import FinanceDocumentIngestionPage from './features/finance-documents/pages/FinanceDocumentIngestionPage';

function PlaceholderPage({ title, description }) {
  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 p-8">
      <div className="max-w-3xl mx-auto rounded-2xl border border-stone-300 bg-white p-8">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-2 text-stone-600">{description}</p>
        <div className="mt-6">
          <Link
            className="inline-flex items-center rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700"
            to="/jjcewgsaccess/finance"
          >
            Back to Finance Demo
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/jjcewgsaccess/finance" replace />} />
      <Route path="/jjcewgsaccess/finance" element={<FinancePayrollDepartment />} />
      <Route
        path="/jjcewgsaccess/finance/documents/ingestion"
        element={<FinanceDocumentIngestionPage contextTitle="Finance OCR Demo" />}
      />
      <Route
        path="/employee/dashboard"
        element={
          <PlaceholderPage
            title="Employee Dashboard (Demo)"
            description="This is a placeholder page in demo mode. Finance features remain fully interactive with mock data."
          />
        }
      />
      <Route
        path="/jjctoolbox"
        element={
          <PlaceholderPage
            title="Toolbox (Demo)"
            description="Toolbox is not included in this standalone FPD demo build."
          />
        }
      />
      <Route path="*" element={<Navigate to="/jjcewgsaccess/finance" replace />} />
    </Routes>
  );
}
