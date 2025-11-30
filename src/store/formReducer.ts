import type { FormState, FormAction } from './types';

/**
 * Initial form state - empty until PDF is loaded
 */
export const initialFormState: FormState = {
  // PDF state - empty until loaded
  pdfLoaded: false,
  pdfDoc: null,
  pdfBytes: null,
  metadata: null,
  
  // Fields - empty array until PDF loaded
  fields: [],
  
  // UI state
  activeFieldId: null,
  completedFieldIds: [],
  validationErrors: {},
  isVoiceActive: false,
};

/**
 * Form reducer for handling dynamic PDF form state
 */
export function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'LOAD_PDF':
      return {
        ...initialFormState, // Reset to clean state
        pdfLoaded: true,
        pdfDoc: action.payload.pdfDoc,
        pdfBytes: action.payload.pdfBytes,
        metadata: action.payload.metadata,
        fields: action.payload.fields,
      };

    case 'SET_FIELD': {
      const fieldIndex = state.fields.findIndex(f => f.id === action.fieldId);
      if (fieldIndex === -1) return state;
      
      const updatedFields = [...state.fields];
      updatedFields[fieldIndex] = {
        ...updatedFields[fieldIndex],
        value: action.value,
      };
      
      return {
        ...state,
        fields: updatedFields,
      };
    }

    case 'SET_ACTIVE_FIELD':
      return {
        ...state,
        activeFieldId: action.fieldId,
      };

    case 'MARK_FIELD_COMPLETE':
      if (state.completedFieldIds.includes(action.fieldId)) {
        return state;
      }
      return {
        ...state,
        completedFieldIds: [...state.completedFieldIds, action.fieldId],
      };

    case 'SET_VALIDATION_ERROR':
      return {
        ...state,
        validationErrors: {
          ...state.validationErrors,
          [action.fieldId]: action.error,
        },
      };

    case 'CLEAR_VALIDATION_ERROR': {
      const { [action.fieldId]: _, ...remainingErrors } = state.validationErrors;
      return {
        ...state,
        validationErrors: remainingErrors,
      };
    }

    case 'SET_VOICE_ACTIVE':
      return {
        ...state,
        isVoiceActive: action.active,
      };

    case 'UPDATE_PDF_BYTES':
      return {
        ...state,
        pdfBytes: action.pdfBytes,
      };

    case 'RESET_FORM':
      return initialFormState;

    default:
      return state;
  }
}