import type { PDFDocument } from 'pdf-lib';

/**
 * Generic form field extracted from PDF
 * All values are strings - no type inference for simplicity
 */
export interface FormField {
  /** Unique ID from PDF field name */
  id: string;
  /** Display-friendly name derived from PDF field name */
  name: string;
  /** Current value - always a string */
  value: string;
  /** Field type - always 'text' for now, can expand later with AI inference */
  type: 'text';
  /** Whether field is required - default false */
  required: boolean;
  /** Whether field is read-only - default false */
  readonly: boolean;
}

/**
 * Metadata about the loaded PDF form
 */
export interface FormMetadata {
  /** Form title - derived from filename or default */
  title: string;
  /** Original PDF filename */
  sourceFileName: string;
  /** Number of fillable fields in the form */
  fieldCount: number;
}

/**
 * Complete form state for arbitrary PDF forms
 */
export interface FormState {
  // PDF-related state
  /** Whether a PDF has been loaded */
  pdfLoaded: boolean;
  /** Reference to the loaded PDFDocument for updates */
  pdfDoc: PDFDocument | null;
  /** Current PDF bytes for download */
  pdfBytes: Uint8Array | null;
  /** Metadata about the loaded form */
  metadata: FormMetadata | null;
  
  // Fields
  /** Array of form fields extracted from PDF */
  fields: FormField[];
  
  // UI state
  /** ID of the currently active/focused field */
  activeFieldId: string | null;
  /** IDs of fields that have been confirmed by the user */
  completedFieldIds: string[];
  /** Validation errors keyed by field ID */
  validationErrors: Record<string, string>;
  /** Whether voice assistant is currently active */
  isVoiceActive: boolean;
}

/**
 * Actions that can be dispatched to modify form state
 */
export type FormAction =
  | { 
      type: 'LOAD_PDF'; 
      payload: { 
        fields: FormField[]; 
        metadata: FormMetadata; 
        pdfDoc: PDFDocument;
        pdfBytes: Uint8Array;
      };
    }
  | { type: 'SET_FIELD'; fieldId: string; value: string }
  | { type: 'SET_ACTIVE_FIELD'; fieldId: string | null }
  | { type: 'MARK_FIELD_COMPLETE'; fieldId: string }
  | { type: 'SET_VALIDATION_ERROR'; fieldId: string; error: string }
  | { type: 'CLEAR_VALIDATION_ERROR'; fieldId: string }
  | { type: 'SET_VOICE_ACTIVE'; active: boolean }
  | { type: 'UPDATE_PDF_BYTES'; pdfBytes: Uint8Array }
  | { type: 'RESET_FORM' };