"use client"

import { useAuth } from "../../../../contexts/AuthContext"

export default function QuickActionButton({ 
  title, 
  description, 
  icon, // Optional: added for modern dashboard aesthetics
  color = "border-stone-500", // Updated default to a neutral stone
  onClick 
}) {
  const { isDarkMode } = useAuth() // Kept for prop compatibility, though we rely on `dark:` classes now

  return (
    <button 
      onClick={onClick}
      className={`group flex flex-col items-start w-full p-4 sm:p-5 bg-white dark:bg-stone-900 rounded-xl border-y border-r border-stone-200 dark:border-stone-800 border-l-[3px] ${color} shadow-sm hover:shadow hover:bg-stone-50 dark:hover:bg-stone-800/80 transition-all duration-200 outline-none`}
    >
      <div className="flex items-center gap-2.5 mb-1.5">
        {icon && (
          <span className="text-stone-500 dark:text-stone-400 group-hover:text-stone-700 dark:group-hover:text-stone-300 transition-colors">
            {icon}
          </span>
        )}
        <h3 className="font-semibold text-sm sm:text-base text-stone-900 dark:text-white tracking-tight">
          {title}
        </h3>
      </div>
      <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 text-left line-clamp-2">
        {description}
      </p>
    </button>
  )
}