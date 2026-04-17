import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from "../../../../contexts/AuthContext";
import { 
  LuX, LuPlus, LuSave, LuBuilding2, LuPhone, LuMail, 
  LuGlobe, LuMapPin, LuChevronDown, LuChevronRight, LuTrash2,
} from 'react-icons/lu';
import { ToastContainer } from '../main_ui/Toast';
import { useToast } from '../../hooks/useToast';
import { MonthlyBillsService } from '../../../../utils/api/services/monthly-bills-service';

import {
  PROVIDER_CATEGORIES,
  getCategoryIcon,
  getCategoryLabel,
  formatPhoneNumber,
} from './providers-config';

const monthlyBillsService = new MonthlyBillsService();

// ============================================================================
// Main Bulk Creator Component
// ============================================================================

export default function ProvidersBulkCreator({ 
  isOpen, 
  onClose,
  isDarkMode: propIsDarkMode,
  editMode = false,
  initialData = null
}) {
  const { isDarkMode: authIsDarkMode } = useAuth();
  const isDarkMode = typeof propIsDarkMode !== 'undefined' ? propIsDarkMode : authIsDarkMode;
  const { toasts, showSuccess, showError, showWarning, removeToast } = useToast();
  const modalRef = useRef(null);

  const buildProvidersFromInitialData = (data) => ([{ ...data, ui_id: `prov-${Date.now()}`, expanded: true }]);

  const [providers, setProviders] = useState(() => {
    if (editMode && initialData) {
      return buildProvidersFromInitialData(initialData);
    }
    return [createEmptyProvider()];
  });

  useEffect(() => {
    if (!isOpen) return;

    if (editMode) {
      if (initialData) {
        setProviders(buildProvidersFromInitialData(initialData));
      }
      return;
    }

    setProviders([createEmptyProvider()]);
  }, [isOpen, editMode, initialData?.id]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  function createEmptyProvider() {
    return {
      ui_id: `prov-${Date.now()}-${Math.random()}`,
      provider_name: '',
      category: 'electricity',
      contact_person: '',
      phone: '',
      email: '',
      address: '',
      hotline: '',
      website: '',
      notes: '',
      is_active: true,
      expanded: true
    };
  }

  const handleAddProviders = (count) => {
    const newProviders = Array.from({ length: count }, () => createEmptyProvider());
    setProviders(prev => [...prev, ...newProviders]);
  };

  const handleDeleteProvider = (uiId) => {
    if (providers.length === 1) {
      showWarning?.('Cannot delete the last provider entry.');
      return;
    }
    setProviders(providers.filter(p => p.ui_id !== uiId));
  };

  const handleUpdateProvider = (uiId, updates) => {
    setProviders(providers.map(p => p.ui_id === uiId ? { ...p, ...updates } : p));
  };

  const toggleExpanded = (uiId) => {
    setProviders(providers.map(p => p.ui_id === uiId ? { ...p, expanded: !p.expanded } : p));
  };

  const handleSaveAll = async () => {
    // 1. Validation
    for (const prov of providers) {
      if (!prov.provider_name?.trim()) {
        showWarning?.('Please ensure all providers have a name.');
        return;
      }
      if (!prov.category) {
        showWarning?.(`Please select a category for ${prov.provider_name}.`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      for (const prov of providers) {
        const { ui_id, expanded, ...payload } = prov; // Strip UI state
        
        if (editMode && initialData?.id) {
          await monthlyBillsService.updateProvider(initialData.id, payload);
        } else {
          await monthlyBillsService.createProvider(payload);
        }
      }

      showSuccess?.(editMode ? 'Provider updated successfully!' : `Successfully created ${providers.length} provider(s)!`);
      onClose();
    } catch (error) {
      console.error('Failed to save providers:', error);
      showError?.('Failed to save providers: ' + (error.message || 'Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const bgBase = isDarkMode ? 'bg-stone-950' : 'bg-stone-100';
  const bgCard = isDarkMode ? 'bg-stone-900' : 'bg-white';
  const textPrimary = isDarkMode ? 'text-gray-100' : 'text-gray-900';
  const textSecondary = isDarkMode ? 'text-gray-400' : 'text-gray-500';
  const borderCol = isDarkMode ? 'border-gray-800' : 'border-gray-200';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 sm:p-6">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <div 
        ref={modalRef}
        className={`w-full max-w-5xl max-h-[92vh] flex flex-col rounded-3xl shadow-2xl overflow-hidden border ${borderCol} ${bgBase} animate-in zoom-in-95 duration-200`}
      >
        {/* --- HEADER --- */}
        <div className={`sticky top-0 z-20 px-6 py-5 border-b ${borderCol} ${bgCard} flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0`}>
          <div>
            <h2 className={`text-xl font-bold flex items-center gap-2 ${textPrimary}`}>
               <LuBuilding2 className="w-5 h-5 text-emerald-500" />
               {editMode ? 'Edit Service Provider' : 'Bulk Create Providers'}
            </h2>
            <div className={`mt-1 text-sm font-medium ${textSecondary}`}>
              Add one or multiple service providers at once.
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button 
              onClick={handleSaveAll}
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
            >
              <LuSave size={16} /> {isSubmitting ? 'Saving...' : (editMode ? 'Update' : 'Save All')}
            </button>
            <button 
              onClick={onClose}
              className={`p-2.5 rounded-full transition-colors ${isDarkMode ? 'hover:bg-stone-800 text-gray-400' : 'hover:bg-stone-200 text-gray-500'}`}
            >
              <LuX size={20} />
            </button>
          </div>
        </div>

        {/* --- SCROLLABLE CONTENT --- */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {providers.map((prov, index) => (
            <ProviderCard
              key={prov.ui_id}
              index={index}
              provider={prov}
              editMode={editMode}
              isDarkMode={isDarkMode}
              onUpdate={(u) => handleUpdateProvider(prov.ui_id, u)}
              onDelete={() => handleDeleteProvider(prov.ui_id)}
              onToggleExpanded={() => toggleExpanded(prov.ui_id)}
            />
          ))}

          {!editMode && (
             <button 
               onClick={() => handleAddProviders(1)}
               className={`w-full py-5 rounded-2xl border-2 border-dashed flex items-center justify-center gap-2 transition-all opacity-60 hover:opacity-100 font-medium ${
                 isDarkMode ? 'border-gray-700 hover:border-gray-600 text-gray-400 hover:bg-stone-800/50' : 'border-gray-300 hover:border-emerald-300 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50/50'
               }`}
             >
               <LuPlus size={20} /> Add Another Provider
             </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Individual Provider Card
// ============================================================================

function ProviderCard({ 
  provider, 
  index,
  editMode,
  isDarkMode,
  onUpdate, 
  onDelete, 
  onToggleExpanded
}) {
  const cardBg = isDarkMode ? 'bg-stone-900' : 'bg-white';
  const borderCol = isDarkMode ? 'border-gray-800' : 'border-gray-200';
  const inputBg = isDarkMode ? 'bg-stone-950 border-gray-700 focus:border-emerald-500 text-white placeholder-gray-600' : 'bg-stone-50 border-gray-200 focus:border-emerald-500 text-gray-900 placeholder-gray-400';
  const labelCol = isDarkMode ? 'text-gray-400' : 'text-gray-500';
  const Icon = getCategoryIcon(provider.category);

  return (
    <div className={`rounded-2xl border shadow-sm transition-all duration-200 ${cardBg} ${borderCol}`}>
        
        {/* --- CARD HEADER --- */}
        <div className="p-4 sm:px-6 sm:py-5 flex items-center justify-between cursor-pointer" onClick={onToggleExpanded}>
            <div className="flex items-center gap-4">
                <button className={`p-1.5 rounded-lg transition-colors ${isDarkMode ? 'hover:bg-stone-800' : 'hover:bg-stone-100'}`}>
                {provider.expanded ? <LuChevronDown size={20} /> : <LuChevronRight size={20} />}
                </button>
                <div className={`p-2.5 rounded-xl ${isDarkMode ? 'bg-stone-800 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
                    <Icon size={20} />
                </div>
                <div className="flex flex-col">
                <span className={`text-base font-bold ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}`}>
                    {provider.provider_name || `New Provider #${index + 1}`}
                </span>
                <span className={`text-xs font-medium uppercase tracking-wider ${labelCol}`}>
                    {getCategoryLabel(provider.category)}
                </span>
                </div>
            </div>

            <div className="flex items-center gap-4" onClick={(e) => e.stopPropagation()}>
                {/* Active Toggle */}
                <label className="relative inline-flex items-center cursor-pointer" title="Toggle Active Status">
                    <input 
                        type="checkbox"
                        checked={provider.is_active}
                        onChange={(e) => onUpdate({ is_active: e.target.checked })}
                        className="sr-only peer"
                    />
                    <div className={`w-9 h-5 rounded-full peer peer-checked:bg-emerald-500 ${isDarkMode ? 'bg-stone-700' : 'bg-stone-300'} peer-focus:outline-none relative transition-colors`}>
                        <div className={`absolute top-[2px] left-[2px] bg-white w-4 h-4 rounded-full transition-transform ${provider.is_active ? 'translate-x-4' : 'translate-x-0'}`}></div>
                    </div>
                    <span className={`ml-2 text-xs font-bold uppercase tracking-wider ${provider.is_active ? 'text-emerald-500' : labelCol}`}>
                        {provider.is_active ? 'Active' : 'Inactive'}
                    </span>
                </label>

                {!editMode && (
                    <button onClick={onDelete} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors">
                        <LuTrash2 size={18} />
                    </button>
                )}
            </div>
        </div>

        {/* --- CARD BODY (Grid Form) --- */}
        {provider.expanded && (
            <div className={`border-t p-4 sm:p-6 grid grid-cols-1 md:grid-cols-12 gap-5 ${borderCol}`}>
                
                {/* Basic Info (Col 1) */}
                <div className="md:col-span-4 space-y-4">
                    <h4 className={`text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
                        <LuBuilding2 size={14} /> Basic Details
                    </h4>
                    
                    <div>
                        <label className={`block text-xs font-semibold mb-1.5 ${labelCol}`}>Provider Name <span className="text-red-500">*</span></label>
                        <input 
                            type="text" 
                            value={provider.provider_name}
                            onChange={(e) => onUpdate({ provider_name: e.target.value })}
                            placeholder="e.g. Meralco, PLDT"
                            className={`w-full px-4 py-2.5 rounded-xl border outline-none transition-all text-sm font-medium ${inputBg}`} 
                        />
                    </div>
                    <div>
                        <label className={`block text-xs font-semibold mb-1.5 ${labelCol}`}>Category <span className="text-red-500">*</span></label>
                        <select 
                            value={provider.category}
                            onChange={(e) => onUpdate({ category: e.target.value })}
                            className={`w-full px-4 py-2.5 rounded-xl border outline-none transition-all text-sm font-medium ${inputBg}`}
                        >
                            {PROVIDER_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className={`block text-xs font-semibold mb-1.5 ${labelCol}`}>Hotline / Short Code</label>
                        <div className="relative">
                            <LuPhone size={14} className={`absolute left-3 top-3.5 ${labelCol}`} />
                            <input 
                                type="text" 
                                value={provider.hotline}
                                onChange={(e) => onUpdate({ hotline: e.target.value })}
                                placeholder="e.g. 16211"
                                className={`w-full pl-9 pr-4 py-2.5 rounded-xl border outline-none transition-all text-sm font-medium ${inputBg}`} 
                            />
                        </div>
                    </div>
                </div>

                {/* Contact Info (Col 2) */}
                <div className="md:col-span-4 space-y-4">
                    <h4 className={`text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
                        <LuPhone size={14} /> Contact Details
                    </h4>
                    
                    <div>
                        <label className={`block text-xs font-semibold mb-1.5 ${labelCol}`}>Contact Person</label>
                        <input 
                            type="text" 
                            value={provider.contact_person}
                            onChange={(e) => onUpdate({ contact_person: e.target.value })}
                            placeholder="Full name"
                            className={`w-full px-4 py-2.5 rounded-xl border outline-none transition-all text-sm font-medium ${inputBg}`} 
                        />
                    </div>
                    <div>
                        <label className={`block text-xs font-semibold mb-1.5 ${labelCol}`}>Phone Number</label>
                        <div className="relative">
                            <LuPhone size={14} className={`absolute left-3 top-3.5 ${labelCol}`} />
                            <input 
                                type="tel" 
                                value={provider.phone}
                                onChange={(e) => onUpdate({ phone: formatPhoneNumber(e.target.value) })}
                                placeholder="09XX-XXX-XXXX"
                                className={`w-full pl-9 pr-4 py-2.5 rounded-xl border outline-none transition-all text-sm font-mono ${inputBg}`} 
                            />
                        </div>
                    </div>
                    <div>
                        <label className={`block text-xs font-semibold mb-1.5 ${labelCol}`}>Email Address</label>
                        <div className="relative">
                            <LuMail size={14} className={`absolute left-3 top-3.5 ${labelCol}`} />
                            <input 
                                type="email" 
                                value={provider.email}
                                onChange={(e) => onUpdate({ email: e.target.value })}
                                placeholder="contact@provider.com"
                                className={`w-full pl-9 pr-4 py-2.5 rounded-xl border outline-none transition-all text-sm font-medium ${inputBg}`} 
                            />
                        </div>
                    </div>
                </div>

                {/* Additional Info (Col 3) */}
                <div className="md:col-span-4 space-y-4">
                    <h4 className={`text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2 ${isDarkMode ? 'text-emerald-400' : 'text-emerald-600'}`}>
                        <LuMapPin size={14} /> Location & Web
                    </h4>
                    
                    <div>
                        <label className={`block text-xs font-semibold mb-1.5 ${labelCol}`}>Website</label>
                        <div className="relative">
                            <LuGlobe size={14} className={`absolute left-3 top-3.5 ${labelCol}`} />
                            <input 
                                type="text" 
                                value={provider.website}
                                onChange={(e) => onUpdate({ website: e.target.value })}
                                placeholder="www.provider.com"
                                className={`w-full pl-9 pr-4 py-2.5 rounded-xl border outline-none transition-all text-sm font-medium ${inputBg}`} 
                            />
                        </div>
                    </div>
                    <div>
                        <label className={`block text-xs font-semibold mb-1.5 ${labelCol}`}>Complete Address</label>
                        <textarea 
                            value={provider.address}
                            onChange={(e) => onUpdate({ address: e.target.value })}
                            placeholder="Enter business address..."
                            rows={1}
                            className={`w-full px-4 py-2.5 rounded-xl border outline-none transition-all text-sm font-medium resize-none ${inputBg}`} 
                        />
                    </div>
                    <div>
                        <label className={`block text-xs font-semibold mb-1.5 ${labelCol}`}>Internal Notes</label>
                        <textarea 
                            value={provider.notes}
                            onChange={(e) => onUpdate({ notes: e.target.value })}
                            placeholder="Specific instructions or account numbers..."
                            rows={1}
                            className={`w-full px-4 py-2.5 rounded-xl border outline-none transition-all text-sm font-medium resize-none ${inputBg}`} 
                        />
                    </div>
                </div>
            </div>
        )}
    </div>
  );
}