import React, { useCallback, useRef } from 'react';
import { useFormContext } from '../store/FormContext';
import { useUltravox } from '../ultravox/UltravoxProvider';
import { useAccessibility } from '../store/AccessibilityContext';
import { FIELD_LABELS } from '../store/types';
import { CheckCircle, Circle, HelpCircle, Upload, Phone, PhoneOff, Mic, MicOff } from 'lucide-react';

interface FieldProps {
  name: string;
  label: string;
  value: string | number;
  isActive: boolean;
  isCompleted: boolean;
  onFocus: () => void;
  onChange: (value: string) => void;
  type?: 'text' | 'number' | 'date' | 'select';
  options?: string[];
}

function FormField({ name, label, value, isActive, isCompleted, onFocus, onChange, type = 'text', options }: FieldProps) {
  // Determine border and icon based on state
  let borderClass = 'border-slate-300 bg-white'; // default/pending
  let Icon = Circle;
  let iconColor = 'text-slate-400';
  let labelColor = 'text-slate-600';
  
  if (isActive) {
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
      <label className={`w-48 text-right text-lg shrink-0 ${labelColor}`}>
        {label}
      </label>
      
      {type === 'select' && options ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          className={`flex-1 px-5 py-4 rounded-xl border-2 ${borderClass} text-xl focus:outline-none transition-all duration-200`}
        >
          {options.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          className={`flex-1 px-5 py-4 rounded-xl border-2 ${borderClass} text-xl focus:outline-none transition-all duration-200`}
        />
      )}
      
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

export function SimpleForm() {
  const { state, dispatch } = useFormContext();
  const { isConnected, notifyFieldFocus, status, startCall, endCall, isMicMuted, toggleMic } = useUltravox();
  const { settings, toggleDyslexiaFont } = useAccessibility();
  const lastNotifiedFieldRef = useRef<string | null>(null);

  const handleFieldFocus = useCallback((fieldName: string) => {
    dispatch({ type: 'SET_ACTIVE_FIELD', field: fieldName });
    
    // Notify the voice agent when user clicks a field
    if (isConnected && fieldName !== lastNotifiedFieldRef.current) {
      lastNotifiedFieldRef.current = fieldName;
      notifyFieldFocus(fieldName);
    }
  }, [dispatch, isConnected, notifyFieldFocus]);

  const handleFieldChange = useCallback((fieldName: string, value: string) => {
    // Convert to number for numeric fields
    const numericFields = ['grossWeight', 'vehicleWeight', 'dockage', 'pricePerTonne'];
    const finalValue = numericFields.includes(fieldName) ? parseFloat(value) || 0 : value;
    
    dispatch({ 
      type: 'SET_FIELD', 
      field: fieldName as keyof typeof state.data, 
      value: finalValue 
    });
  }, [dispatch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted:', state.data);
    // Here you would typically send the form data to your backend
  };

  const grainTypes = ['CWRS Wheat', 'CPRS Wheat', 'Durum', 'Canola', 'Barley', 'Oats'];

  // Calculate derived values
  const netWeight = state.data.grossWeight - state.data.vehicleWeight;
  const netWeightTonnes = netWeight / 1000;
  const adjustedWeight = netWeightTonnes * (1 - state.data.dockage / 100);
  const totalValue = adjustedWeight * state.data.pricePerTonne;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b-2 border-slate-200 px-8 py-5 sticky top-0 z-10 shadow-sm">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-slate-800">Grain Receipt Form</h1>
            
            {/* Voice Controls */}
            <div className="flex items-center gap-4">
              {/* Status Indicator */}
              {isConnected && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100">
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
                  className={`p-3 rounded-full transition-colors ${
                    isMicMuted 
                      ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                  title={isMicMuted ? 'Unmute microphone' : 'Mute microphone'}
                >
                  {isMicMuted ? <MicOff size={24} /> : <Mic size={24} />}
                </button>
              )}
              
              {/* Voice Toggle Button */}
              <button
                onClick={isConnected ? endCall : startCall}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-lg transition-all duration-200 shadow-md hover:shadow-lg ${
                  isConnected 
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
            </div>
          </div>

          {/* Accessibility Bar */}
          <div className="flex items-center justify-between py-3 px-5 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex items-center gap-6">
              {/* Dyslexia Font Toggle */}
              <Toggle 
                checked={settings.dyslexiaFont} 
                onChange={toggleDyslexiaFont} 
                label="Dyslexia-Friendly Font"
              />
            </div>

            {/* PDF Upload */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => {}}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-slate-300 bg-white text-slate-700 hover:border-blue-500 hover:text-blue-600 transition-all text-base font-medium"
              >
                <Upload size={20} />
                Upload PDF
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Form Content */}
      <main className="flex-1 py-10 px-6 overflow-y-auto">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl p-10 border border-slate-200">
          {/* Read-only Info Section */}
          <div className="mb-8 pb-8 border-b-2 border-slate-200">
            <h2 className="text-xl font-semibold text-slate-700 mb-4">Receipt Information</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-4 py-3 px-5 bg-slate-50 rounded-xl">
                <span className="font-medium text-slate-500">Receipt #:</span>
                <span className="text-xl font-semibold text-slate-800">{state.data.receiptNumber}</span>
              </div>
              <div className="flex items-center gap-4 py-3 px-5 bg-slate-50 rounded-xl">
                <span className="font-medium text-slate-500">Licensee:</span>
                <span className="text-xl font-semibold text-slate-800">{state.data.licensee}</span>
              </div>
            </div>
          </div>

          {/* Editable Fields */}
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-slate-700 mb-4">Delivery Details</h2>
            
            <FormField
              name="producer"
              label={FIELD_LABELS.producer}
              value={state.data.producer}
              isActive={state.activeField === 'producer'}
              isCompleted={state.completedFields.includes('producer')}
              onFocus={() => handleFieldFocus('producer')}
              onChange={(v) => handleFieldChange('producer', v)}
            />
            
            <FormField
              name="date"
              label={FIELD_LABELS.date}
              value={state.data.date}
              isActive={state.activeField === 'date'}
              isCompleted={state.completedFields.includes('date')}
              onFocus={() => handleFieldFocus('date')}
              onChange={(v) => handleFieldChange('date', v)}
              type="date"
            />
            
            <FormField
              name="grainType"
              label={FIELD_LABELS.grainType}
              value={state.data.grainType}
              isActive={state.activeField === 'grainType'}
              isCompleted={state.completedFields.includes('grainType')}
              onFocus={() => handleFieldFocus('grainType')}
              onChange={(v) => handleFieldChange('grainType', v)}
              type="select"
              options={grainTypes}
            />
          </div>

          {/* Weight Section */}
          <div className="mt-8 pt-8 border-t-2 border-slate-200 space-y-2">
            <h2 className="text-xl font-semibold text-slate-700 mb-4">Weight Measurements</h2>
            
            <FormField
              name="grossWeight"
              label={FIELD_LABELS.grossWeight}
              value={state.data.grossWeight}
              isActive={state.activeField === 'grossWeight'}
              isCompleted={state.completedFields.includes('grossWeight')}
              onFocus={() => handleFieldFocus('grossWeight')}
              onChange={(v) => handleFieldChange('grossWeight', v)}
              type="number"
            />
            
            <FormField
              name="vehicleWeight"
              label={FIELD_LABELS.vehicleWeight}
              value={state.data.vehicleWeight}
              isActive={state.activeField === 'vehicleWeight'}
              isCompleted={state.completedFields.includes('vehicleWeight')}
              onFocus={() => handleFieldFocus('vehicleWeight')}
              onChange={(v) => handleFieldChange('vehicleWeight', v)}
              type="number"
            />
            
            <FormField
              name="dockage"
              label={FIELD_LABELS.dockage}
              value={state.data.dockage}
              isActive={state.activeField === 'dockage'}
              isCompleted={state.completedFields.includes('dockage')}
              onFocus={() => handleFieldFocus('dockage')}
              onChange={(v) => handleFieldChange('dockage', v)}
              type="number"
            />
          </div>

          {/* Pricing Section */}
          <div className="mt-8 pt-8 border-t-2 border-slate-200 space-y-2">
            <h2 className="text-xl font-semibold text-slate-700 mb-4">Pricing</h2>
            
            <FormField
              name="pricePerTonne"
              label={FIELD_LABELS.pricePerTonne}
              value={state.data.pricePerTonne}
              isActive={state.activeField === 'pricePerTonne'}
              isCompleted={state.completedFields.includes('pricePerTonne')}
              onFocus={() => handleFieldFocus('pricePerTonne')}
              onChange={(v) => handleFieldChange('pricePerTonne', v)}
              type="number"
            />
          </div>

          {/* Calculated Summary */}
          <div className="mt-10 p-8 bg-gradient-to-r from-slate-50 to-blue-50 rounded-2xl border-2 border-slate-200">
            <h2 className="text-xl font-semibold text-slate-700 mb-6">Summary</h2>
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
                <span className="text-slate-500 text-base">Net Weight</span>
                <div className="text-2xl font-bold text-slate-800 mt-1">{netWeight.toLocaleString()} kg</div>
              </div>
              <div className="bg-white p-5 rounded-xl shadow-sm border border-emerald-200">
                <span className="text-slate-500 text-base">Total Value</span>
                <div className="text-3xl font-bold text-emerald-600 mt-1">${totalValue.toFixed(2)}</div>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="mt-10 flex justify-center">
            <button
              type="submit"
              className="px-12 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xl shadow-lg hover:shadow-xl transition-all duration-200"
            >
              Submit Form
            </button>
          </div>
        </form>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 px-8 text-center text-slate-500">
        <p>FormAI - Voice-Assisted Form Filling for Seniors</p>
      </footer>
    </div>
  );
}