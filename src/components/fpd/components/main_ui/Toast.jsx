import { useEffect } from 'react'
import { LuX, LuCircleCheck, LuCircleX, LuInfo, LuTriangleAlert } from 'react-icons/lu'
import { useAuth } from '../../../../contexts/AuthContext'

export default function Toast({ message, type = 'info', duration = 3000, onClose }) {
  const { isDarkMode } = useAuth()
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose()
      }, duration)
      return () => clearTimeout(timer)
    }
  }, [duration, onClose])

  const styles = {
    success: {
      bg: 'bg-green-500',
      icon: <LuCircleCheck className="w-5 h-5" />,
      text: 'text-white'
    },
    error: {
      bg: 'bg-red-500',
      icon: <LuCircleX className="w-5 h-5" />,
      text: 'text-white'
    },
    warning: {
      bg: 'bg-amber-500',
      icon: <LuTriangleAlert className="w-5 h-5" />,
      text: 'text-white'
    },
    info: {
      bg: 'bg-blue-500',
      icon: <LuInfo className="w-5 h-5" />,
      text: 'text-white'
    }
  }

  const style = styles[type] || styles.info

  return (
    <div className={`${style.bg} ${style.text} rounded-lg shadow-lg px-4 py-3 flex items-center gap-3 min-w-[300px] max-w-md animate-slide-in-right`}>
      <div className="flex-shrink-0">
        {style.icon}
      </div>
      <p className="flex-1 text-sm font-medium">{message}</p>
      <button
        onClick={onClose}
        className="flex-shrink-0 hover:bg-white/20 rounded p-1 transition-colors"
      >
        <LuX className="w-4 h-4" />
      </button>
    </div>
  )
}

export function ToastContainer({ toasts, removeToast }) {
  return (
    <div className="fixed top-4 right-4 z-[100] space-y-2">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  )
}
