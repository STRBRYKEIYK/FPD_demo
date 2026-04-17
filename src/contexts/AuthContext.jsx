import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const AuthContext = createContext(null);

const DEMO_USER = {
  id: 1,
  username: 'fpd.demo',
  name: 'FPD Demo Admin',
  role: 'admin',
  access_level: 'admin',
  department: 'Finance',
  permissions: ['*'],
  loginTime: new Date().toISOString(),
};

const DEMO_EMPLOYEE = {
  id: 1,
  uid: 1,
  employeeId: 'JJC-001',
  username: 'fpd.demo',
  name: 'FPD Demo Admin',
  department: 'Finance',
  position: 'Finance Officer',
  role: 'admin',
  access_level: 'admin',
  loginTime: new Date().toISOString(),
};

export const DEPARTMENT_MAP = {
  hr: 'Human Resources',
  operations: 'Operations',
  finance: 'Finance',
  procurement: 'Procurement',
  engineering: 'Engineering',
  superadmin: 'superAdmin',
};

export const DEPARTMENT_SLUG_MAP = {
  'Human Resources': 'hr',
  Operations: 'operations',
  Finance: 'finance',
  Procurement: 'procurement',
  Engineering: 'engineering',
  superAdmin: 'superadmin',
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(DEMO_USER);
  const [employee, setEmployee] = useState(DEMO_EMPLOYEE);
  const [selectedDepartment, setSelectedDepartment] = useState('Finance');
  const [isLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      const raw = localStorage.getItem('fpd_demo_dark_mode');
      return raw != null ? JSON.parse(raw) : false;
    } catch {
      return false;
    }
  });
  const [sessionTimeoutInfo, setSessionTimeoutInfo] = useState({
    isOpen: false,
    reason: '',
    userType: 'admin',
  });

  useEffect(() => {
    try {
      localStorage.setItem('fpd_demo_dark_mode', JSON.stringify(isDarkMode));
    } catch {
      // ignore
    }

    document.documentElement.classList.toggle('dark', isDarkMode);
    document.body.classList.toggle('dark', isDarkMode);
  }, [isDarkMode]);

  const toggleDarkMode = useCallback(() => {
    setIsDarkMode((prev) => !prev);
  }, []);

  const login = useCallback((userData, department) => {
    const nextUser = {
      ...DEMO_USER,
      ...userData,
      department: department || userData?.department || 'Finance',
      loginTime: new Date().toISOString(),
    };
    setUser(nextUser);
    setEmployee({
      ...DEMO_EMPLOYEE,
      id: nextUser.id,
      uid: nextUser.id,
      username: nextUser.username,
      name: nextUser.name,
      role: nextUser.role,
      access_level: nextUser.access_level,
      department: nextUser.department,
      loginTime: nextUser.loginTime,
    });
    setSelectedDepartment(nextUser.department || 'Finance');
  }, []);

  const employeeLogin = useCallback((employeeData) => {
    const nextEmployee = {
      ...DEMO_EMPLOYEE,
      ...employeeData,
      loginTime: new Date().toISOString(),
    };
    setEmployee(nextEmployee);
    setUser({
      ...DEMO_USER,
      id: nextEmployee.id,
      username: nextEmployee.username,
      name: nextEmployee.name,
      role: nextEmployee.role || 'admin',
      access_level: nextEmployee.access_level || 'admin',
      department: nextEmployee.department || 'Finance',
      loginTime: nextEmployee.loginTime,
    });
    setSelectedDepartment(nextEmployee.department || 'Finance');
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setEmployee(null);
    setSelectedDepartment(null);
  }, []);

  const employeeLogout = useCallback(() => {
    setUser(null);
    setEmployee(null);
    setSelectedDepartment(null);
  }, []);

  const closeSessionTimeoutModal = useCallback(() => {
    setSessionTimeoutInfo((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const value = useMemo(
    () => ({
      user,
      employee,
      selectedDepartment,
      isLoading,
      rememberMe,
      setRememberMe,
      isDarkMode,
      toggleDarkMode,
      login,
      employeeLogin,
      logout,
      employeeLogout,
      setUser,
      setEmployee,
      setSelectedDepartment,
      isAuthenticated: Boolean(user || employee),
      isSuperAdmin: false,
      sessionTimeoutInfo,
      closeSessionTimeoutModal,
    }),
    [
      user,
      employee,
      selectedDepartment,
      isLoading,
      rememberMe,
      isDarkMode,
      toggleDarkMode,
      login,
      employeeLogin,
      logout,
      employeeLogout,
      sessionTimeoutInfo,
      closeSessionTimeoutModal,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
