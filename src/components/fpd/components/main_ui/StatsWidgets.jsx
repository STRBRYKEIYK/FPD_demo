import React from "react"
import { useAuth } from "../../../../contexts/AuthContext"

function StatWidget({ title, value, icon, color, chart }) {
    const { isDarkMode } = useAuth()
    return (
    <div className={`rounded-xl sm:rounded-2xl shadow-md p-3 sm:p-5 flex items-center gap-2 sm:gap-4 ${isDarkMode ? 'bg-stone-900' : 'bg-white'} border-l-4 ${color}`}>
        {icon && <div className="text-2xl sm:text-3xl">{icon}</div>}
        <div className="flex-1 min-w-0">
            <div className={`text-xs sm:text-sm font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-700'} truncate`}>{title}</div>
            <div className={`text-lg sm:text-2xl font-bold ${isDarkMode ? 'text-stone-100' : 'text-stone-800'} truncate`}>{value}</div>
        </div>
        {/* Chart area */}
        {chart && (
            <div className="ml-auto hidden sm:block">
                {chart}
            </div>
        )
        }
    </div>
    )
}

export default StatWidget
