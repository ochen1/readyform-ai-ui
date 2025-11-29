import type { FormState, FormAction, GrainReceiptFormData } from './types';

export const initialFormData: GrainReceiptFormData = {
  receiptNumber: 'GR-2024-8842',
  licensee: 'Prairie Grain Co-op',
  producer: 'Oliver Smith',
  date: '2024-11-20',
  grossWeight: 42500,
  vehicleWeight: 18200,
  grainType: 'CWRS Wheat',
  dockage: 2.5,
  pricePerTonne: 385.50,
};

export const initialFormState: FormState = {
  data: initialFormData,
  activeField: null,
  lastUpdatedField: null,
  lastUpdateTimestamp: 0,
  completedFields: [],
  validationErrors: {},
  isVoiceActive: false,
};

export function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'SET_FIELD':
      return {
        ...state,
        data: {
          ...state.data,
          [action.field]: action.value,
        },
        lastUpdatedField: action.field,
        lastUpdateTimestamp: Date.now(),
      };

    case 'SET_ACTIVE_FIELD':
      return {
        ...state,
        activeField: action.field,
      };

    case 'MARK_FIELD_COMPLETE':
      if (state.completedFields.includes(action.field)) {
        return state;
      }
      return {
        ...state,
        completedFields: [...state.completedFields, action.field],
      };

    case 'SET_VALIDATION_ERROR':
      return {
        ...state,
        validationErrors: {
          ...state.validationErrors,
          [action.field]: action.error,
        },
      };

    case 'CLEAR_VALIDATION_ERROR': {
      const { [action.field]: _, ...remainingErrors } = state.validationErrors;
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

    case 'RESET_FORM':
      return initialFormState;

    default:
      return state;
  }
}