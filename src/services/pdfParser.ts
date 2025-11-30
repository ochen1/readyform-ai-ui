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
  /** Rendered page images as base64 PNG (for Gemini vision on XFA forms) */
  pageImages?: string[];
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
 * Check if a field name looks like an XFA path
 * XFA paths have patterns like: "FormName E[0].Page1[0].Section A[0].txt F FieldName[0]"
 */
function isXFAFieldName(fieldName: string): boolean {
  // XFA paths contain bracketed indices and multiple dots
  return /\[\d+\]/.test(fieldName) && /\./.test(fieldName);
}

/**
 * Extract human-readable field name from XFA path
 * Example: "LAB1189 E[0].Page1[0].sf Section A[0].txt F Last Name[0]" -> "Last Name"
 */
function parseXFAFieldName(xfaPath: string): string {
  // XFA paths often end with "txt F FieldName[0]" or similar patterns
  // Try to extract the last meaningful part
  
  // Pattern 1: Look for "txt F FieldName[index]" or "txt T FieldName[index]"
  const txtMatch = xfaPath.match(/\.txt\s+[FT]\s+([^[]+)\[\d+\]$/i);
  if (txtMatch) {
    return txtMatch[1].trim();
  }
  
  // Pattern 2: Look for the last segment after the last dot that has a readable name
  const segments = xfaPath.split('.');
  for (let i = segments.length - 1; i >= 0; i--) {
    const segment = segments[i];
    // Remove index brackets and clean up
    const cleaned = segment.replace(/\[\d+\]/g, '').trim();
    
    // Skip technical segments like "Page1", "E", "sf Section A", etc.
    if (cleaned &&
        !/^Page\d*$/i.test(cleaned) &&
        !/^Section\s+[A-Z]$/i.test(cleaned) &&
        !/^sf\s/i.test(cleaned) &&
        !/^[A-Z]$/.test(cleaned) && // Single letters like "E"
        cleaned.length > 2) {
      
      // Check if it contains "txt F" or "txt T" pattern inside
      const innerMatch = cleaned.match(/txt\s+[FT]\s+(.+)$/i);
      if (innerMatch) {
        return innerMatch[1].trim();
      }
      
      return cleaned;
    }
  }
  
  // Fallback: return original (will be cleaned up by fieldNameToDisplayName)
  return xfaPath;
}

/**
 * Convert a PDF field name to a display-friendly name
 * Examples:
 * - "Producers name and address surname first" -> "Producers Name And Address Surname First"
 * - "gross_weight" -> "Gross Weight"
 * - "Date of issue yyyymmdd" -> "Date Of Issue Yyyymmdd"
 * - XFA: "LAB1189 E[0].Page1[0].txt F Last Name[0]" -> "Last Name"
 */
export function fieldNameToDisplayName(pdfFieldName: string): string {
  // Check if this is an XFA-style field name
  if (isXFAFieldName(pdfFieldName)) {
    const extractedName = parseXFAFieldName(pdfFieldName);
    // Recursively process the extracted name (in case it needs title casing)
    return fieldNameToDisplayName(extractedName);
  }
  
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
 * Render PDF pages as images (for XFA forms that need visual analysis)
 * Returns base64-encoded PNG images for each page
 *
 * @param pdf - The loaded PDF document proxy
 * @param maxPages - Maximum number of pages to render (default: 3)
 * @param scale - Render scale (default: 1.5 for decent quality without being too large)
 * @returns Array of base64-encoded PNG image strings
 */
async function renderPDFPagesAsImages(
  pdf: pdfjsLib.PDFDocumentProxy,
  maxPages: number = 3,
  scale: number = 1.5
): Promise<string[]> {
  const images: string[] = [];
  const numPagesToRender = Math.min(pdf.numPages, maxPages);
  
  for (let pageNum = 1; pageNum <= numPagesToRender; pageNum++) {
    try {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      
      // Create an off-screen canvas
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      if (!context) {
        console.warn(`[PDF Parser] Could not create canvas context for page ${pageNum}`);
        continue;
      }
      
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      // Render the page to the canvas
      // pdfjs-dist v5 requires the canvas property
      await page.render({
        canvasContext: context,
        viewport: viewport,
        canvas: canvas,
      } as Parameters<typeof page.render>[0]).promise;
      
      // Convert to base64 PNG
      const base64Image = canvas.toDataURL('image/png').split(',')[1];
      images.push(base64Image);
      
      console.log(`[PDF Parser] Rendered page ${pageNum} as image (${canvas.width}x${canvas.height})`);
    } catch (error) {
      console.warn(`[PDF Parser] Failed to render page ${pageNum}:`, error);
    }
  }
  
  return images;
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
      // For XFA forms, the alternativeText often contains a better human-readable name
      // than the field path. Use it as the display name if it's available and meaningful.
      let displayName: string;
      const hasXFAPath = isXFAFieldName(fieldName);
      
      if (hasXFAPath && anno.alternativeText && anno.alternativeText.length > 0) {
        // For XFA forms with alternativeText, use that as the display name
        // alternativeText often contains the actual label like "Mailing address (number, street, apartment)"
        displayName = anno.alternativeText;
      } else {
        // Fall back to parsing the field name
        displayName = fieldNameToDisplayName(fieldName);
      }
      
      // Create a description - for XFA with alternativeText we already used it for name
      // so provide a generic description
      const description = hasXFAPath && anno.alternativeText
        ? `Please provide the value for ${displayName}`
        : (anno.alternativeText || `Please provide the value for ${displayName}`);
      
      // Create field entry
      fields.push({
        id: fieldName,
        originalName: fieldName,
        name: displayName,
        value: currentValue,
        type: 'text', // Default type - will be enhanced by LLM
        description,
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
  
  // For XFA forms or forms with poor field names, render pages as images for Gemini
  // This helps Gemini understand the visual layout and field context
  let pageImages: string[] | undefined;
  
  // Detect if we need visual analysis:
  // 1. XFA forms (complex field names)
  // 2. Fields with XFA-style names that weren't fully parsed
  const hasComplexFieldNames = fields.some(f => isXFAFieldName(f.id));
  
  if (isXFA || hasComplexFieldNames) {
    console.log('[PDF Parser] Rendering pages as images for Gemini visual analysis');
    try {
      pageImages = await renderPDFPagesAsImages(pdf, 3, 1.5);
      console.log(`[PDF Parser] Rendered ${pageImages.length} page images`);
    } catch (error) {
      console.warn('[PDF Parser] Failed to render page images:', error);
    }
  }
  
  console.log(`[PDF Parser] Parsed ${fields.length} fields from ${file.name}${isXFA ? ' (XFA form)' : ''}`);
  
  return {
    fields,
    metadata,
    writeContext,
    pdfBytes,
    pageImages,
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