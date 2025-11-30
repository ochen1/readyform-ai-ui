import React, { createContext, useContext, useReducer, useCallback, useMemo, useRef } from 'react';
import type { FormState, FormAction, FormField } from './types';
import { formReducer, initialFormState } from './formReducer';
import { parsePDF, updatePDFField, openPDFInNewTab, downloadPDF as downloadPDFFile } from '../services/pdfParser';
import type { PDFDocument } from 'pdf-lib';

export interface FormContextValue {
  state: FormState;
  dispatch: React.Dispatch<FormAction>;
  
  // PDF operations
  loadPDF: (file: File) => Promise<void>;
  downloadPDF: () => void;
  openPDFPreview: () => void;
  
  // Field operations
  setField: (fieldId: string, value: string) => void;
  getField: (fieldId: string) => string | undefined;
  getFieldByName: (name: string) => FormField | undefined;
  focusField: (fieldId: string | null) => void;
  
  // Summary operations
  getFormSummary: () => string;
  getProgress: () => { completed: number; total: number; percentage: number };
  
  // For Ultravox tool generation
  getFieldNames: () => string[];
  getFieldIds: () => string[];
}

const FormContext = createContext<FormContextValue | null>(null);

export function FormProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(formReducer, initialFormState);
  
  // Keep a ref to the PDF document for updates
  const pdfDocRef = useRef<PDFDocument | null>(null);

  // Update pdfDocRef when state changes
  React.useEffect(() => {
    pdfDocRef.current = state.pdfDoc;
  }, [state.pdfDoc]);

  const loadPDF = useCallback(async (file: File) => {
    try {
      const { fields, metadata, pdfDoc, pdfBytes } = await parsePDF(file);
      pdfDocRef.current = pdfDoc;
      
      dispatch({
        type: 'LOAD_PDF',
        payload: { fields, metadata, pdfDoc, pdfBytes },
      });
    } catch (error) {
      console.error('Failed to load PDF:', error);
      throw error;
    }
  }, []);

  const setField = useCallback(async (fieldId: string, value: string) => {
    // Update state
    dispatch({ type: 'SET_FIELD', fieldId, value });
    
    // Update PDF document
    if (pdfDocRef.current) {
      try {
        const newBytes = await updatePDFField(pdfDocRef.current, fieldId, value);
        dispatch({ type: 'UPDATE_PDF_BYTES', pdfBytes: newBytes });
      } catch (error) {
        console.error('Failed to update PDF field:', error);
      }
    }
  }, []);

  const getField = useCallback((fieldId: string): string | undefined => {
    const field = state.fields.find(f => f.id === fieldId);
    return field?.value;
  }, [state.fields]);

  const getFieldByName = useCallback((name: string): FormField | undefined => {
    // Case-insensitive search by display name
    const lowerName = name.toLowerCase();
    return state.fields.find(f => f.name.toLowerCase() === lowerName);
  }, [state.fields]);

  const focusField = useCallback((fieldId: string | null) => {
    dispatch({ type: 'SET_ACTIVE_FIELD', fieldId });
  }, []);

  const getFormSummary = useCallback((): string => {
    if (!state.pdfLoaded || !state.metadata) {
      return 'No form loaded.';
    }

    const lines = [
      `Form: ${state.metadata.title}`,
      `File: ${state.metadata.sourceFileName}`,
      `Fields: ${state.metadata.fieldCount}`,
      '',
      'Current Values:',
    ];

    for (const field of state.fields) {
      const status = state.completedFieldIds.includes(field.id) ? '✓' : '○';
      const value = field.value || '(empty)';
      lines.push(`${status} ${field.name}: ${value}`);
    }

    return lines.join('\n');
  }, [state]);

  const getProgress = useCallback(() => {
    const total = state.fields.filter(f => !f.readonly).length;
    const completed = state.completedFieldIds.length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { completed, total, percentage };
  }, [state.fields, state.completedFieldIds]);

  const getFieldNames = useCallback((): string[] => {
    return state.fields.map(f => f.name);
  }, [state.fields]);

  const getFieldIds = useCallback((): string[] => {
    return state.fields.map(f => f.id);
  }, [state.fields]);

  const downloadPDF = useCallback(() => {
    if (!state.pdfBytes || !state.metadata) {
      console.warn('No PDF loaded to download');
      return;
    }
    downloadPDFFile(state.pdfBytes, state.metadata.sourceFileName);
  }, [state.pdfBytes, state.metadata]);

  const openPDFPreview = useCallback(() => {
    if (!state.pdfBytes) {
      console.warn('No PDF loaded to preview');
      return;
    }
    openPDFInNewTab(state.pdfBytes);
  }, [state.pdfBytes]);

  const value = useMemo(() => ({
    state,
    dispatch,
    loadPDF,
    downloadPDF,
    openPDFPreview,
    setField,
    getField,
    getFieldByName,
    focusField,
    getFormSummary,
    getProgress,
    getFieldNames,
    getFieldIds,
  }), [
    state,
    loadPDF,
    downloadPDF,
    openPDFPreview,
    setField,
    getField,
    getFieldByName,
    focusField,
    getFormSummary,
    getProgress,
    getFieldNames,
    getFieldIds,
  ]);

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