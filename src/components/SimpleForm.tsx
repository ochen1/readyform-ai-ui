import React, { useCallback, useRef, useMemo, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useFormContext } from '../store/FormContext';
import { useUltravox } from '../ultravox/UltravoxProvider';
import { useAccessibility } from '../store/AccessibilityContext';
import { useLanguageContext } from '../store/LanguageContext';
import type { FormField } from '../store/types';
import type { SupportedLanguage } from '../store/languageTypes';
import { SUPPORTED_LANGUAGES } from '../store/languageTypes';
import { VOICE_CONFIGS } from '../i18n/voiceConfig';
import { CheckCircle, Circle, HelpCircle, Upload, Phone, PhoneOff, Mic, MicOff, Download, FileText, Minus, Plus, Loader2, Sparkles, X, Globe } from 'lucide-react';
import { DynamicInput, getFieldTypeIcon } from './inputs';
import Logo from '../assets/logo.svg';
import { ProcessingProgress } from './ProcessingProgress';
import { generatePDFBlob } from '../services/pdfParser';

interface FieldProps {
  field: FormField;
  isActive: boolean;
  isCompleted: boolean;
  forceShowTooltip?: boolean; // Programmatically show tooltip via voice command
  onFocus: () => void;
  onChange: (value: string) => void;
}

function FormFieldComponent({ field, isActive, isCompleted, forceShowTooltip, onFocus, onChange }: FieldProps) {
  const { t } = useTranslation();
  const [showTooltip, setShowTooltip] = React.useState(false);
  
  // Show tooltip when forced (via voice command)
  const tooltipVisible = showTooltip || forceShowTooltip;

  // Determine styling based on state
  let borderClass = 'border-slate-300 bg-white';
  let StatusIcon = Circle;
  let iconColor = 'text-slate-700';
  let labelColor = 'text-slate-900';

  const isDisabled = field.readonly || field.type === 'calculated';

  if (isDisabled) {
    borderClass = 'border-slate-200 bg-slate-50';
    iconColor = 'text-slate-600';
    labelColor = 'text-slate-600';
  } else if (isActive) {
    borderClass = 'border-orange-500 border-2 ring-4 ring-orange-100 bg-orange-50';
    StatusIcon = HelpCircle;
    iconColor = 'text-orange-500';
    labelColor = 'text-orange-700 font-semibold';
  } else if (isCompleted) {
    borderClass = 'border-emerald-500 border-2 bg-emerald-50';
    StatusIcon = CheckCircle;
    iconColor = 'text-emerald-500';
    labelColor = 'text-emerald-700';
  }

  // Get type badge color
  const getTypeBadgeColor = () => {
    switch (field.type) {
      case 'weight': return 'bg-amber-100 text-amber-700';
      case 'currency': return 'bg-green-100 text-green-700';
      case 'date': return 'bg-blue-100 text-blue-700';
      case 'percentage': return 'bg-purple-100 text-purple-700';
      case 'reference': return 'bg-slate-100 text-slate-900';
      case 'calculated': return 'bg-gray-100 text-black';
      case 'number': return 'bg-indigo-100 text-indigo-700';
      case 'address': return 'bg-cyan-100 text-cyan-700';
      case 'selection': return 'bg-pink-100 text-pink-700';
      case 'grade': return 'bg-orange-100 text-orange-700';
      default: return 'bg-slate-100 text-slate-900';
    }
  };

  // Get type-specific icon
  const TypeIcon = getFieldTypeIcon(field.type);

  return (
    <div className="py-4" data-field-id={field.id}>
      <div className="flex items-start gap-6">
        {/* Label Section */}
        <div className="w-56 text-right shrink-0 pt-4">
          <div className="flex items-center justify-end gap-2">
            {TypeIcon && <span className="text-slate-700 mr-auto">{TypeIcon}</span>}
            <label className={`text-lg ${labelColor}`}>
              {field.localizedName || field.name}
            </label>
          </div>
          <div className="flex items-center justify-end gap-1 mt-1">
            {field.type !== 'text' && (
              <span className={`hidden text-sm px-2 py-0.5 rounded-full ${getTypeBadgeColor()}`}>
                {field.type}
              </span>
            )}
            {field.required && (
              <span className="hidden text-sm px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                required
              </span>
            )}
          </div>
        </div>

        {/* Input Section - Uses dynamic input component */}
        <div
          className="relative flex-1"
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
        >
          <DynamicInput
            field={field}
            value={field.value}
            onChange={onChange}
            onFocus={onFocus}
            disabled={isDisabled}
            className={borderClass}
          />
          {tooltipVisible && field.description && (
            <div className={`absolute top-full left-0 mt-1 z-10 w-80 p-3 text-white text-base rounded-lg shadow-lg border ${forceShowTooltip ? 'bg-blue-700 border-blue-500 ring-2 ring-blue-400 animate-pulse' : 'bg-slate-800 border-slate-600'}`}>
              <p>{field.description}</p>
              {field.calculationHint && (
                <span className="block mt-1 text-slate-200 italic">
                  {t('form.calculation', { hint: field.calculationHint })}
                </span>
              )}
              {field.format && (
                <span className="block mt-1 text-slate-200">
                  {t('form.format', { format: field.format })}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Status Icon */}
        <div className={`shrink-0 pt-4 ${iconColor}`}>
          <StatusIcon size={32} strokeWidth={2.5} />
        </div>
      </div>
    </div>
  );
}

// Toggle Switch Component
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      onClick={onChange}
      className="flex items-center gap-3 focus:outline-none group"
      role="switch"
      aria-checked={checked}
      aria-label={label}
    >
      <div
        className={`relative w-14 h-8 rounded-full transition-colors duration-200 ${checked ? 'bg-blue-600' : 'bg-slate-300'
          }`}
      >
        <div
          className={`absolute top-1 left-0 w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-200 ${checked ? 'translate-x-7' : 'translate-x-1'
            }`}
        />
      </div>
      <span className="text-black text-lg">{label}</span>
    </button>
  );
}

// PDF Upload Dropzone Component
function PDFUploader({ onUpload }: { onUpload: (file: File) => void }) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
      onUpload(file);
    }
  }, [onUpload]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
    }
  }, [onUpload]);

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      className={`
        flex flex-col items-center justify-center gap-4 p-12 
        border-3 border-dashed rounded-2xl cursor-pointer
        transition-all duration-200
        ${isDragging
          ? 'border-blue-500 bg-blue-50'
          : 'border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/50'
        }
      `}
    >
      <div className={`p-4 rounded-full ${isDragging ? 'bg-blue-100' : 'bg-slate-200'}`}>
        <FileText size={48} className={isDragging ? 'text-blue-600' : 'text-slate-700'} />
      </div>
      <div className="text-center">
        <p className="text-xl font-semibold text-black">
          {isDragging ? t('upload.dropHere') : t('upload.title')}
        </p>
        <p className="text-slate-700 mt-1">
          {t('upload.dragAndDrop')}
        </p>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}

// Empty State Component
function EmptyState({ onUpload }: { onUpload: (file: File) => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex-1 flex items-center justify-center p-10">
      <div className="max-w-lg w-full">
        <PDFUploader onUpload={onUpload} />
        <p className="text-center text-slate-700 mt-6 text-lg">
          {t('upload.getStarted')}
        </p>
      </div>
    </div>
  );
}

export function SimpleForm() {
  const { t } = useTranslation();
  const { state, dispatch, loadPDF, setField } = useFormContext();
  const { isConnected, notifyFieldFocus, status, startCall, endCall, isMicMuted, toggleMic } = useUltravox();
  const { settings, toggleDyslexiaFont, increaseFontSize, decreaseFontSize } = useAccessibility();
  const { language, setLanguage: setLang } = useLanguageContext();
  const lastNotifiedFieldRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // State for programmatic tooltip display (via showTooltip voice command)
  const [tooltipFieldId, setTooltipFieldId] = useState<string | null>(null);
  
  // State for split-screen PDF preview mode
  const [showPDFPreview, setShowPDFPreview] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

  const handleFieldFocus = useCallback((fieldId: string) => {
    dispatch({ type: 'SET_ACTIVE_FIELD', fieldId });

    // Notify the voice agent when user clicks a field
    if (isConnected && fieldId !== lastNotifiedFieldRef.current) {
      lastNotifiedFieldRef.current = fieldId;
      // Find the field to get its display name
      const field = state.fields.find(f => f.id === fieldId);
      if (field) {
        notifyFieldFocus(field.name);
      }
    }
  }, [dispatch, isConnected, notifyFieldFocus, state.fields]);

  const handleFieldChange = useCallback((fieldId: string, value: string) => {
    setField(fieldId, value);

    // Find the field to check its type
    const field = state.fields.find(f => f.id === fieldId);

    // Mark field as complete when user manually enters data
    if (value && value.trim().length > 0) {
      // For checkboxes, only mark complete if checked (value is 'true')
      if (field?.type === 'checkbox') {
        if (value === 'true' || value === 'checked') {
          dispatch({ type: 'MARK_FIELD_COMPLETE', fieldId });
        } else {
          dispatch({ type: 'MARK_FIELD_INCOMPLETE', fieldId });
        }
      } else if (field?.type === 'text') {
        // For text fields, mark complete if they have any value
        if (value && value.trim().length > 0) {
          dispatch({ type: 'MARK_FIELD_COMPLETE', fieldId });
        } else {
          dispatch({ type: 'MARK_FIELD_INCOMPLETE', fieldId });
        }
      } else {
        // For other fields, mark complete if they have any value
        dispatch({ type: 'MARK_FIELD_COMPLETE', fieldId });
      }
    } else {
      // If value is empty, mark as incomplete
      dispatch({ type: 'MARK_FIELD_INCOMPLETE', fieldId });
    }
  }, [setField, dispatch, state.fields]);

  const handlePDFUpload = useCallback(async (file: File) => {
    try {
      await loadPDF(file);
    } catch (error) {
      console.error('Failed to load PDF:', error);
      alert('Failed to load PDF. Please make sure it is a valid fillable PDF form.');
    }
  }, [loadPDF]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Open the full-screen PDF preview modal
    openPDFPreviewModal();
  };

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handlePDFUpload(file);
    }
  }, [handlePDFUpload]);

  // Auto-scroll to active field when it changes
  useEffect(() => {
    if (state.activeFieldId) {
      // Small delay to allow any animations to complete
      const timeoutId = setTimeout(() => {
        const fieldElement = document.querySelector(`[data-field-id="${state.activeFieldId}"]`);
        if (fieldElement) {
          fieldElement.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
          });
        }
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [state.activeFieldId]);

  // Listen for section navigation events from voice assistant
  useEffect(() => {
    const handleSectionNavigate = (event: CustomEvent<{ section: string }>) => {
      const sectionId = event.detail.section;
      const sectionElement = document.getElementById(`section-${sectionId}`);
      
      if (sectionElement) {
        // Add a highlight animation to the section
        sectionElement.classList.add('ring-4', 'ring-blue-400', 'ring-opacity-75', 'rounded-xl');
        
        // Smooth scroll to the section with a slight offset at the top
        sectionElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
        
        // Remove highlight after animation
        setTimeout(() => {
          sectionElement.classList.remove('ring-4', 'ring-blue-400', 'ring-opacity-75', 'rounded-xl');
        }, 2000);
      }
    };
    
    window.addEventListener('form:navigate', handleSectionNavigate as EventListener);
    
    return () => {
      window.removeEventListener('form:navigate', handleSectionNavigate as EventListener);
    };
  }, []);

  // Listen for showTooltip events from voice assistant
  useEffect(() => {
    let tooltipTimeoutId: ReturnType<typeof setTimeout> | null = null;
    
    const handleShowTooltip = (event: Event) => {
      const customEvent = event as CustomEvent<{ fieldId: string; fieldName: string; content: string; duration: number }>;
      const { fieldId, duration } = customEvent.detail;
      
      // Clear any existing timeout
      if (tooltipTimeoutId) {
        clearTimeout(tooltipTimeoutId);
      }
      
      // Show the tooltip
      setTooltipFieldId(fieldId);
      
      // Auto-hide after duration
      tooltipTimeoutId = setTimeout(() => {
        setTooltipFieldId(null);
        tooltipTimeoutId = null;
      }, duration);
    };
    
    window.addEventListener('form:showTooltip', handleShowTooltip);
    
    return () => {
      window.removeEventListener('form:showTooltip', handleShowTooltip);
      if (tooltipTimeoutId) {
        clearTimeout(tooltipTimeoutId);
      }
    };
  }, []);

  // Listen for form:submit events from voice assistant to trigger split-screen PDF preview
  useEffect(() => {
    const handleFormSubmit = () => {
      if (!state.pdfBytes) {
        console.warn('[SimpleForm] Cannot show PDF preview: No PDF bytes available');
        return;
      }
      
      // Generate blob URL for the PDF
      const blob = generatePDFBlob(state.pdfBytes);
      const url = URL.createObjectURL(blob);
      
      // Set the preview URL and show split-screen mode
      setPdfPreviewUrl(url);
      setShowPDFPreview(true);
      
      console.log('[SimpleForm] Split-screen PDF preview activated');
    };
    
    window.addEventListener('form:submit', handleFormSubmit);
    
    return () => {
      window.removeEventListener('form:submit', handleFormSubmit);
    };
  }, [state.pdfBytes]);

  // Cleanup PDF preview URL when component unmounts or preview is closed
  useEffect(() => {
    return () => {
      if (pdfPreviewUrl) {
        URL.revokeObjectURL(pdfPreviewUrl);
      }
    };
  }, [pdfPreviewUrl]);

  // Function to close split-screen preview
  const closePDFPreview = useCallback(() => {
    if (pdfPreviewUrl) {
      URL.revokeObjectURL(pdfPreviewUrl);
    }
    setPdfPreviewUrl(null);
    setShowPDFPreview(false);
  }, [pdfPreviewUrl]);

  // Function to open PDF preview modal (full-page)
  const openPDFPreviewModal = useCallback(() => {
    if (!state.pdfBytes) {
      console.warn('[SimpleForm] Cannot show PDF preview: No PDF bytes available');
      return;
    }
    
    // Clean up any existing URL first
    if (pdfPreviewUrl) {
      URL.revokeObjectURL(pdfPreviewUrl);
    }
    
    // Generate blob URL for the PDF
    const blob = generatePDFBlob(state.pdfBytes);
    const url = URL.createObjectURL(blob);
    
    // Set the preview URL and show full-page modal
    setPdfPreviewUrl(url);
    setShowPDFPreview(true);
    
    console.log('[SimpleForm] Full-page PDF preview modal opened');
  }, [state.pdfBytes, pdfPreviewUrl]);

  // Function to open PDF in a new browser tab
  const openPDFInNewTab = useCallback(() => {
    if (!state.pdfBytes) {
      console.warn('[SimpleForm] Cannot open PDF: No PDF bytes available');
      return;
    }
    
    const blob = generatePDFBlob(state.pdfBytes);
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    
    // Clean up the URL after a short delay
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [state.pdfBytes]);

  // Log cache usage when enhancement completes
  useEffect(() => {
    if (!state.isEnhancing && state.enhancementProgress) {
      const cachedCount = state.enhancementProgress.pageStatuses.filter(p => p.fromCache).length;
      if (cachedCount > 0) {
        console.log(`AI Enhancement: ${cachedCount} pages loaded from cache`);
      }
    }
  }, [state.isEnhancing, state.enhancementProgress]);

  // Get visible (non-ignored) fields
  const visibleFields = state.fields.filter(f => !f.ignore);

  // Group fields by section
  const fieldsBySection = useMemo(() => {
    const grouped = new Map<string | null, FormField[]>();

    // Initialize with null for ungrouped fields
    grouped.set(null, []);

    // Initialize with each section (in order)
    state.sections.forEach(section => {
      grouped.set(section.id, []);
    });

    // Distribute fields
    visibleFields.forEach(field => {
      const sectionId = field.sectionId || null;
      const fields = grouped.get(sectionId);
      if (fields) {
        fields.push(field);
      } else {
        // If sectionId doesn't exist, add to ungrouped
        grouped.get(null)!.push(field);
      }
    });

    return grouped;
  }, [visibleFields, state.sections]);

  // Check if we have any sections with fields
  const hasSections = state.sections.length > 0 &&
    state.sections.some(section => (fieldsBySection.get(section.id)?.length || 0) > 0);

  // Calculate progress from visible, editable fields
  const editableFields = visibleFields.filter(f => !f.readonly && f.type !== 'calculated');
  const completedCount = state.completedFieldIds.filter(id =>
    editableFields.some(f => f.id === id)
  ).length;
  const totalCount = editableFields.length;
  const progressPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-b from-slate-50 to-slate-100 flex relative">
      {/* Main Form Area - Left Side */}
      <div className="flex-1 flex flex-col min-w-0">


        {/* Form Content */}
        <main className="flex-1 py-10 px-6 overflow-y-auto">
          {!state.pdfLoaded ? (
            <EmptyState onUpload={handlePDFUpload} />
          ) : (
            <form onSubmit={handleSubmit} className="w-full bg-white rounded-2xl shadow-xl p-10 border border-slate-200">


              {/* Dynamic Fields - Grouped by section if sections exist */}
              {hasSections ? (
                // Render fields grouped by section
                <div className="space-y-8">
                  {state.sections.map(section => {
                    const sectionFields = fieldsBySection.get(section.id) || [];
                    if (sectionFields.length === 0) return null;

                    return (
                      <div key={section.id} id={`section-${section.id}`} className="scroll-mt-4">
                        {/* Section Header */}
                        <div className="mb-4 pb-3 border-b-2 border-slate-200">
                          <h2 className="text-xl font-bold text-black">
                            {section.title}
                          </h2>
                          {section.description && (
                            <p className="text-slate-700 text-base mt-1">{section.description}</p>
                          )}
                        </div>

                        {/* Section Fields */}
                        <div className="space-y-2">
                          {sectionFields.map((field) => (
                            <FormFieldComponent
                              key={field.id}
                              field={field}
                              isActive={state.activeFieldId === field.id}
                              isCompleted={state.completedFieldIds.includes(field.id)}
                              forceShowTooltip={tooltipFieldId === field.id}
                              onFocus={() => handleFieldFocus(field.id)}
                              onChange={(value) => handleFieldChange(field.id, value)}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  {/* Ungrouped fields (if any) */}
                  {(fieldsBySection.get(null)?.length || 0) > 0 && (
                    <div className="space-y-2">
                      {fieldsBySection.get(null)!.map((field) => (
                        <FormFieldComponent
                          key={field.id}
                          field={field}
                          isActive={state.activeFieldId === field.id}
                          isCompleted={state.completedFieldIds.includes(field.id)}
                          forceShowTooltip={tooltipFieldId === field.id}
                          onFocus={() => handleFieldFocus(field.id)}
                          onChange={(value) => handleFieldChange(field.id, value)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                // Render all fields without sections (original behavior)
                <div className="space-y-2">
                  {visibleFields.map((field) => (
                    <FormFieldComponent
                      key={field.id}
                      field={field}
                      isActive={state.activeFieldId === field.id}
                      isCompleted={state.completedFieldIds.includes(field.id)}
                      forceShowTooltip={tooltipFieldId === field.id}
                      onFocus={() => handleFieldFocus(field.id)}
                      onChange={(value) => handleFieldChange(field.id, value)}
                    />
                  ))}
                </div>
              )}

              {/* Preview Form Button */}
              <div className="mt-10 flex justify-center gap-4">
                <button
                  type="submit"
                  className="px-12 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
                >
                  <FileText size={24} />
                  {t('form.preview')}
                </button>
              </div>
            </form>
          )}
        </main>


      </div>

      {/* Right Sidebar - Controls Panel */}
      <aside className="w-96 bg-white border-l-2 border-slate-200 flex flex-col shadow-lg">
        {/* Branding Header */}
        <div className="p-6 border-b border-slate-200 bg-slate-50">
          <h1 className="text-2xl font-bold text-black flex items-center gap-2">
            <img src={Logo} alt="FormAI Logo" className="w-8 h-8" />
            ReadyFormAI
          </h1>
        </div>

        {/* Form Details - Only show when PDF is loaded */}
        {state.pdfLoaded && (
          <div className="p-6 border-b border-slate-200 bg-slate-50/50">
            <h2 className="text-lg font-bold text-black leading-tight">
              {state.metadata ? state.metadata.title : t('form.untitled')}
            </h2>

            {state.metadata && (
              <div className="mt-2 space-y-1">
                <p className="text-sm text-slate-700 font-medium truncate" title={state.metadata.sourceFileName}>
                  {state.metadata.sourceFileName}
                </p>
                <div className="flex flex-wrap gap-2 text-sm text-slate-700">
                  {state.isEnhancing && (
                    <span className="flex items-center gap-1 text-blue-600">
                      <Loader2 size={14} className="animate-spin" />
                      {t('enhancement.analyzing')}
                    </span>
                  )}
                </div>
              </div>
            )}

            {state.metadata?.description && (
              <p className="text-slate-700 text-sm mt-2 line-clamp-2" title={state.metadata.description}>
                {state.metadata.description}
              </p>
            )}

            {/* Page-by-Page Enhancement Progress */}
            {state.isEnhancing && state.enhancementProgress && (
              <div className="mt-4">
                <ProcessingProgress
                  progress={state.enhancementProgress}
                  showWarning={false}
                  pageCount={state.pageCount}
                />
              </div>
            )}

            {/* Simple Loading Indicator (when no progress yet) */}
            {state.isEnhancing && !state.enhancementProgress && (
              <div className="mt-4 flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                <Loader2 size={20} className="animate-spin text-blue-600" />
                <div>
                  <p className="font-medium text-blue-800 text-base">{t('enhancement.preparing')}</p>
                  <p className="text-sm text-blue-600">{t('enhancement.loading')}</p>
                </div>
              </div>
            )}

            {/* Enhancement Results */}
            {!state.isEnhancing && state.enhancementProgress && (
              <div className="mt-4 space-y-3">
                {/* Error Summary */}
                {state.enhancementProgress.errorPages > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <p className="font-medium text-amber-800 text-base">
                      {t('enhancement.pagesFailed', { count: state.enhancementProgress.errorPages })}
                    </p>
                    <div className="mt-1 text-sm text-amber-700">
                      {state.enhancementProgress.pageStatuses
                        .filter(p => p.status === 'error')
                        .map(p => t('enhancement.pageNumber', { number: p.pageNumber }))
                        .join(', ')}
                    </div>
                  </div>
                )}

                {/* Success Stats */}
                {state.enhancementProgress.errorPages === 0 && (
                  <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                    <Sparkles size={16} className="text-emerald-600 shrink-0" />
                    <span>
                      {t('enhancement.enhanced')} • {t('enhancement.fieldsFound', { count: visibleFields.length })}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Global Enhancement Error */}
            {state.enhancementError && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <p className="font-medium text-amber-800 text-base">{t('enhancement.failed')}</p>
                <p className="text-sm text-amber-600 mt-1">{state.enhancementError}</p>
              </div>
            )}

            {/* Legacy Success (Full Cache) */}
            {state.enhancementCached && !state.isEnhancing && !state.enhancementProgress && (
              <div className="mt-4 flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 p-2 rounded-lg border border-emerald-100">
                <Sparkles size={16} className="text-emerald-600 shrink-0" />
                <span>
                  {t('enhancement.enhanced')} • {t('enhancement.fields', { count: visibleFields.length })}
                </span>
              </div>
            )}

            <div className="mt-4">
              <div className="flex justify-between text-sm text-slate-800 mb-1">
                <span>{t('common.progress')}</span>
                <span>{progressPercentage}%</span>
              </div>
              <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Voice Assistant Section */}
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-black mb-4">{t('voice.title')}</h2>

          {/* Voice Toggle Button */}
          <button
            onClick={isConnected ? endCall : startCall}
            disabled={!state.pdfLoaded}
            className={`w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-semibold text-lg transition-all duration-200 shadow-md hover:shadow-lg ${!state.pdfLoaded
              ? 'bg-slate-300 text-slate-600 cursor-not-allowed'
              : isConnected
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
          >
            {isConnected ? (
              <>
                <PhoneOff size={22} />
                {t('voice.end')}
              </>
            ) : (
              <>
                <Phone size={22} />
                {t('voice.start')}
              </>
            )}
          </button>

          {!state.pdfLoaded && (
            <p className="text-base text-slate-700 mt-2 text-center">
              {t('voice.needPdf')}
            </p>
          )}

          {/* Status Indicator */}
          {isConnected && (
            <div className="mt-4 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-50">
              {status === 'thinking' && (
                <span className="text-amber-600 text-lg flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
                  {t('voice.thinking')}
                </span>
              )}
              {status === 'speaking' && (
                <span className="text-blue-600 text-lg flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
                  {t('voice.speaking')}
                </span>
              )}
              {status === 'listening' && (
                <span className="text-emerald-600 text-lg flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                  {t('voice.listening')}
                </span>
              )}
              {(status === 'idle' || status === 'connecting') && (
                <span className="text-slate-700 text-lg flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-slate-600" />
                  {t('voice.ready')}
                </span>
              )}
            </div>
          )}

          {/* Mic Toggle (only when connected) */}
          {isConnected && (
            <button
              onClick={toggleMic}
              className={`mt-3 w-full flex items-center justify-center gap-2 p-3 rounded-xl transition-colors ${isMicMuted
                ? 'bg-red-100 text-red-600 hover:bg-red-200'
                : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                }`}
              title={isMicMuted ? t('voice.unmuteMic') : t('voice.muteMic')}
            >
              {isMicMuted ? <MicOff size={24} /> : <Mic size={24} />}
              <span className="font-medium">{isMicMuted ? t('voice.unmute') : t('voice.mute')}</span>
            </button>
          )}
        </div>

        {/* Accessibility Section */}
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-black mb-4">{t('accessibility.title')}</h2>

          {/* Dyslexia Font Toggle */}
          <Toggle
            checked={settings.dyslexiaFont}
            onChange={toggleDyslexiaFont}
            label={t('accessibility.dyslexiaFont')}
          />

          {/* Font Size Controls */}
          <div className="mt-4">
            <label className="block text-black text-lg mb-2">{t('accessibility.fontSize')}</label>
            <div className="flex items-center gap-2">
              <button
                onClick={decreaseFontSize}
                className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 hover:text-black transition-colors"
                title={t('accessibility.decreaseFont')}
              >
                <Minus size={20} />
              </button>
              <span className="text-black font-medium min-w-[3rem] text-center">
                {Math.round(settings.fontSizeScale * 100)}%
              </span>
              <button
                onClick={increaseFontSize}
                className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 hover:text-black transition-colors"
                title={t('accessibility.increaseFont')}
              >
                <Plus size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Language Section */}
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-black mb-4 flex items-center gap-2">
            <Globe size={20} />
            {t('language.title')}
          </h2>
          <label className="block text-black text-lg mb-2">{t('language.label')}</label>
          <select
            value={language.currentLanguage}
            onChange={(e) => setLang(e.target.value as SupportedLanguage)}
            className="w-full px-4 py-3 rounded-xl border-2 border-slate-300 bg-white text-slate-900 text-base font-medium focus:border-blue-500 focus:outline-none transition-colors"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {VOICE_CONFIGS[lang].nativeName} ({VOICE_CONFIGS[lang].englishName})
              </option>
            ))}
          </select>
        </div>

        {/* Actions Section */}
        <div className="p-6">
          <h2 className="text-lg font-semibold text-black mb-4">{t('form.actions')}</h2>

          {/* PDF Upload - Hidden file input with button trigger */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileInputChange}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-slate-300 bg-white text-slate-900 hover:border-blue-500 hover:text-blue-600 transition-all text-base font-medium"
          >
            <Upload size={20} />
            {state.pdfLoaded ? t('upload.buttonChange') : t('upload.button')}
          </button>

          {/* Preview Form Button (only when PDF loaded) */}
          {state.pdfLoaded && (
            <button
              onClick={openPDFPreviewModal}
              className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-emerald-300 bg-emerald-50 text-emerald-700 hover:border-emerald-500 hover:bg-emerald-100 transition-all text-base font-medium"
            >
              <FileText size={20} />
              {t('form.preview')}
            </button>
          )}
        </div>

        {/* Spacer to push footer down */}
        <div className="flex-1" />


      </aside>

      {/* Full-Page PDF Preview Modal */}
      {showPDFPreview && pdfPreviewUrl && (
        <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center animate-in fade-in duration-200">
          <div className="w-[90vw] h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <FileText size={24} className="text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-black">{t('form.completedPreview')}</h2>
                  <p className="text-sm text-slate-600">
                    {state.metadata?.sourceFileName || 'PDF Preview'}
                  </p>
                </div>
              </div>
              <button
                onClick={closePDFPreview}
                className="p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-200 transition-colors"
                title={t('common.closePreview')}
              >
                <X size={24} />
              </button>
            </div>
            
            {/* PDF Iframe */}
            <div className="flex-1 bg-slate-200">
              <iframe
                src={pdfPreviewUrl}
                className="w-full h-full border-0"
                title={t('form.completedPreview')}
              />
            </div>
            
            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex gap-3 justify-end">
              <button
                onClick={closePDFPreview}
                className="px-6 py-3 rounded-xl border-2 border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-100 font-medium transition-colors"
              >
                {t('common.backToForm')}
              </button>
              <button
                onClick={openPDFInNewTab}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors"
              >
                <Download size={20} />
                {t('common.openInNewTab')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}