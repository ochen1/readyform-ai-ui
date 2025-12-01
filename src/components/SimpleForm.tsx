import React, { useCallback, useRef, useMemo } from 'react';
import { useFormContext } from '../store/FormContext';
import { useUltravox } from '../ultravox/UltravoxProvider';
import { useAccessibility } from '../store/AccessibilityContext';
import type { FormField } from '../store/types';
import { CheckCircle, Circle, HelpCircle, Upload, Phone, PhoneOff, Mic, MicOff, Download, FileText, Minus, Plus, Loader2, Sparkles } from 'lucide-react';
import { DynamicInput, getFieldTypeIcon } from './inputs';
import { ProcessingProgress } from './ProcessingProgress';

interface FieldProps {
  field: FormField;
  isActive: boolean;
  isCompleted: boolean;
  onFocus: () => void;
  onChange: (value: string) => void;
}

function FormFieldComponent({ field, isActive, isCompleted, onFocus, onChange }: FieldProps) {
  const [showTooltip, setShowTooltip] = React.useState(false);

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
    <div className="py-4">
      <div className="flex items-start gap-6">
        {/* Label Section */}
        <div className="w-56 text-right shrink-0 pt-4">
          <div className="flex items-center justify-end gap-2">
            {TypeIcon && <span className="text-slate-700">{TypeIcon}</span>}
            <label className={`text-lg ${labelColor}`}>
              {field.name}
            </label>
          </div>
          <div className="flex items-center justify-end gap-1 mt-1">
            {field.type !== 'text' && (
              <span className={`hidden text-xs px-2 py-0.5 rounded-full ${getTypeBadgeColor()}`}>
                {field.type}
              </span>
            )}
            {field.required && (
              <span className="hidden text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600">
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
          {showTooltip && field.description && (
            <div className="absolute top-full left-0 mt-1 z-10 w-80 p-3 bg-slate-800 text-white text-sm rounded-lg shadow-lg border border-slate-600">
              <p>{field.description}</p>
              {field.calculationHint && (
                <span className="block mt-1 text-slate-200 italic">
                  Calculation: {field.calculationHint}
                </span>
              )}
              {field.format && (
                <span className="block mt-1 text-slate-200">
                  Format: {field.format}
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
          className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-200 ${checked ? 'translate-x-7' : 'translate-x-1'
            }`}
        />
      </div>
      <span className="text-black text-lg">{label}</span>
    </button>
  );
}

// PDF Upload Dropzone Component
function PDFUploader({ onUpload }: { onUpload: (file: File) => void }) {
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
          {isDragging ? 'Drop PDF here' : 'Upload a PDF Form'}
        </p>
        <p className="text-slate-700 mt-1">
          Drag and drop or click to select
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
  return (
    <div className="flex-1 flex items-center justify-center p-10">
      <div className="max-w-lg w-full">
        <PDFUploader onUpload={onUpload} />
        <p className="text-center text-slate-700 mt-6 text-lg">
          Upload a fillable PDF form to get started
        </p>
      </div>
    </div>
  );
}

export function SimpleForm() {
  const { state, dispatch, loadPDF, setField, openPDFPreview } = useFormContext();
  const { isConnected, notifyFieldFocus, status, startCall, endCall, isMicMuted, toggleMic } = useUltravox();
  const { settings, toggleDyslexiaFont, increaseFontSize, decreaseFontSize } = useAccessibility();
  const lastNotifiedFieldRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  }, [setField]);

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
    // Open the filled PDF in a new tab
    openPDFPreview();
  };

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handlePDFUpload(file);
    }
  }, [handlePDFUpload]);

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
    <div className="h-screen overflow-hidden bg-gradient-to-b from-slate-50 to-slate-100 flex">
      {/* Main Form Area - Left Side */}
      <div className="flex-1 flex flex-col min-w-0">


        {/* Form Content */}
        <main className="flex-1 py-10 px-6 overflow-y-auto">
          {!state.pdfLoaded ? (
            <EmptyState onUpload={handlePDFUpload} />
          ) : (
            <form onSubmit={handleSubmit} className="w-full bg-white rounded-2xl shadow-xl p-10 border border-slate-200">
              {/* Page-by-Page Enhancement Progress */}
              {state.isEnhancing && state.enhancementProgress && (
                <div className="mb-6">
                  <ProcessingProgress
                    progress={state.enhancementProgress}
                    showWarning={state.pageCount > 4}
                    pageCount={state.pageCount}
                  />
                </div>
              )}

              {/* Simple Loading Indicator (when no progress yet) */}
              {state.isEnhancing && !state.enhancementProgress && (
                <div className="mb-6 flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <Loader2 size={24} className="animate-spin text-blue-600" />
                  <div>
                    <p className="font-medium text-blue-800">Preparing to analyze form...</p>
                    <p className="text-sm text-blue-600">Loading PDF and extracting fields.</p>
                  </div>
                </div>
              )}

              {/* Enhancement Error */}
              {state.enhancementError && (
                <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="font-medium text-amber-800">AI enhancement unavailable</p>
                  <p className="text-sm text-amber-600">{state.enhancementError}</p>
                  <p className="text-sm text-amber-600 mt-1">Form is still usable with basic field names.</p>
                </div>
              )}

              {/* Enhancement Success (with possible page errors) */}
              {!state.isEnhancing && state.pdfLoaded && state.enhancementProgress && (
                <>
                  {/* Show page error summary if any pages failed */}
                  {state.enhancementProgress.errorPages > 0 && (
                    <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                      <p className="font-medium text-amber-800">
                        {state.enhancementProgress.errorPages} page(s) could not be analyzed
                      </p>
                      <p className="text-sm text-amber-600 mt-1">
                        These pages will use basic field names. Other pages were enhanced successfully.
                      </p>
                      <div className="mt-2 text-xs text-amber-700">
                        <strong>Failed pages:</strong>{' '}
                        {state.enhancementProgress.pageStatuses
                          .filter(p => p.status === 'error')
                          .map(p => `Page ${p.pageNumber}${p.error ? ` (${p.error})` : ''}`)
                          .join(', ')}
                      </div>
                    </div>
                  )}

                  {/* Success message */}
                  {state.enhancementProgress.errorPages === 0 && (
                    <div className="mb-6 flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <Sparkles size={20} className="text-emerald-600" />
                      <p className="text-sm text-emerald-700">
                        Form enhanced with AI • {visibleFields.length} fields identified • {state.fields.length - visibleFields.length} fields hidden
                        {state.enhancementProgress.pageStatuses.filter(p => p.fromCache).length > 0 && (
                          <span className="text-emerald-600 ml-1">
                            ({state.enhancementProgress.pageStatuses.filter(p => p.fromCache).length} pages from cache)
                          </span>
                        )}
                      </p>
                    </div>
                  )}
                </>
              )}

              {/* Simple success message when no progress tracking (legacy) */}
              {state.enhancementCached && !state.isEnhancing && !state.enhancementProgress && (
                <div className="mb-6 flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <Sparkles size={20} className="text-emerald-600" />
                  <p className="text-sm text-emerald-700">
                    Form enhanced with AI • {visibleFields.length} fields identified • {state.fields.length - visibleFields.length} fields hidden
                  </p>
                </div>
              )}

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
                            <p className="text-slate-700 text-sm mt-1">{section.description}</p>
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
                      onFocus={() => handleFieldFocus(field.id)}
                      onChange={(value) => handleFieldChange(field.id, value)}
                    />
                  ))}
                </div>
              )}

              {/* Submit/Download Button */}
              <div className="mt-10 flex justify-center gap-4">
                <button
                  type="submit"
                  className="px-12 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
                >
                  <Download size={24} />
                  Open Completed Form
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
            <Sparkles className="text-blue-600" />
            FormAI
          </h1>
        </div>

        {/* Form Details - Only show when PDF is loaded */}
        {state.pdfLoaded && (
          <div className="p-6 border-b border-slate-200 bg-slate-50/50">
            <h2 className="text-lg font-bold text-black leading-tight">
              {state.metadata ? state.metadata.title : 'Untitled Form'}
            </h2>

            {state.metadata && (
              <div className="mt-2 space-y-1">
                <p className="text-xs text-slate-700 font-medium truncate" title={state.metadata.sourceFileName}>
                  {state.metadata.sourceFileName}
                </p>
                <div className="flex flex-wrap gap-2 text-xs text-slate-700">
                  <span>{visibleFields.length} fields</span>
                  {state.isEnhancing && (
                    <span className="flex items-center gap-1 text-blue-600">
                      <Loader2 size={12} className="animate-spin" />
                      Analyzing...
                    </span>
                  )}
                  {state.enhancementCached && (
                    <span className="flex items-center gap-1 text-emerald-600">
                      <Sparkles size={12} />
                      AI Enhanced
                    </span>
                  )}
                </div>
              </div>
            )}

            {state.metadata?.description && (
              <p className="text-slate-700 text-xs mt-2 line-clamp-2" title={state.metadata.description}>
                {state.metadata.description}
              </p>
            )}

            <div className="mt-4">
              <div className="flex justify-between text-xs text-slate-800 mb-1">
                <span>Progress</span>
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
          <h2 className="text-lg font-semibold text-black mb-4">Voice Assistant</h2>

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
                End Call
              </>
            ) : (
              <>
                <Phone size={22} />
                Start Voice Assistant
              </>
            )}
          </button>

          {!state.pdfLoaded && (
            <p className="text-sm text-slate-700 mt-2 text-center">
              Upload a PDF to enable voice assistant
            </p>
          )}

          {/* Status Indicator */}
          {isConnected && (
            <div className="mt-4 flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-slate-50">
              {status === 'thinking' && (
                <span className="text-amber-600 text-lg flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
                  Thinking...
                </span>
              )}
              {status === 'speaking' && (
                <span className="text-blue-600 text-lg flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
                  Speaking...
                </span>
              )}
              {status === 'listening' && (
                <span className="text-emerald-600 text-lg flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                  Listening...
                </span>
              )}
              {(status === 'idle' || status === 'connecting') && (
                <span className="text-slate-700 text-lg flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-slate-600" />
                  Ready
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
              title={isMicMuted ? 'Unmute microphone' : 'Mute microphone'}
            >
              {isMicMuted ? <MicOff size={24} /> : <Mic size={24} />}
              <span className="font-medium">{isMicMuted ? 'Unmute' : 'Mute'}</span>
            </button>
          )}
        </div>

        {/* Accessibility Section */}
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-black mb-4">Accessibility</h2>

          {/* Dyslexia Font Toggle */}
          <Toggle
            checked={settings.dyslexiaFont}
            onChange={toggleDyslexiaFont}
            label="Dyslexia-Friendly Font"
          />

          {/* Font Size Controls */}
          <div className="mt-4">
            <label className="block text-black text-lg mb-2">Font Size</label>
            <div className="flex items-center gap-2">
              <button
                onClick={decreaseFontSize}
                className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 hover:text-black transition-colors"
                title="Decrease font size"
              >
                <Minus size={20} />
              </button>
              <span className="text-black font-medium min-w-[3rem] text-center">
                {Math.round(settings.fontSizeScale * 100)}%
              </span>
              <button
                onClick={increaseFontSize}
                className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 hover:text-black transition-colors"
                title="Increase font size"
              >
                <Plus size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Actions Section */}
        <div className="p-6">
          <h2 className="text-lg font-semibold text-black mb-4">Actions</h2>

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
            {state.pdfLoaded ? 'Upload Different PDF' : 'Upload PDF'}
          </button>

          {/* Download Button (only when PDF loaded) */}
          {state.pdfLoaded && (
            <button
              onClick={openPDFPreview}
              className="w-full mt-3 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-emerald-300 bg-emerald-50 text-emerald-700 hover:border-emerald-500 hover:bg-emerald-100 transition-all text-base font-medium"
            >
              <Download size={20} />
              Open Filled PDF
            </button>
          )}
        </div>

        {/* Spacer to push footer down */}
        <div className="flex-1" />

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-200 text-center text-sm text-slate-700">
          <p className="font-medium">FormAI - Voice-Assisted Form Filling</p>
          <p className="text-xs mt-1 text-slate-600">v2.0</p>
        </div>
      </aside>
    </div>
  );
}