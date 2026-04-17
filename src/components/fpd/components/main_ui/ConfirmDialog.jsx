import { useEffect, useState } from 'react'
import { LuTriangleAlert, LuX } from 'react-icons/lu'
import { useAuth } from '../../../../contexts/AuthContext'

export default function ConfirmDialog({ 
  isOpen, 
  onClose, 
  onConfirm = () => {}, 
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'danger', // 'danger' | 'warning' | 'info'

  // optional input
  showInput = false,
  inputLabel = 'Reason',
  inputPlaceholder = '',
  inputRequired = false,
  inputMultiline = false,
  inputInitialValue = '',
  inputMaxLength = 300,
}) {

  const { isDarkMode } = useAuth()

  const [inputValue, setInputValue] = useState(inputInitialValue || '')

  useEffect(() => {
    if (!isOpen) return
    setInputValue(inputInitialValue || '')
  }, [isOpen, inputInitialValue])

  if (!isOpen) return null

  const confirmDisabled = showInput && inputRequired && !String(inputValue || '').trim()

  const typeStyles = {
    danger: {
      button: 'bg-red-500 hover:bg-red-600',
      icon: 'text-red-500'
    },
    warning: {
      button: 'bg-amber-500 hover:bg-amber-600',
      icon: 'text-amber-500'
    },
    info: {
      button: 'bg-gray-500 hover:bg-gray-600',
      icon: 'text-blue-500'
    }
  }

  const style = typeStyles[type] || typeStyles.danger

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-all duration-300"
        onClick={onClose}
      />
      
      {/* Dialog */}
      <div className="flex min-h-screen items-center justify-center p-4">
        <div 
          className={`relative ${isDarkMode ? 'bg-stone-900 border-gray-700' : 'bg-white border-gray-200'} rounded-lg shadow-2xl max-w-md w-full`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <button
            onClick={onClose}
            className={`absolute top-3 right-3 p-1.5 ${isDarkMode ? 'text-gray-400 hover:text-gray-200 hover:bg-stone-800' : 'text-gray-500 hover:text-gray-700 hover:bg-stone-100'} transition-all rounded-full`}
          >
            <LuX size={18} />
          </button>

          {/* Content */}
          <div className="p-6">
            {/* Icon */}
            <div className="flex items-center gap-4 mb-4">
              <div className={`p-3 ${style.icon} ${isDarkMode ? 'bg-stone-800' : 'bg-stone-100'} rounded-full`}>
                <LuTriangleAlert className="w-6 h-6" />
              </div>
              <h3 className={`text-lg font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>{title}</h3>
            </div>

            {/* Message */}
            <p className={`text-sm mb-6 ml-16 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
              {message}
            </p>

            {showInput && (
              <div className="mb-6 ml-16">
                <label className={`block text-xs font-semibold mb-1 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                  {inputLabel}
                </label>
                {inputMultiline ? (
                  <textarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    maxLength={inputMaxLength}
                    rows={3}
                    placeholder={inputPlaceholder}
                    className={`w-full px-3 py-2 text-sm rounded-lg border outline-none transition-all resize-none ${
                      isDarkMode
                        ? 'bg-stone-950 border-gray-700 text-gray-100 focus:border-blue-500'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
                    }`}
                  />
                ) : (
                  <input
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    maxLength={inputMaxLength}
                    placeholder={inputPlaceholder}
                    className={`w-full px-3 py-2 text-sm rounded-lg border outline-none transition-all ${
                      isDarkMode
                        ? 'bg-stone-950 border-gray-700 text-gray-100 focus:border-blue-500'
                        : 'bg-white border-gray-300 text-gray-900 focus:border-blue-500'
                    }`}
                  />
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <button
                onClick={onClose}
                className={`px-4 py-2 ${isDarkMode ? 'bg-stone-700 hover:bg-stone-600 text-white' : 'bg-stone-200 hover:bg-stone-300 text-gray-900'} rounded-lg transition-colors text-sm font-medium`}
              >
                {cancelText}
              </button>
              <button
                onClick={() => {
                  if (showInput) {
                    onConfirm(inputValue)
                  } else {
                    onConfirm()
                  }
                  onClose()
                }}
                disabled={confirmDisabled}
                className={`px-4 py-2 ${style.button} text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {confirmText}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

