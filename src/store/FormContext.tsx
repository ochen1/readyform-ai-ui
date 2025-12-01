import React, { createContext, useContext, useReducer, useCallback, useMemo, useRef, useEffect } from 'react';
import type { FormState, FormAction, FormField, PDFWriteContext, PageProcessingStatus } from './types';
import { formReducer, initialFormState } from './formReducer';
import { parsePDF, updatePDFField, openPDFInNewTab, downloadPDF as downloadPDFFile } from '../services/pdfParser';
import { getVisibleFields, getEditableFields } from '../services/fieldEnhancer';
import { enhanceFormFieldsPageByPage, getInitialPageStatuses } from '../services/pageByPageEnhancer';
import {
  buildDependencyGraph,
  getFieldsToRecalculate,
  evaluateFormula
} from '../services/calculationEngine';

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
  getVisibleFields: () => FormField[];
  getEditableFields: () => FormField[];
}

const FormContext = createContext<FormContextValue | null>(null);

export function FormProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(formReducer, initialFormState);
  
  // Keep a ref to the write context for PDF updates
  const writeContextRef = useRef<PDFWriteContext | null>(null);

  // Update writeContextRef when state changes
  useEffect(() => {
    writeContextRef.current = state.writeContext;
  }, [state.writeContext]);

  const loadPDF = useCallback(async (file: File) => {
    try {
      // Step 1: Parse PDF and extract basic fields with page information
      const { fields: basicFields, metadata, writeContext, pdfBytes, pageImages, pageCount, fieldsByPage } = await parsePDF(file);
      writeContextRef.current = writeContext;
      
      // Step 2: Load PDF with basic fields first (for immediate display)
      dispatch({
        type: 'LOAD_PDF',
        payload: { fields: basicFields, metadata, writeContext, pdfBytes, pageCount },
      });
      
      // Step 3: Get initial page statuses
      const initialStatuses = getInitialPageStatuses(fieldsByPage);
      
      // Step 4: Start enhancement process with page info
      dispatch({
        type: 'START_ENHANCEMENT',
        totalPages: initialStatuses.length,
        pageStatuses: initialStatuses,
      });
      
      try {
        // Step 5: Enhance fields page-by-page in parallel
        // Progress callback updates state in real-time
        const progressCallback = (pageNumber: number, status: PageProcessingStatus) => {
          dispatch({
            type: 'UPDATE_PAGE_PROGRESS',
            pageNumber,
            status,
          });
        };
        
        const { fields: enhancedFields, sections, formTitle, formDescription, cachedPages } =
          await enhanceFormFieldsPageByPage(
            file.name,
            pdfBytes,
            basicFields,
            fieldsByPage,
            pageImages,
            pageCount,
            writeContext.isXFA,
            progressCallback
          );
        
        // Step 6: Update state with enhanced fields and sections
        dispatch({
          type: 'COMPLETE_ENHANCEMENT',
          fields: enhancedFields,
          sections,
          title: formTitle,
          description: formDescription,
          cached: cachedPages > 0,
        });
      } catch (enhanceError) {
        console.error('Enhancement failed:', enhanceError);
        dispatch({
          type: 'ENHANCEMENT_ERROR',
          error: enhanceError instanceof Error ? enhanceError.message : 'Enhancement failed'
        });
        // Form is still usable with basic fields
      }
    } catch (error) {
      console.error('Failed to load PDF:', error);
      throw error;
    }
  }, []);

  // Build dependency graph when fields change
  const dependencyGraphRef = useRef<Map<string, string[]>>(new Map());
  
  useEffect(() => {
    if (state.fields.length > 0) {
      dependencyGraphRef.current = buildDependencyGraph(state.fields);
      // console.log('[Calculations] Dependency graph built:', dependencyGraphRef.current);
    }
  }, [state.fields]);

  // Recalculate all calculated fields (used after initial load or enhancement)
  const recalculateAllCalculatedFields = useCallback(async () => {
    const calculatedFields = state.fields.filter(f => f.type === 'calculated' && f.formula);
    
    if (calculatedFields.length === 0) return;
    
    // console.log('[Calculations] Recalculating all calculated fields');
    
    // Create a working copy of fields with current values
    let workingFields = [...state.fields];
    let changed = true;
    let iterations = 0;
    const maxIterations = 10; // Prevent infinite loops
    
    // Iterate until no changes (handles cascading calculations)
    while (changed && iterations < maxIterations) {
      changed = false;
      iterations++;
      
      for (const calcField of calculatedFields) {
        if (!calcField.formula) continue;
        
        const newValue = evaluateFormula(calcField.formula, workingFields);
        const currentField = workingFields.find(f => f.id === calcField.id);
        
        if (currentField && currentField.value !== newValue) {
          // Update working fields
          workingFields = workingFields.map(f =>
            f.id === calcField.id ? { ...f, value: newValue } : f
          );
          changed = true;
          
          // Dispatch update
          dispatch({ type: 'SET_FIELD', fieldId: calcField.id, value: newValue });
          
          // Update PDF (if write-back is supported)
          if (writeContextRef.current) {
            try {
              const newBytes = await updatePDFField(writeContextRef.current, calcField.id, newValue);
              if (newBytes) {
                dispatch({ type: 'UPDATE_PDF_BYTES', pdfBytes: newBytes });
              }
            } catch (error) {
              console.error('Failed to update calculated PDF field:', error);
            }
          }
        }
      }
    }
    
    if (iterations >= maxIterations) {
      console.warn('[Calculations] Max iterations reached - possible circular dependency');
    }
  }, [state.fields]);

  // Trigger initial calculation after enhancement completes
  useEffect(() => {
    if (!state.isEnhancing && state.pdfLoaded && state.fields.some(f => f.type === 'calculated' && f.formula)) {
      recalculateAllCalculatedFields();
    }
  }, [state.isEnhancing, state.pdfLoaded, recalculateAllCalculatedFields]);

  const setField = useCallback(async (fieldId: string, value: string) => {
    // Update the primary field
    dispatch({ type: 'SET_FIELD', fieldId, value });
    
    // Update PDF document for the primary field (if write-back is supported)
    if (writeContextRef.current) {
      try {
        const newBytes = await updatePDFField(writeContextRef.current, fieldId, value);
        if (newBytes) {
          dispatch({ type: 'UPDATE_PDF_BYTES', pdfBytes: newBytes });
        }
      } catch (error) {
        console.error('Failed to update PDF field:', error);
      }
    }
    
    // Recalculate dependent fields
    const fieldsToRecalculate = getFieldsToRecalculate(fieldId, dependencyGraphRef.current);
    
    if (fieldsToRecalculate.length > 0) {
      console.log(`[Calculations] Field ${fieldId} changed, recalculating:`, fieldsToRecalculate);
      
      // Get current fields with the updated value
      const currentFields = state.fields.map(f =>
        f.id === fieldId ? { ...f, value } : f
      );
      
      // Recalculate each dependent field
      for (const calcFieldId of fieldsToRecalculate) {
        const calcField = currentFields.find(f => f.id === calcFieldId);
        
        if (calcField?.type === 'calculated' && calcField.formula) {
          // Use the updated fields for calculation
          const calculatedValue = evaluateFormula(calcField.formula, currentFields);
          
          // Update state
          dispatch({ type: 'SET_FIELD', fieldId: calcFieldId, value: calculatedValue });
          
          // Update the working fields for cascading calculations
          const idx = currentFields.findIndex(f => f.id === calcFieldId);
          if (idx !== -1) {
            currentFields[idx] = { ...currentFields[idx], value: calculatedValue };
          }
          
          // Update PDF (if write-back is supported)
          if (writeContextRef.current) {
            try {
              const newBytes = await updatePDFField(writeContextRef.current, calcFieldId, calculatedValue);
              if (newBytes) {
                dispatch({ type: 'UPDATE_PDF_BYTES', pdfBytes: newBytes });
              }
            } catch (error) {
              console.error('Failed to update calculated PDF field:', error);
            }
          }
        }
      }
    }
  }, [state.fields]);

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

    // Get only visible (non-ignored) fields
    const visibleFields = state.fields.filter(f => !f.ignore);

    const lines = [
      `Form: ${state.metadata.title}`,
      state.metadata.description ? `Description: ${state.metadata.description}` : '',
      `File: ${state.metadata.sourceFileName}`,
      `Fields: ${visibleFields.length} (${state.metadata.fieldCount} total)`,
      '',
      'Current Values:',
    ].filter(Boolean); // Remove empty lines

    for (const field of visibleFields) {
      const status = state.completedFieldIds.includes(field.id) ? '✓' : '○';
      const value = field.value || '(empty)';
      const readonlyTag = field.readonly ? ' [read-only]' : '';
      const unitSuffix = field.unit ? ` (${field.unit})` : '';
      lines.push(`${status} ${field.name}${unitSuffix}: ${value}${readonlyTag}`);
    }

    return lines.join('\n');
  }, [state]);

  const getProgress = useCallback(() => {
    // Only count editable, visible fields
    const editableFields = state.fields.filter(f => !f.readonly && !f.ignore);
    const total = editableFields.length;
    const completed = state.completedFieldIds.filter(id =>
      editableFields.some(f => f.id === id)
    ).length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { completed, total, percentage };
  }, [state.fields, state.completedFieldIds]);

  const getVisibleFieldsCallback = useCallback((): FormField[] => {
    return getVisibleFields(state.fields);
  }, [state.fields]);

  const getEditableFieldsCallback = useCallback((): FormField[] => {
    return getEditableFields(state.fields);
  }, [state.fields]);

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
    getVisibleFields: getVisibleFieldsCallback,
    getEditableFields: getEditableFieldsCallback,
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
    getVisibleFieldsCallback,
    getEditableFieldsCallback,
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