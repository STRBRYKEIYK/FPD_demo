import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import apiService from '../../utils/api/api-service'
import { 
  User, Eye, Settings, Wrench, LogOut, ArrowRight, 
  ChevronDown, Building2, Users, Cog, Banknote, 
  ClipboardList, HardHat 
} from 'lucide-react'

/**
 * ProfileMenu - A shared profile menu component for department headers
 * @param {Object} props
 * @param {Function} props.onLogout - Callback function when logout is clicked
 * @param {Function} props.onViewProfile - Callback function when view profile is clicked
 * @param {Function} props.onSettingsOpen - Callback function when settings is clicked (optional)
 * @param {Function} props.onEmployeeDashboard - Callback function when employee dashboard is clicked (optional)
 * @param {boolean} props.showSettings - Whether to show the settings option (default: true)
 * @param {boolean} props.showToolbox - Whether to show the toolbox option (default: true)
 * @param {boolean} props.showEmployeeDashboard - Whether to show employee dashboard link for admins (default: true)
 * @param {string} props.size - Size variant: 'sm' | 'md' (default: 'md')
 */
function ProfileMenu({
  onLogout,
  onViewProfile,
  onSettingsOpen,
  onEmployeeDashboard,
  showSettings = true,
  showToolbox = true,
  showEmployeeDashboard = true,
  size = 'md'
}) {
  const { user, isDarkMode, isSuperAdmin } = useAuth()
  const navigate = useNavigate()
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [userProfile, setUserProfile] = useState(null)
  const [showDepartments, setShowDepartments] = useState(false)
  const menuRef = useRef(null)

  // All available departments for super admin
  const allDepartments = [
    { id: 'hr', label: 'Human Resource', icon: Users, url: '/jjcewgsaccess/hr' },
    { id: 'operations', label: 'Operations', icon: Cog, url: '/jjcewgsaccess/operations' },
    { id: 'finance', label: 'Finance & Payroll', icon: Banknote, url: '/jjcewgsaccess/finance' },
    { id: 'procurement', label: 'Procurement', icon: ClipboardList, url: '/jjcewgsaccess/procurement' },
    { id: 'engineering', label: 'Engineering', icon: HardHat, url: '/jjcewgsaccess/engineering' },
  ]

  useEffect(() => {
    if (user?.id) {
      apiService.employees.getEmployee(user.id)
        .then(response => {
          if (response.success && response.employee) {
            setUserProfile(response.employee)
          }
        })
        .catch(error => console.error('Failed to load user profile:', error))
    }
  }, [user])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setShowProfileMenu(false)
        setShowDepartments(false) // auto-close submenu when clicking outside
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const getProfilePictureUrl = (user) => {
    if (!user?.id) return null
    return apiService.profiles.getProfileUrlByUid(user.id)
  }

  const handleDepartmentNavigation = (deptUrl) => {
    try {
      const token = localStorage.getItem('adminToken') || localStorage.getItem('employeeToken')
      if (token) {
        sessionStorage.setItem('nav_auth_token', JSON.stringify({
          token: token,
          username: user?.username,
          timestamp: Date.now()
        }))
        window.location.href = `${deptUrl}?autoLogin=true&loginType=admin`
      } else {
        window.location.href = deptUrl
      }
    } catch (error) {
      console.error('Error navigating to department:', error)
      window.location.href = deptUrl
    }
  }

  // Sizing configurations
  const avatarSize = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10'
  const triggerPadding = size === 'sm' ? 'p-1' : 'p-1.5'
  const dropdownWidth = 'w-72' // Slightly wider for a more luxurious feel

  // Common item classes for consistency
  const menuItemClass = `w-full text-left px-4 py-2.5 text-sm font-semibold rounded-xl transition-all duration-200 flex items-center gap-3 group ${
    isDarkMode
      ? 'hover:bg-zinc-800/80 text-zinc-300 hover:text-white'
      : 'hover:bg-zinc-100/80 text-zinc-600 hover:text-zinc-900'
  }`
  
  const iconClass = "w-4 h-4 text-zinc-400 dark:text-zinc-500 group-hover:text-blue-500 dark:group-hover:text-blue-400 transition-colors duration-200"

  return (
    <div className="relative" ref={menuRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setShowProfileMenu(!showProfileMenu)}
        className={`flex items-center gap-2 ${triggerPadding} rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
          isDarkMode ? 'hover:bg-zinc-800 focus:ring-offset-zinc-950' : 'hover:bg-zinc-100 focus:ring-offset-white'
        } ${showProfileMenu ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
        aria-label="Profile menu"
        aria-expanded={showProfileMenu}
      >
        <div className={`${avatarSize} rounded-full overflow-hidden flex items-center justify-center ring-2 ring-zinc-200/50 dark:ring-zinc-700/50 transition-all ${
          isDarkMode ? 'bg-zinc-800' : 'bg-white'
        }`}>
          {getProfilePictureUrl(user) ? (
            <img
              src={getProfilePictureUrl(user)}
              alt="Profile"
              className="w-full h-full object-cover"
              onError={(e) => e.target.style.display = 'none'}
            />
          ) : (
            <User className={`text-zinc-400 ${size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'}`} strokeWidth={2.5} />
          )}
        </div>
      </button>

      {/* Profile Dropdown */}
      {showProfileMenu && (
        <div 
          className={`absolute top-full right-0 mt-3 ${dropdownWidth} rounded-[1.5rem] shadow-2xl border overflow-hidden z-[100] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200 origin-top-right ${
            isDarkMode
              ? 'bg-zinc-950/95 border-zinc-800/80'
              : 'bg-white/95 border-zinc-200/80'
          }`}
        >
          {/* Rich Header Section */}
          <div className="px-5 py-5 flex items-center gap-4 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/30">
            <div className={`w-12 h-12 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-white dark:ring-zinc-800 shadow-sm bg-white dark:bg-zinc-800 flex items-center justify-center`}>
              {getProfilePictureUrl(user) ? (
                <img
                  src={getProfilePictureUrl(user)}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-6 h-6 text-zinc-400" strokeWidth={2.5} />
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <p className="font-extrabold text-base tracking-tight truncate text-zinc-900 dark:text-white">
                {user?.name || 'User'}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-wider truncate text-zinc-500 dark:text-zinc-400 mt-0.5">
                {userProfile?.position || 'Employee'}
              </p>
            </div>
          </div>

          <div className="p-3 space-y-1">
            {/* Primary Actions Group */}
            {onViewProfile && (
              <button
                onClick={() => {
                  onViewProfile()
                  setShowProfileMenu(false)
                }}
                className={menuItemClass}
              >
                <Eye className={iconClass} />
                <span>View Profile</span>
              </button>
            )}

            {showSettings && onSettingsOpen && (
              <button
                onClick={() => {
                  onSettingsOpen()
                  setShowProfileMenu(false)
                }}
                className={menuItemClass}
              >
                <Settings className={iconClass} />
                <span>System Settings</span>
              </button>
            )}

            {showToolbox && (
              <button
                onClick={() => {
                  navigate('/jjctoolbox')
                  setShowProfileMenu(false)
                }}
                className={menuItemClass}
              >
                <Wrench className={iconClass} />
                <span>Access Toolbox</span>
              </button>
            )}

            {/* Admin / Department Actions Group */}
            {(isSuperAdmin || (showEmployeeDashboard && (userProfile?.access_level === 'admin' || user?.access_level === 'admin'))) && (
              <>
                <div className="h-px w-full bg-zinc-100 dark:bg-zinc-800/80 my-2" />
                
                {isSuperAdmin && (
                  <div>
                    <button
                      onClick={() => setShowDepartments(!showDepartments)}
                      className={`${menuItemClass} justify-between`}
                    >
                      <div className="flex items-center gap-3">
                        <Building2 className={iconClass} />
                        <span>Departments</span>
                      </div>
                      <ChevronDown className={`w-4 h-4 text-zinc-400 transition-transform duration-300 ${showDepartments ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {/* Collapsible Department List */}
                    <div className={`overflow-hidden transition-all duration-300 ease-in-out ${showDepartments ? 'max-h-64 opacity-100 mt-1 mb-2' : 'max-h-0 opacity-0'}`}>
                      <div className="ml-5 pl-3 py-1 space-y-0.5 border-l-2 border-zinc-100 dark:border-zinc-800">
                        {allDepartments.map((dept) => {
                          const IconComponent = dept.icon
                          return (
                            <button
                              key={dept.id}
                              onClick={() => {
                                setShowProfileMenu(false)
                                setShowDepartments(false)
                                handleDepartmentNavigation(dept.url)
                              }}
                              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-3 group ${
                                isDarkMode ? 'text-zinc-400 hover:text-white hover:bg-zinc-800/80' : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
                              }`}
                            >
                              <IconComponent className="w-3.5 h-3.5 opacity-70 group-hover:opacity-100 group-hover:text-blue-500 transition-all" />
                              <span>{dept.label}</span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {!isSuperAdmin && showEmployeeDashboard && (userProfile?.access_level === 'admin' || user?.access_level === 'admin') && (
                  <button
                    onClick={() => {
                      setShowProfileMenu(false)
                      onEmployeeDashboard ? onEmployeeDashboard() : navigate('/employee/dashboard')
                    }}
                    className={menuItemClass}
                  >
                    <ArrowRight className={iconClass} />
                    <span>Employee Dashboard</span>
                  </button>
                )}
              </>
            )}
          </div>

          {/* Danger Zone / Logout */}
          <div className="p-3 border-t border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/30 dark:bg-zinc-900/20">
            <button
              onClick={() => {
                onLogout()
                setShowProfileMenu(false)
              }}
              className={`w-full text-left px-4 py-2.5 text-sm font-bold rounded-xl transition-all duration-200 flex items-center justify-between group ${
                isDarkMode 
                  ? 'text-red-400 hover:bg-red-500/10 hover:text-red-300' 
                  : 'text-red-600 hover:bg-red-50 hover:text-red-700'
              }`}
            >
              <div className="flex items-center gap-3">
                <LogOut className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                <span>Secure Logout</span>
              </div>
            </button>
          </div>
          
        </div>
      )}
    </div>
  )
}

export default ProfileMenu