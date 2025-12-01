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
  | 'selection'   // Predefined choices (MUST have options array)
  | 'boolean'     // Yes/No toggle (for radio buttons with Yes/No options)
  | 'checkbox'    // Single checkbox (checked/unchecked, for consent)
  | 'phone'       // Phone number with formatting
  | 'email'       // Email address with validation
  | 'postalcode'  // Canadian postal code (A1A 1A1)
  | 'address'     // Multi-line addresses
  | 'signature'   // Signature fields (typically ignored)
  | 'calculated'  // Auto-computed fields (read-only)
  | 'ignore';     // Extraneous fields to skip

/**
 * A logical section/grouping of form fields
 * Sections are identified by Gemini from the PDF visual structure
 */
export interface FormSection {
  /** Unique ID for the section (e.g., "section_a", "personal_info") */
  id: string;
  /** Human-readable section title (e.g., "Section A - Personal and Work Information") */
  title: string;
  /** Optional description of what this section covers */
  description?: string;
  /** Order in which this section appears (0-indexed) */
  order: number;
}

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
  /** Page number where this field appears (1-indexed) */
  pageNumber: number;
  
  // LLM-enhanced metadata
  /** Human-friendly display name (may include units) */
  name: string;
  /** Semantic type for context-aware prompting */
  type: FieldType;
  /** Description for voice assistant to read to user */
  description: string;
  
  // Section grouping
  /** Section ID this field belongs to (undefined for ungrouped fields) */
  sectionId?: string;
  
  // Type-specific attributes
  /** Unit of measurement (kg, tonnes, $CAD) */
  unit?: string;
  /** Expected format (yyyy/mm/dd) */
  format?: string;
  /** Predefined choices for selection type (REQUIRED when type is 'selection') */
  options?: string[];
  /** Human-readable hint for how this field is calculated (for display) */
  calculationHint?: string;
  /**
   * Parseable formula for calculated fields
   * Uses field IDs/names in curly braces: "{Gross weight} - {Vehicle weight}"
   * Supports: +, -, *, /, (, ), numbers
   */
  formula?: string;
  
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
 * Information about the parsed PDF for writing back
 */
export interface PDFWriteContext {
  /** Original file bytes for re-loading with pdf-lib */
  originalBytes: ArrayBuffer;
  /** Whether this is an XFA form (write-back not supported) */
  isXFA: boolean;
  /** Field IDs that can be written back (AcroForm fields only) */
  writableFieldIds: string[];
}

/**
 * Status of processing a single page
 */
export type PageStatus = 'pending' | 'processing' | 'completed' | 'error';

/**
 * Processing status for a single page during enhancement
 */
export interface PageProcessingStatus {
  /** Page number (1-indexed) */
  pageNumber: number;
  /** Current processing status */
  status: PageStatus;
  /** Number of fields on this page */
  fieldCount: number;
  /** Error message if status is 'error' */
  error?: string;
  /** Number of retry attempts made */
  retryCount: number;
  /** Whether result was loaded from cache */
  fromCache: boolean;
}

/**
 * Overall enhancement progress tracking
 */
export interface EnhancementProgress {
  /** Total number of pages to process */
  totalPages: number;
  /** Number of pages completed successfully */
  completedPages: number;
  /** Number of pages that errored */
  errorPages: number;
  /** Per-page processing status */
  pageStatuses: PageProcessingStatus[];
  /** Timestamp when processing started */
  startTime: number;
}

/**
 * Complete form state for arbitrary PDF forms
 */
export interface FormState {
  // PDF-related state
  /** Whether a PDF has been loaded */
  pdfLoaded: boolean;
  /** Context for writing fields back to PDF */
  writeContext: PDFWriteContext | null;
  /** Current PDF bytes for rendering/download */
  pdfBytes: Uint8Array | null;
  /** Metadata about the loaded form */
  metadata: FormMetadata | null;
  /** Total number of pages in the PDF */
  pageCount: number;
  
  // Fields and sections
  /** Array of form fields extracted from PDF */
  fields: FormField[];
  /** Sections identified in the form (empty if no sections detected) */
  sections: FormSection[];
  
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
  /** Page-by-page processing progress */
  enhancementProgress: EnhancementProgress | null;
}

/**
 * Gemini API response schema for field enhancement
 */
export interface GeminiFieldEnhancement {
  formTitle: string;
  formDescription: string;
  /** Sections identified in the form */
  sections: Array<{
    id: string;
    title: string;
    description?: string;
    order: number;
  }>;
  fields: Array<{
    id: string;
    displayName: string;
    type: FieldType;
    description: string;
    /** Section ID this field belongs to */
    sectionId?: string;
    unit?: string;
    format?: string;
    /** Options for selection type - REQUIRED when type is 'selection' */
    options?: string[];
    /** Human-readable calculation description for display */
    calculationHint?: string;
    /** Parseable formula: "{Field A} - {Field B}" */
    formula?: string;
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
        writeContext: PDFWriteContext;
        pdfBytes: Uint8Array;
        pageCount: number;
      };
    }
  | { type: 'SET_FIELD'; fieldId: string; value: string }
  | { type: 'SET_ACTIVE_FIELD'; fieldId: string | null }
  | { type: 'MARK_FIELD_COMPLETE'; fieldId: string }
  | { type: 'MARK_FIELD_INCOMPLETE'; fieldId: string }
  | { type: 'SET_VALIDATION_ERROR'; fieldId: string; error: string }
  | { type: 'CLEAR_VALIDATION_ERROR'; fieldId: string }
  | { type: 'SET_VOICE_ACTIVE'; active: boolean }
  | { type: 'UPDATE_PDF_BYTES'; pdfBytes: Uint8Array }
  | { type: 'RESET_FORM' }
  // Enhancement actions
  | { type: 'START_ENHANCEMENT'; totalPages: number; pageStatuses: PageProcessingStatus[] }
  | { type: 'UPDATE_PAGE_PROGRESS'; pageNumber: number; status: PageProcessingStatus }
  | {
      type: 'COMPLETE_ENHANCEMENT';
      fields: FormField[];
      sections: FormSection[];
      title: string;
      description: string;
      cached: boolean;
    }
  | { type: 'ENHANCEMENT_ERROR'; error: string };