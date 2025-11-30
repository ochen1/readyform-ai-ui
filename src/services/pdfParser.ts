import { PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown, PDFRadioGroup } from 'pdf-lib';
import type { FormField, FormMetadata } from '../store/types';

/**
 * Result of parsing a PDF file
 */
export interface ParsedPDF {
  fields: FormField[];
  metadata: FormMetadata;
  pdfDoc: PDFDocument;
  pdfBytes: Uint8Array;
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
 * Parse a PDF file and extract all fillable form fields
 */
export async function parsePDF(file: File): Promise<ParsedPDF> {
  // Read file as ArrayBuffer
  const arrayBuffer = await file.arrayBuffer();
  
  // Load PDF document
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  
  // Get form and fields
  const form = pdfDoc.getForm();
  const formFields = form.getFields();
  
  // Extract fields
  const fields: FormField[] = [];
  
  for (const field of formFields) {
    const fieldName = field.getName();
    
    // Determine if field is read-only
    // For now, we only support text fields, checkboxes, dropdowns, and radio groups
    let isReadonly = false;
    let currentValue = '';
    
    if (field instanceof PDFTextField) {
      currentValue = field.getText() || '';
      // Check if field is read-only by attempting to check its flags
      try {
        isReadonly = field.isReadOnly();
      } catch {
        isReadonly = false;
      }
    } else if (field instanceof PDFCheckBox) {
      currentValue = field.isChecked() ? 'true' : 'false';
    } else if (field instanceof PDFDropdown) {
      const selected = field.getSelected();
      currentValue = selected.length > 0 ? selected[0] : '';
    } else if (field instanceof PDFRadioGroup) {
      currentValue = field.getSelected() || '';
    } else {
      // For other field types, we'll treat them as text
      currentValue = '';
    }
    
    const displayName = fieldNameToDisplayName(fieldName);
    
    fields.push({
      id: fieldName,
      originalName: fieldName, // Raw PDF field name
      name: displayName, // Display-friendly name (will be enhanced by LLM)
      value: currentValue,
      type: 'text', // Default type - will be enhanced by LLM
      description: `Please provide the value for ${displayName}`, // Default description
      required: false, // Could be enhanced with PDF field flags or LLM
      readonly: isReadonly,
      ignore: false, // Will be set by LLM if field should be skipped
    });
  }
  
  // Generate metadata
  const metadata: FormMetadata = {
    title: extractTitleFromFilename(file.name),
    sourceFileName: file.name,
    fieldCount: fields.length,
  };
  
  // Get initial bytes
  const pdfBytes = await pdfDoc.save();
  
  return {
    fields,
    metadata,
    pdfDoc,
    pdfBytes,
  };
}

/**
 * Update a field value in the PDF document and return updated bytes
 */
export async function updatePDFField(
  pdfDoc: PDFDocument,
  fieldId: string,
  value: string
): Promise<Uint8Array> {
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
    // For other field types, we attempt to set as text if possible
  } catch (error) {
    console.error(`Failed to update field ${fieldId}:`, error);
  }
  
  return pdfDoc.save();
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