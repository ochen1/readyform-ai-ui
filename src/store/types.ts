export interface GrainReceiptFormData {
  receiptNumber: string;
  licensee: string;
  producer: string;
  date: string;
  grossWeight: number;
  vehicleWeight: number;
  grainType: string;
  dockage: number;
  pricePerTonne: number;
}

export interface FormState {
  data: GrainReceiptFormData;
  activeField: string | null;
  lastUpdatedField: string | null;
  lastUpdateTimestamp: number;
  completedFields: string[];
  validationErrors: Record<string, string>;
  isVoiceActive: boolean;
}

export type FormAction =
  | { type: 'SET_FIELD'; field: keyof GrainReceiptFormData; value: string | number }
  | { type: 'SET_ACTIVE_FIELD'; field: string | null }
  | { type: 'MARK_FIELD_COMPLETE'; field: string }
  | { type: 'SET_VALIDATION_ERROR'; field: string; error: string }
  | { type: 'CLEAR_VALIDATION_ERROR'; field: string }
  | { type: 'SET_VOICE_ACTIVE'; active: boolean }
  | { type: 'RESET_FORM' };

export const EDITABLE_FIELDS = [
  'producer',
  'date',
  'grossWeight',
  'vehicleWeight',
  'grainType',
  'dockage',
  'pricePerTonne'
] as const;

export type EditableField = typeof EDITABLE_FIELDS[number];

export const FIELD_LABELS: Record<string, string> = {
  receiptNumber: 'Receipt Number',
  licensee: 'Licensee',
  producer: 'Producer Name',
  date: 'Delivery Date',
  grossWeight: 'Gross Weight (kg)',
  vehicleWeight: 'Vehicle Tare Weight (kg)',
  grainType: 'Grain Type',
  dockage: 'Dockage (%)',
  pricePerTonne: 'Price per Tonne ($)',
  netWeight: 'Net Weight (kg)',
  totalValue: 'Total Net Payable ($)'
};