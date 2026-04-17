import { useEffect, useState } from "react";
import { useAuth } from "../../../../contexts/AuthContext";

export default function MenuButton({
  item,
  activeSection,
  sidebarOpen,
  onClick,
  onSubItemClick,
  menuItems = [],
  nested = false,
}) {
  const hasSubmenu = sidebarOpen && menuItems.length > 0;
  const hasActiveSubItem = menuItems.some((subItem) => activeSection === subItem.id);
  const isActive = activeSection === item.id || hasActiveSubItem;
  const [submenuOpen, setSubmenuOpen] = useState(hasActiveSubItem);
  const { isDarkMode } = useAuth();

  useEffect(() => {
    if (hasActiveSubItem) setSubmenuOpen(true);
  }, [hasActiveSubItem]);

  const handleClick = () => {
    onClick?.(item.id);
    if (hasSubmenu) {
      setSubmenuOpen((prev) => !prev);
    }
  };

  // --- Modern Finance UI/UX Styling ---
  
  const baseClasses = "relative w-full flex items-center gap-3 transition-all duration-200 group overflow-hidden outline-none";
  const sizeClasses = nested ? "px-11 py-2.5" : "px-4 py-3";
  const roundedClasses = "rounded-xl";
  
  // Clean, high-contrast active states using your original Stone/Gray palette
  const primaryClasses = isActive
    ? "bg-stone-100 text-stone-900 dark:bg-stone-800 dark:text-white font-semibold"
    : "text-stone-600 hover:bg-stone-50 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800/50 dark:hover:text-white font-medium";

  // Subtler nested states
  const nestedClasses = isActive
    ? "text-stone-900 dark:text-white font-semibold bg-stone-50 dark:bg-stone-800/50"
    : "text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 hover:bg-stone-50/50 dark:hover:bg-stone-800/30 font-medium";

  return (
    <div className={`mb-1 ${nested ? 'px-0' : 'px-3'}`}>
      <button
        className={`${baseClasses} ${sizeClasses} ${roundedClasses} ${nested ? nestedClasses : primaryClasses}`}
        onClick={handleClick}
        aria-current={isActive}
        title={!sidebarOpen ? item.label : undefined}
      >
        {/* Sleek Active Indicator Pill (Left Edge) */}
        {isActive && !nested && (
          <span className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full ${isDarkMode ? 'bg-stone-200' : 'bg-stone-800'}`} />
        )}
        
        {/* Icon */}
        <span 
          className={`text-xl shrink-0 transition-colors duration-200 flex items-center justify-center ${
            isActive 
              ? (item.color || 'text-stone-900 dark:text-white') 
              : 'text-stone-400 group-hover:text-stone-600 dark:text-stone-500 dark:group-hover:text-stone-300'
          } ${!sidebarOpen ? 'w-full' : ''}`}
        >
          {item.icon}
        </span>
        
        {/* Label */}
        {sidebarOpen && (
          <span className={`flex-1 text-left tracking-wide truncate ${nested ? "text-[13px]" : "text-sm"}`}>
            {item.label}
          </span>
        )}

        {hasSubmenu && (
          <span className={`text-[10px] transition-transform ${submenuOpen ? "rotate-180" : "rotate-0"}`}>
            ▾
          </span>
        )}
      </button>

      {hasSubmenu && submenuOpen && (
        <div className="mt-1 ml-9 mr-1 space-y-0.5">
          {menuItems.map((subItem) => {
            const isSubItemActive = activeSection === subItem.id;
            return (
              <button
                key={subItem.id}
                onClick={() => onSubItemClick?.(subItem.id)}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs text-left transition-colors ${
                  isSubItemActive
                    ? "bg-stone-100 text-stone-900 dark:bg-stone-800 dark:text-white font-semibold"
                    : "text-stone-500 hover:text-stone-900 hover:bg-stone-50 dark:text-stone-400 dark:hover:text-stone-200 dark:hover:bg-stone-800/50"
                }`}
              >
                <span className={`text-[13px] shrink-0 ${isSubItemActive ? "text-stone-700 dark:text-stone-200" : "text-stone-400 dark:text-stone-500"}`}>
                  {subItem.icon}
                </span>
                <span className="truncate">{subItem.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}