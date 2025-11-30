import type { PDFDocument } from 'pdf-lib';

/**
 * Semantic field types for voice assistant context
 * Used to determine how to prompt the user and validate input
 */
export type FieldType = 
  | 'text'        // General text input (names, descriptions)
  | 'number'      // Plain numeric values (quantities, counts)
  | 'weight'      // Weight measurements (always with unit)
  | 'currency'    // Monetary values (always with currency)
  | 'percentage'  // Percentage values (0-100 or decimal)
  | 'date'        // Date values (with format specification)
  | 'reference'   // IDs, codes, ticket numbers
  | 'grade'       // Classifications or grades
  | 'selection'   // Predefined choices
  | 'address'     // Multi-line addresses
  | 'signature'   // Signature fields (typically ignored)
  | 'calculated'  // Auto-computed fields (read-only)
  | 'ignore';     // Extraneous fields to skip

/**
 * Enhanced form field with LLM-generated metadata
 * Combines PDF extraction data with Gemini analysis
 */
export interface FormField {
  // Core identification
  /** Unique ID from PDF field name */
  id: string;
  /** Raw name from PDF before enhancement */
  originalName: string;
  
  // LLM-enhanced metadata
  /** Human-friendly display name (may include units) */
  name: string;
  /** Semantic type for context-aware prompting */
  type: FieldType;
  /** Description for voice assistant to read to user */
  description: string;
  
  // Type-specific attributes
  /** Unit of measurement (kg, tonnes, $CAD) */
  unit?: string;
  /** Expected format (yyyy/mm/dd) */
  format?: string;
  /** Predefined choices for selection type */
  options?: string[];
  /** How this field is calculated (for calculated type) */
  calculationHint?: string;
  
  // Behavioral flags
  /** Whether field is required */
  required: boolean;
  /** Whether field is read-only */
  readonly: boolean;
  /** Whether to skip this field entirely */
  ignore: boolean;
  
  // Current value
  /** Current value - always a string */
  value: string;
}

/**
 * Metadata about the loaded PDF form
 */
export interface FormMetadata {
  /** Form title - derived from filename or AI analysis */
  title: string;
  /** Form description from AI analysis */
  description?: string;
  /** Original PDF filename */
  sourceFileName: string;
  /** Number of fillable fields in the form */
  fieldCount: number;
  /** Number of fields after filtering ignored ones */
  visibleFieldCount?: number;
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
  
  // Enhancement state
  /** Whether AI enhancement is in progress */
  isEnhancing: boolean;
  /** Error message if enhancement failed */
  enhancementError: string | null;
  /** Whether enhanced data was loaded from cache */
  enhancementCached: boolean;
}

/**
 * Gemini API response schema for field enhancement
 */
export interface GeminiFieldEnhancement {
  formTitle: string;
  formDescription: string;
  fields: Array<{
    id: string;
    displayName: string;
    type: FieldType;
    description: string;
    unit?: string;
    format?: string;
    options?: string[];
    calculationHint?: string;
    required: boolean;
    readonly: boolean;
    ignore: boolean;
  }>;
  ignoredFields: string[];
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
  | { type: 'RESET_FORM' }
  // Enhancement actions
  | { type: 'START_ENHANCEMENT' }
  | { 
      type: 'COMPLETE_ENHANCEMENT'; 
      fields: FormField[]; 
      title: string; 
      description: string;
      cached: boolean;
    }
  | { type: 'ENHANCEMENT_ERROR'; error: string };