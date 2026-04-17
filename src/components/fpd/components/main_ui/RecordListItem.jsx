"use client"

import { useAuth } from "../../../../contexts/AuthContext"

function RecordListItem({ title, subtitle, value, onClick }) {
  const { isDarkMode } = useAuth()
  return (
    <div 
      onClick={onClick}
      className={`p-4 ${isDarkMode ? 'bg-stone-700' : 'bg-stone-50'} rounded-lg flex justify-between items-center ${onClick ? `cursor-pointer ${isDarkMode ? 'hover:bg-stone-600' : 'hover:bg-stone-100'} transition-colors` : ''}`}
    >
      <div>
        <p className={`font-medium ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>{title}</p>
        <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{subtitle}</p>
      </div>
      {value && (
        <span className={`font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>{value}</span>
      )}
    </div>
  )
}

export default RecordListItem
