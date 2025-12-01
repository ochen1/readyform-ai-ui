import type { FormState, FormAction, PageProcessingStatus } from './types';

/**
 * Initial form state - empty until PDF is loaded
 */
export const initialFormState: FormState = {
  // PDF state - empty until loaded
  pdfLoaded: false,
  writeContext: null,
  pdfBytes: null,
  metadata: null,
  pageCount: 0,
  
  // Fields and sections - empty until PDF loaded
  fields: [],
  sections: [],
  
  // UI state
  activeFieldId: null,
  completedFieldIds: [],
  validationErrors: {},
  isVoiceActive: false,
  
  // Enhancement state
  isEnhancing: false,
  enhancementError: null,
  enhancementCached: false,
  enhancementProgress: null,
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
        writeContext: action.payload.writeContext,
        pdfBytes: action.payload.pdfBytes,
        metadata: action.payload.metadata,
        fields: action.payload.fields,
        pageCount: action.payload.pageCount,
        // Reset enhancement state for new PDF
        isEnhancing: false,
        enhancementError: null,
        enhancementCached: false,
        enhancementProgress: null,
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

    // Enhancement actions
    case 'START_ENHANCEMENT':
      return {
        ...state,
        isEnhancing: true,
        enhancementError: null,
        enhancementProgress: {
          totalPages: action.totalPages,
          completedPages: 0,
          errorPages: 0,
          pageStatuses: action.pageStatuses,
          startTime: Date.now(),
        },
      };

    case 'UPDATE_PAGE_PROGRESS': {
      if (!state.enhancementProgress) return state;
      
      const updatedStatuses = state.enhancementProgress.pageStatuses.map(
        (ps: PageProcessingStatus) => ps.pageNumber === action.pageNumber ? action.status : ps
      );
      
      const completedPages = updatedStatuses.filter((ps: PageProcessingStatus) => ps.status === 'completed').length;
      const errorPages = updatedStatuses.filter((ps: PageProcessingStatus) => ps.status === 'error').length;
      
      return {
        ...state,
        enhancementProgress: {
          ...state.enhancementProgress,
          pageStatuses: updatedStatuses,
          completedPages,
          errorPages,
        },
      };
    }

    case 'COMPLETE_ENHANCEMENT':
      return {
        ...state,
        isEnhancing: false,
        fields: action.fields,
        sections: action.sections,
        metadata: state.metadata ? {
          ...state.metadata,
          title: action.title,
          description: action.description,
          visibleFieldCount: action.fields.filter(f => !f.ignore).length,
        } : null,
        enhancementCached: action.cached,
        enhancementError: null,
        enhancementProgress: state.enhancementProgress ? {
          ...state.enhancementProgress,
          completedPages: state.enhancementProgress.totalPages,
        } : null,
      };

    case 'ENHANCEMENT_ERROR':
      return {
        ...state,
        isEnhancing: false,
        enhancementError: action.error,
      };

    default:
      return state;
  }
}