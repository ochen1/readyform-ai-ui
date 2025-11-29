import React, { useCallback, useRef } from 'react';
import { useFormContext } from '../store/FormContext';
import { useUltravox } from '../ultravox/UltravoxProvider';
import { FIELD_LABELS, EDITABLE_FIELDS } from '../store/types';
import { CheckCircle, Circle, HelpCircle } from 'lucide-react';

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
  let borderClass = 'border-slate-300'; // default/pending
  let Icon = Circle;
  let iconColor = 'text-slate-400';
  
  if (isActive) {
    borderClass = 'border-red-500 border-2 ring-2 ring-red-200';
    Icon = HelpCircle;
    iconColor = 'text-red-500';
  } else if (isCompleted) {
    borderClass = 'border-green-500 border-2';
    Icon = CheckCircle;
    iconColor = 'text-green-500';
  }

  return (
    <div className="flex items-center gap-4 py-3">
      <label className="w-40 text-right text-slate-700 font-medium shrink-0">
        {label}
      </label>
      
      {type === 'select' && options ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          className={`flex-1 px-4 py-3 rounded-lg border ${borderClass} bg-white text-lg focus:outline-none transition-all`}
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
          className={`flex-1 px-4 py-3 rounded-lg border ${borderClass} bg-white text-lg focus:outline-none transition-all`}
        />
      )}
      
      <div className={`shrink-0 ${iconColor}`}>
        <Icon size={28} />
      </div>
    </div>
  );
}

export function SimpleForm() {
  const { state, dispatch } = useFormContext();
  const { isConnected, notifyFieldFocus, status, startCall, endCall } = useUltravox();
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
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Header with Voice Status */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-slate-800">Grain Receipt Form</h1>
          
          <div className="flex items-center gap-4">
            {/* Status Indicator */}
            <div className="flex items-center gap-2">
              {status === 'thinking' && (
                <span className="text-amber-600 text-sm flex items-center gap-1">
                  <span className="animate-pulse">●</span> Thinking...
                </span>
              )}
              {status === 'speaking' && (
                <span className="text-blue-600 text-sm flex items-center gap-1">
                  <span className="animate-pulse">●</span> Speaking...
                </span>
              )}
              {status === 'listening' && (
                <span className="text-green-600 text-sm flex items-center gap-1">
                  <span className="animate-pulse">●</span> Listening...
                </span>
              )}
            </div>
            
            {/* Voice Toggle Button */}
            <button
              onClick={isConnected ? endCall : startCall}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                isConnected 
                  ? 'bg-red-500 hover:bg-red-600 text-white' 
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
            >
              {isConnected ? 'End Call' : 'Start Voice Assistant'}
            </button>
          </div>
        </div>
      </header>

      {/* Form Content */}
      <main className="flex-1 py-8">
        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto bg-white rounded-xl shadow-lg p-8">
          {/* Read-only Info Section */}
          <div className="mb-6 pb-6 border-b border-slate-200">
            <div className="flex items-center gap-4 py-2 text-slate-600">
              <span className="w-40 text-right font-medium">Receipt #:</span>
              <span className="text-lg">{state.data.receiptNumber}</span>
            </div>
            <div className="flex items-center gap-4 py-2 text-slate-600">
              <span className="w-40 text-right font-medium">Licensee:</span>
              <span className="text-lg">{state.data.licensee}</span>
            </div>
          </div>

          {/* Editable Fields */}
          <div className="space-y-1">
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
          <div className="mt-6 pt-6 border-t border-slate-200 bg-slate-50 -mx-8 -mb-8 px-8 py-6 rounded-b-xl">
            <div className="flex items-center gap-4 py-2">
              <span className="w-40 text-right font-medium text-slate-600">Net Weight:</span>
              <span className="text-lg font-semibold">{netWeight.toLocaleString()} kg</span>
            </div>
            <div className="flex items-center gap-4 py-2">
              <span className="w-40 text-right font-medium text-slate-600">Total Value:</span>
              <span className="text-2xl font-bold text-green-600">${totalValue.toFixed(2)}</span>
            </div>
          </div>

          {/* Submit Button */}
          <div className="mt-8 flex justify-center">
            <button
              type="submit"
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-lg shadow-md transition-colors"
            >
              Submit Form
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}