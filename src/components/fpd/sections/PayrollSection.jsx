import PayrollMasterlist from './PayrollMasterList'
import apiService from '../../../utils/api/api-service'
import { useAuth } from '../../../contexts/AuthContext'

export default function PayrollSection() {
  const { user, isDarkMode } = useAuth();
  return (
     <div className="space-y-6">
      <PayrollMasterlist 
        apiService={apiService} 
        isDarkMode={isDarkMode} 
        user={user}
      />
    </div>
  );
}
