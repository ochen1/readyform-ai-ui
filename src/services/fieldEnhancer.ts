import type { FormField, GeminiFieldEnhancement } from '../store/types';
import { analyzeFormWithGemini, isGeminiConfigured } from './geminiService';
import { getCachedEnhancement, cacheEnhancement } from './enhancementCache';

/**
 * Result of the enhancement process
 */
export interface EnhancementResult {
  /** Enhanced fields with LLM metadata */
  fields: FormField[];
  /** Form title from LLM analysis */
  formTitle: string;
  /** Form description from LLM analysis */
  formDescription: string;
  /** Whether the result was loaded from cache */
  fromCache: boolean;
}

/**
 * Merge basic PDF-extracted fields with Gemini enhancement data
 * Maps the Gemini response format to our FormField structure
 */
function mergeEnhancements(
  basicFields: FormField[],
  enhancement: GeminiFieldEnhancement
): FormField[] {
  return basicFields.map(field => {
    // Find matching enhanced field by ID
    const enhanced = enhancement.fields.find(f => f.id === field.id);
    
    if (enhanced) {
      return {
        ...field,
        // Keep original values
        id: field.id,
        originalName: field.originalName || field.name,
        value: field.value,
        
        // Apply enhanced metadata
        name: enhanced.displayName || field.name,
        type: enhanced.type || 'text',
        description: enhanced.description || field.description,
        unit: enhanced.unit,
        format: enhanced.format,
        options: enhanced.options,
        calculationHint: enhanced.calculationHint,
        required: enhanced.required ?? field.required,
        readonly: enhanced.readonly ?? field.readonly,
        ignore: enhanced.ignore ?? false,
      };
    }
    
    // Check if field is in the ignored list
    if (enhancement.ignoredFields.includes(field.id)) {
      return {
        ...field,
        ignore: true,
      };
    }
    
    // Return field as-is if not found in enhancement
    return field;
  });
}

/**
 * Create fallback basic fields when enhancement is not available
 * Sets sensible defaults for all required properties
 */
function createBasicFields(fields: FormField[]): FormField[] {
  return fields.map(field => ({
    ...field,
    originalName: field.originalName || field.name,
    type: field.type || 'text',
    description: field.description || `Please provide the value for ${field.name}`,
    ignore: field.ignore ?? false,
  }));
}

/**
 * Extract title from filename as fallback
 */
function extractTitleFromFilename(filename: string): string {
  return filename
    .replace(/\.[^/.]+$/, '') // Remove extension
    .replace(/[-_]/g, ' ') // Replace dashes/underscores with spaces
    .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space before capitals
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .trim();
}

/**
 * Enhance form fields using Gemini AI
 * 
 * This is the main orchestration function that:
 * 1. Checks for cached enhancement
 * 2. Calls Gemini API if not cached
 * 3. Caches the result
 * 4. Falls back to basic fields on error
 * 
 * @param filename - Original PDF filename
 * @param pdfBytes - PDF file bytes for Gemini vision and caching
 * @param basicFields - Fields extracted from PDF by pdfParser
 * @returns Enhanced fields with LLM metadata
 */
export async function enhanceFormFields(
  filename: string,
  pdfBytes: Uint8Array,
  basicFields: FormField[]
): Promise<EnhancementResult> {
  // Try to get cached enhancement first
  const cached = await getCachedEnhancement(filename, pdfBytes);
  
  if (cached) {
    console.log('[Enhancer] Using cached enhancement');
    return {
      fields: mergeEnhancements(basicFields, cached),
      formTitle: cached.formTitle,
      formDescription: cached.formDescription,
      fromCache: true,
    };
  }
  
  // Check if Gemini API is configured
  if (!isGeminiConfigured()) {
    console.warn('[Enhancer] Gemini API not configured, using basic fields');
    return {
      fields: createBasicFields(basicFields),
      formTitle: extractTitleFromFilename(filename),
      formDescription: 'Form loaded without AI enhancement (API key not configured)',
      fromCache: false,
    };
  }
  
  try {
    console.log('[Enhancer] Calling Gemini API for enhancement');
    
    // Extract field IDs/names for the API call
    const fieldNames = basicFields.map(f => f.id);
    
    // Call Gemini API
    const enhancement = await analyzeFormWithGemini(pdfBytes, fieldNames);
    
    // Cache the successful result
    await cacheEnhancement(filename, pdfBytes, enhancement);
    
    // Merge and return
    return {
      fields: mergeEnhancements(basicFields, enhancement),
      formTitle: enhancement.formTitle,
      formDescription: enhancement.formDescription,
      fromCache: false,
    };
  } catch (error) {
    console.error('[Enhancer] Gemini enhancement failed:', error);
    
    // Fall back to basic fields
    return {
      fields: createBasicFields(basicFields),
      formTitle: extractTitleFromFilename(filename),
      formDescription: `Form loaded (AI enhancement failed: ${error instanceof Error ? error.message : 'Unknown error'})`,
      fromCache: false,
    };
  }
}

/**
 * Get visible (non-ignored) fields from a field array
 */
export function getVisibleFields(fields: FormField[]): FormField[] {
  return fields.filter(f => !f.ignore);
}

/**
 * Get editable (non-readonly, non-ignored) fields from a field array
 */
export function getEditableFields(fields: FormField[]): FormField[] {
  return fields.filter(f => !f.ignore && !f.readonly);
}

/**
 * Count fields by type
 */
export function countFieldsByType(fields: FormField[]): Record<string, number> {
  return fields.reduce((acc, field) => {
    acc[field.type] = (acc[field.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}