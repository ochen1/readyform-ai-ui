import * as pdfjsLib from 'pdfjs-dist';
import type { FormField, FormMetadata, PDFWriteContext } from '../store/types';

// Set up the worker - pdfjs-dist needs this for parsing
// We use the local worker bundled with pdfjs-dist
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

/**
 * Result of parsing a PDF file
 */
export interface ParsedPDF {
  fields: FormField[];
  metadata: FormMetadata;
  writeContext: PDFWriteContext;
  pdfBytes: Uint8Array;
}

/**
 * Internal representation of a PDF form field from pdfjs-dist
 */
interface PDFJSAnnotation {
  fieldType?: string;
  fieldName?: string;
  fieldValue?: string | string[] | boolean;
  readOnly?: boolean;
  buttonValue?: string;
  options?: Array<{ exportValue: string; displayValue: string }>;
  subtype?: string;
  alternativeText?: string;
}

/**
 * Convert a PDF field name to a display-friendly name
 * Examples:
 * - "Producers name and address surname first" -> "Producers Name And Address Surname First"
 * - "gross_weight" -> "Gross Weight"
 * - "Date of issue yyyymmdd" -> "Date Of Issue Yyyymmdd"
 */
export function fieldNameToDisplayName(pdfFieldName: string): string {
  return pdfFieldName
    // Replace underscores with spaces
    .replace(/_/g, ' ')
    // Add space before capital letters (for camelCase)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    // Capitalize first letter of each word
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .trim();
}

/**
 * Extract a filename without extension to use as form title
 */
function extractTitleFromFilename(filename: string): string {
  // Remove extension
  const withoutExt = filename.replace(/\.[^/.]+$/, '');
  // Convert to title case
  return fieldNameToDisplayName(withoutExt);
}

/**
 * Parse a PDF file and extract all fillable form fields using pdfjs-dist
 * This approach supports both AcroForm and XFA forms
 */
export async function parsePDF(file: File): Promise<ParsedPDF> {
  // Read file as ArrayBuffer
  const arrayBuffer = await file.arrayBuffer();
  const pdfBytes = new Uint8Array(arrayBuffer);
  
  // Load PDF document with pdfjs-dist
  // Use password: '' to handle encrypted PDFs that have no password
  const loadingTask = pdfjsLib.getDocument({
    data: pdfBytes,
    password: '', // Allow "encrypted" PDFs with empty password
    useSystemFonts: true,
  });
  
  let pdf: pdfjsLib.PDFDocumentProxy;
  try {
    pdf = await loadingTask.promise;
  } catch (error) {
    // If it's a password-protected PDF, re-throw with helpful message
    if (error instanceof Error && error.message.includes('password')) {
      throw new Error('This PDF is password-protected. Please provide an unprotected PDF.');
    }
    throw new Error(`Failed to load PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  // Extract fields from all pages
  const fields: FormField[] = [];
  const fieldNames = new Set<string>();
  let isXFA = false;
  
  // Check if this is an XFA form (pdfjs-dist handles XFA differently)
  try {
    // Try to detect XFA by checking metadata
    const metadata = await pdf.getMetadata();
    const info = metadata?.info as Record<string, unknown> | undefined;
    // XFA forms often have specific markers
    if (info && (info['IsXFAPresent'] || info['XFA'])) {
      isXFA = true;
      console.log('[PDF Parser] Detected XFA form');
    }
  } catch {
    // Ignore metadata errors
  }
  
  // Process each page
  const numPages = pdf.numPages;
  
  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    
    // Get all annotations (form fields are a type of annotation)
    const annotations = await page.getAnnotations({ intent: 'display' });
    
    for (const annotation of annotations) {
      const anno = annotation as PDFJSAnnotation;
      
      // Skip non-form field annotations
      if (!anno.fieldName && !anno.fieldType) {
        continue;
      }
      
      const fieldName = anno.fieldName || `field_${fields.length}`;
      
      // Skip duplicate fields (can happen with multi-page forms)
      if (fieldNames.has(fieldName)) {
        continue;
      }
      fieldNames.add(fieldName);
      
      // Determine current value
      let currentValue = '';
      if (anno.fieldValue !== undefined && anno.fieldValue !== null) {
        if (typeof anno.fieldValue === 'string') {
          currentValue = anno.fieldValue;
        } else if (typeof anno.fieldValue === 'boolean') {
          currentValue = anno.fieldValue ? 'true' : 'false';
        } else if (Array.isArray(anno.fieldValue)) {
          currentValue = anno.fieldValue.join(', ');
        }
      }
      
      // Determine if read-only
      const isReadonly = anno.readOnly === true;
      
      // Get display name
      const displayName = fieldNameToDisplayName(fieldName);
      
      // Create field entry
      fields.push({
        id: fieldName,
        originalName: fieldName,
        name: displayName,
        value: currentValue,
        type: 'text', // Default type - will be enhanced by LLM
        description: anno.alternativeText || `Please provide the value for ${displayName}`,
        required: false, // Could be enhanced with LLM
        readonly: isReadonly,
        ignore: false, // Will be set by LLM if field should be skipped
      });
    }
  }
  
  // Also check for fields defined in the AcroForm dictionary (for non-XFA forms)
  // This catches fields that might not appear as page annotations
  try {
    // pdfjs-dist doesn't directly expose AcroForm, but the annotations should cover it
    // If we have zero fields, try to get form data differently
    if (fields.length === 0) {
      console.log('[PDF Parser] No fields found in annotations, checking for embedded form data');
      
      // For XFA forms, the data might be embedded differently
      // pdfjs-dist handles XFA form extraction through annotations on most cases
      // If truly no fields found, the PDF might not have fillable fields
    }
  } catch (error) {
    console.warn('[PDF Parser] Error checking for additional form fields:', error);
  }
  
  // Generate metadata
  const metadata: FormMetadata = {
    title: extractTitleFromFilename(file.name),
    sourceFileName: file.name,
    fieldCount: fields.length,
  };
  
  // Create write context
  // For XFA forms, we can't write back with pdf-lib, so track that
  const writeContext: PDFWriteContext = {
    originalBytes: arrayBuffer,
    isXFA,
    writableFieldIds: isXFA ? [] : fields.filter(f => !f.readonly).map(f => f.id),
  };
  
  console.log(`[PDF Parser] Parsed ${fields.length} fields from ${file.name}${isXFA ? ' (XFA form)' : ''}`);
  
  return {
    fields,
    metadata,
    writeContext,
    pdfBytes,
  };
}

/**
 * Update a field value in the PDF document using pdf-lib
 * This only works for AcroForm (non-XFA) PDFs
 */
export async function updatePDFField(
  writeContext: PDFWriteContext,
  fieldId: string,
  value: string
): Promise<Uint8Array | null> {
  // Can't update XFA forms
  if (writeContext.isXFA) {
    console.warn('[PDF Parser] Cannot update XFA form fields - XFA write-back not supported');
    return null;
  }
  
  // Check if field is writable
  if (!writeContext.writableFieldIds.includes(fieldId)) {
    console.warn(`[PDF Parser] Field ${fieldId} is not writable`);
    return null;
  }
  
  try {
    // Dynamically import pdf-lib only when needed (for writing)
    const { PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown, PDFRadioGroup } = await import('pdf-lib');
    
    // Load the PDF from original bytes
    const pdfDoc = await PDFDocument.load(writeContext.originalBytes, {
      ignoreEncryption: true, // Handle encrypted PDFs
    });
    
    const form = pdfDoc.getForm();
    
    try {
      const field = form.getField(fieldId);
      
      if (field instanceof PDFTextField) {
        field.setText(value);
      } else if (field instanceof PDFCheckBox) {
        if (value === 'true' || value === '1' || value.toLowerCase() === 'yes') {
          field.check();
        } else {
          field.uncheck();
        }
      } else if (field instanceof PDFDropdown) {
        field.select(value);
      } else if (field instanceof PDFRadioGroup) {
        field.select(value);
      }
    } catch (fieldError) {
      console.error(`[PDF Parser] Failed to update field ${fieldId}:`, fieldError);
      return null;
    }
    
    // Save and return updated bytes
    const updatedBytes = await pdfDoc.save();
    
    // Also update the original bytes in the context so subsequent writes chain properly
    // Create a proper ArrayBuffer copy
    const newArrayBuffer = new ArrayBuffer(updatedBytes.byteLength);
    new Uint8Array(newArrayBuffer).set(updatedBytes);
    (writeContext as { originalBytes: ArrayBuffer }).originalBytes = newArrayBuffer;
    
    return updatedBytes;
  } catch (error) {
    console.error('[PDF Parser] Failed to update PDF:', error);
    return null;
  }
}

/**
 * Generate a Blob from PDF bytes for download
 */
export function generatePDFBlob(pdfBytes: Uint8Array): Blob {
  // Create a new ArrayBuffer copy to ensure compatibility
  return new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
}

/**
 * Open the PDF in a new browser tab
 */
export function openPDFInNewTab(pdfBytes: Uint8Array): void {
  const blob = generatePDFBlob(pdfBytes);
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  
  // Clean up the URL after a short delay
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Download the PDF file
 */
export function downloadPDF(pdfBytes: Uint8Array, filename: string): void {
  const blob = generatePDFBlob(pdfBytes);
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.startsWith('filled_') ? filename : `filled_${filename}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Clean up
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}