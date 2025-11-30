import React, { useCallback, useRef } from 'react';
import { useFormContext } from '../store/FormContext';
import { useUltravox } from '../ultravox/UltravoxProvider';
import { useAccessibility } from '../store/AccessibilityContext';
import type { FormField } from '../store/types';
import { CheckCircle, Circle, HelpCircle, Upload, Phone, PhoneOff, Mic, MicOff, Download, FileText, Minus, Plus } from 'lucide-react';

interface FieldProps {
  field: FormField;
  isActive: boolean;
  isCompleted: boolean;
  onFocus: () => void;
  onChange: (value: string) => void;
}

function FormFieldComponent({ field, isActive, isCompleted, onFocus, onChange }: FieldProps) {
  // Determine border and icon based on state
  let borderClass = 'border-slate-300 bg-white'; // default/pending
  let Icon = Circle;
  let iconColor = 'text-slate-400';
  let labelColor = 'text-slate-600';
  
  if (field.readonly) {
    borderClass = 'border-slate-200 bg-slate-50';
    iconColor = 'text-slate-300';
    labelColor = 'text-slate-400';
  } else if (isActive) {
    borderClass = 'border-orange-500 border-2 ring-4 ring-orange-100 bg-orange-50';
    Icon = HelpCircle;
    iconColor = 'text-orange-500';
    labelColor = 'text-orange-700 font-semibold';
  } else if (isCompleted) {
    borderClass = 'border-emerald-500 border-2 bg-emerald-50';
    Icon = CheckCircle;
    iconColor = 'text-emerald-500';
    labelColor = 'text-emerald-700';
  }

  return (
    <div className="flex items-center gap-6 py-4">
      <label className={`w-56 text-right text-lg shrink-0 ${labelColor}`}>
        {field.name}
      </label>
      
      <input
        type="text"
        value={field.value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        disabled={field.readonly}
        className={`flex-1 px-5 py-4 rounded-xl border-2 ${borderClass} text-xl focus:outline-none transition-all duration-200 ${field.readonly ? 'cursor-not-allowed' : ''}`}
        placeholder={field.readonly ? '(Read-only)' : 'Enter value...'}
      />
      
      <div className={`shrink-0 ${iconColor}`}>
        <Icon size={32} strokeWidth={2.5} />
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
        className={`relative w-14 h-8 rounded-full transition-colors duration-200 ${
          checked ? 'bg-blue-600' : 'bg-slate-300'
        }`}
      >
        <div 
          className={`absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-200 ${
            checked ? 'translate-x-7' : 'translate-x-1'
          }`}
        />
      </div>
      <span className="text-slate-700 text-lg">{label}</span>
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
        <FileText size={48} className={isDragging ? 'text-blue-600' : 'text-slate-500'} />
      </div>
      <div className="text-center">
        <p className="text-xl font-semibold text-slate-700">
          {isDragging ? 'Drop PDF here' : 'Upload a PDF Form'}
        </p>
        <p className="text-slate-500 mt-1">
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
        <p className="text-center text-slate-500 mt-6 text-lg">
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

  // Calculate progress
  const editableFields = state.fields.filter(f => !f.readonly);
  const completedCount = state.completedFieldIds.length;
  const totalCount = editableFields.length;
  const progressPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex">
      {/* Main Form Area - Left Side */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-white border-b-2 border-slate-200 px-8 py-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-slate-800">
                {state.pdfLoaded && state.metadata ? state.metadata.title : 'FormAI'}
              </h1>
              {state.pdfLoaded && state.metadata && (
                <p className="text-slate-500 mt-1">
                  {state.metadata.sourceFileName} • {state.metadata.fieldCount} fields
                </p>
              )}
            </div>
            {state.pdfLoaded && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 transition-all duration-300"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
                <span>{progressPercentage}% complete</span>
              </div>
            )}
          </div>
        </header>

        {/* Form Content */}
        <main className="flex-1 py-10 px-6 overflow-y-auto">
          {!state.pdfLoaded ? (
            <EmptyState onUpload={handlePDFUpload} />
          ) : (
            <form onSubmit={handleSubmit} className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl p-10 border border-slate-200">
              {/* Dynamic Fields */}
              <div className="space-y-2">
                {state.fields.map((field) => (
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

        {/* Footer */}
        <footer className="bg-white border-t border-slate-200 py-4 px-8 text-center text-slate-500">
          <p>FormAI - Voice-Assisted Form Filling</p>
        </footer>
      </div>

      {/* Right Sidebar - Controls Panel */}
      <aside className="w-96 bg-white border-l-2 border-slate-200 flex flex-col shadow-lg">
        {/* Voice Assistant Section */}
        <div className="p-6 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-700 mb-4">Voice Assistant</h2>
          
          {/* Voice Toggle Button */}
          <button
            onClick={isConnected ? endCall : startCall}
            disabled={!state.pdfLoaded}
            className={`w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl font-semibold text-lg transition-all duration-200 shadow-md hover:shadow-lg ${
              !state.pdfLoaded
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
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
            <p className="text-sm text-slate-500 mt-2 text-center">
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
                <span className="text-slate-500 text-lg flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-slate-400" />
                  Ready
                </span>
              )}
            </div>
          )}

          {/* Mic Toggle (only when connected) */}
          {isConnected && (
            <button
              onClick={toggleMic}
              className={`mt-3 w-full flex items-center justify-center gap-2 p-3 rounded-xl transition-colors ${
                isMicMuted
                  ? 'bg-red-100 text-red-600 hover:bg-red-200'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
          <h2 className="text-lg font-semibold text-slate-700 mb-4">Accessibility</h2>
          
          {/* Dyslexia Font Toggle */}
          <Toggle
            checked={settings.dyslexiaFont}
            onChange={toggleDyslexiaFont}
            label="Dyslexia-Friendly Font"
          />

          {/* Font Size Controls */}
          <div className="mt-4">
            <label className="block text-slate-700 text-lg mb-2">Font Size</label>
            <div className="flex items-center gap-2">
              <button
                onClick={decreaseFontSize}
                className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 transition-colors"
                title="Decrease font size"
              >
                <Minus size={20} />
              </button>
              <span className="text-slate-700 font-medium min-w-[3rem] text-center">
                {Math.round(settings.fontSizeScale * 100)}%
              </span>
              <button
                onClick={increaseFontSize}
                className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-800 transition-colors"
                title="Increase font size"
              >
                <Plus size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* Actions Section */}
        <div className="p-6">
          <h2 className="text-lg font-semibold text-slate-700 mb-4">Actions</h2>
          
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
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-slate-300 bg-white text-slate-700 hover:border-blue-500 hover:text-blue-600 transition-all text-base font-medium"
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
        <div className="p-4 border-t border-slate-200 text-center text-sm text-slate-500">
          FormAI v2.0
        </div>
      </aside>
    </div>
  );
}