"use client"

import { useAuth } from "../../../../contexts/AuthContext"

function DataTable({ columns, data, onRowClick }) {
  const { isDarkMode } = useAuth()
  return (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <div className="inline-block min-w-full align-middle">
        <table className={`min-w-full divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
          <thead className={isDarkMode ? "bg-stone-700" : "bg-stone-50"}>
            <tr>
              {columns.map((column, idx) => (
                <th 
                  key={idx}
                  className={`px-3 sm:px-6 py-2 sm:py-3 text-left text-xs font-medium uppercase tracking-wider ${isDarkMode ? 'text-gray-300' : 'text-gray-500'}`}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={`${isDarkMode ? 'bg-stone-800 divide-gray-700' : 'bg-white divide-gray-200'} divide-y`}>
            {data.map((row, rowIdx) => (
              <tr 
                key={rowIdx}
                className={`${onRowClick ? 'cursor-pointer' : ''} ${isDarkMode ? 'hover:bg-stone-700' : 'hover:bg-stone-50'} transition-colors`}
              >
                {columns.map((column, colIdx) => (
                  <td 
                    key={colIdx} 
                    className={`px-3 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm whitespace-nowrap ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}
                    onClick={(e) => {
                      // Don't trigger row click for specific columns (like checkboxes)
                      if (column.key === 'select' || column.preventRowClick) {
                        e.stopPropagation()
                        return
                      }
                      // Prevent row click if inline editing is active for this row
                      if (row.editingRowId) return;
                      if (onRowClick) {
                        onRowClick(row)
                      }
                    }}
                  >
                    {column.render ? column.render(row) : row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default DataTable

