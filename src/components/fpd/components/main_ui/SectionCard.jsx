"use client"

import { useAuth } from "../../../../contexts/AuthContext"

function SectionCard({ title, children, action }) {
  const { isDarkMode } = useAuth()
  return (
    <div className={`${isDarkMode ? 'bg-stone-800' : 'bg-white'} rounded-lg sm:rounded-xl shadow-md overflow-hidden`}>
      {title && (
        <div className={`p-4 sm:p-6 ${isDarkMode ? 'border-gray-700' : 'border-gray-200'} border-b flex justify-between items-center`}>
          <h3 className={`text-base sm:text-lg font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>{title}</h3>
          {action}
        </div>
      )}
      <div className={title ? "" : "p-4 sm:p-6"}>
        {children}
      </div>
    </div>
  )
}

export default SectionCard
