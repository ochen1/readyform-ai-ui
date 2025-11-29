import React, { createContext, useContext, useReducer, useCallback, useMemo } from 'react';
import type { FormState, FormAction, GrainReceiptFormData } from './types';
import { EDITABLE_FIELDS, FIELD_LABELS } from './types';
import { formReducer, initialFormState } from './formReducer';

export interface FormContextValue {
  state: FormState;
  dispatch: React.Dispatch<FormAction>;
  
  // Convenience methods for voice tools
  setField: (field: string, value: string | number) => void;
  getField: (field: string) => string | number | undefined;
  focusField: (field: string | null) => void;
  getFormSummary: () => string;
  getProgress: () => { completed: number; total: number; percentage: number };
  getCalculatedValues: () => { netWeight: number; totalValue: number };
}

const FormContext = createContext<FormContextValue | null>(null);

export function FormProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(formReducer, initialFormState);

  const setField = useCallback((field: string, value: string | number) => {
    if (EDITABLE_FIELDS.includes(field as typeof EDITABLE_FIELDS[number])) {
      dispatch({ 
        type: 'SET_FIELD', 
        field: field as keyof GrainReceiptFormData, 
        value 
      });
    }
  }, []);

  const getField = useCallback((field: string): string | number | undefined => {
    if (field === 'netWeight') {
      return state.data.grossWeight - state.data.vehicleWeight;
    }
    if (field === 'totalValue') {
      const netWeight = state.data.grossWeight - state.data.vehicleWeight;
      return (netWeight / 1000) * state.data.pricePerTonne * (1 - state.data.dockage / 100);
    }
    return state.data[field as keyof GrainReceiptFormData];
  }, [state.data]);

  const focusField = useCallback((field: string | null) => {
    dispatch({ type: 'SET_ACTIVE_FIELD', field });
  }, []);

  const getFormSummary = useCallback((): string => {
    const { data } = state;
    const netWeight = data.grossWeight - data.vehicleWeight;
    const totalValue = (netWeight / 1000) * data.pricePerTonne * (1 - data.dockage / 100);
    
    return `
Form Summary:
- Receipt Number: ${data.receiptNumber} (auto-generated)
- Licensee: ${data.licensee}
- Producer: ${data.producer}
- Delivery Date: ${data.date}
- Gross Weight: ${data.grossWeight.toLocaleString()} kg
- Vehicle Tare: ${data.vehicleWeight.toLocaleString()} kg
- Net Weight: ${netWeight.toLocaleString()} kg
- Grain Type: ${data.grainType}
- Dockage: ${data.dockage}%
- Price per Tonne: $${data.pricePerTonne.toFixed(2)}
- Total Net Payable: $${totalValue.toFixed(2)} CAD
    `.trim();
  }, [state.data]);

  const getProgress = useCallback(() => {
    const total = EDITABLE_FIELDS.length;
    const completed = state.completedFields.length;
    const percentage = Math.round((completed / total) * 100);
    return { completed, total, percentage };
  }, [state.completedFields]);

  const getCalculatedValues = useCallback(() => {
    const netWeight = state.data.grossWeight - state.data.vehicleWeight;
    const totalValue = (netWeight / 1000) * state.data.pricePerTonne * (1 - state.data.dockage / 100);
    return { netWeight, totalValue };
  }, [state.data]);

  const value = useMemo(() => ({
    state,
    dispatch,
    setField,
    getField,
    focusField,
    getFormSummary,
    getProgress,
    getCalculatedValues,
  }), [state, setField, getField, focusField, getFormSummary, getProgress, getCalculatedValues]);

  return (
    <FormContext.Provider value={value}>
      {children}
    </FormContext.Provider>
  );
}

export function useFormContext() {
  const context = useContext(FormContext);
  if (!context) {
    throw new Error('useFormContext must be used within a FormProvider');
  }
  return context;
}

export { FIELD_LABELS, EDITABLE_FIELDS };