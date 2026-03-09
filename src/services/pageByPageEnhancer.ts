/**
 * Page-by-Page Form Enhancement Service
 * 
 * This module processes PDF forms page-by-page in parallel for faster
 * enhancement of large forms (7+ pages, 150+ fields).
 * 
 * Architecture:
 * - ALL pages processed in parallel (no concurrency limit)
 * - Each page gets full PDF context but only outputs its fields
 * - Page-level caching for granular re-processing
 * - 1 retry per page before marking as error
 */

import type { FormField, FormSection, PageProcessingStatus } from '../store/types';
import { analyzeFormPageWithGemini, isGeminiConfigured } from './geminiService';
import {
  getPDFHash,
  getCachedPageEnhancement,
  cachePageEnhancement,
  type PageEnhancementResult,
} from './enhancementCache';

/**
 * Progress callback type for real-time updates
 */
export type ProgressCallback = (pageNumber: number, status: PageProcessingStatus) => void;

/**
 * Result of enhancing all pages
 */
export interface PageByPageEnhancementResult {
  /** Enhanced fields with LLM metadata */
  fields: FormField[];
  /** Sections identified across all pages (deduplicated) */
  sections: FormSection[];
  /** Form title (from first page or filename) */
  formTitle: string;
  /** Form description */
  formDescription: string;
  /** Number of pages that were loaded from cache */
  cachedPages: number;
  /** Number of pages that had errors */
  errorPages: number;
}

/**
 * Process a single page with retry logic
 */
async function processPage(
  pdfBytes: Uint8Array,
  pageImages: string[],
  pageNumber: number,
  fieldIdsOnPage: string[],
  totalPages: number,
  isXFA: boolean,
  filename: string,
  pdfHash: string,
  onProgress: ProgressCallback,
): Promise<PageEnhancementResult | null> {
  // Check cache first
  const cached = getCachedPageEnhancement(filename, pdfHash, pageNumber);
  if (cached) {
    onProgress(pageNumber, {
      pageNumber,
      status: 'completed',
      fieldCount: fieldIdsOnPage.length,
      retryCount: 0,
      fromCache: true,
    });
    return cached;
  }

  // Process the page
  let retryCount = 0;
  const maxRetries = 1;
  
  while (retryCount <= maxRetries) {
    try {
      // Update status to processing
      onProgress(pageNumber, {
        pageNumber,
        status: 'processing',
        fieldCount: fieldIdsOnPage.length,
        retryCount,
        fromCache: false,
      });

      const result = await analyzeFormPageWithGemini(
        pdfBytes,
        pageImages,
        pageNumber,
        fieldIdsOnPage,
        totalPages,
        isXFA,
      );

      // Cache the successful result
      cachePageEnhancement(filename, pdfHash, pageNumber, result);

      // Update status to completed
      onProgress(pageNumber, {
        pageNumber,
        status: 'completed',
        fieldCount: fieldIdsOnPage.length,
        retryCount,
        fromCache: false,
      });

      return result;
    } catch (error) {
      console.error(`[PageEnhancer] Page ${pageNumber} attempt ${retryCount + 1} failed:`, error);
      retryCount++;
      
      if (retryCount > maxRetries) {
        // Max retries exceeded, mark as error
        onProgress(pageNumber, {
          pageNumber,
          status: 'error',
          fieldCount: fieldIdsOnPage.length,
          error: error instanceof Error ? error.message : 'Unknown error',
          retryCount,
          fromCache: false,
        });
        return null;
      }
      
      // Wait a bit before retrying
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return null;
}

/**
 * Merge enhancement results from a page into the basic fields
 */
function mergePageResults(
  basicFields: FormField[],
  pageResult: PageEnhancementResult
): FormField[] {
  return basicFields.map(field => {
    // Only update fields from this page
    if (field.pageNumber !== pageResult.pageNumber) {
      return field;
    }
    
    // Find matching enhanced field by ID
    const enhanced = pageResult.fields.find(f => f.id === field.id);
    
    if (enhanced) {
      return {
        ...field,
        // Keep original values
        id: field.id,
        originalName: field.originalName || field.name,
        value: field.value,
        pageNumber: field.pageNumber,
        
        // Apply enhanced metadata
        name: enhanced.displayName || field.name,
        localizedNames: enhanced.localizedNames || undefined,
        type: enhanced.type || 'text',
        description: enhanced.description || field.description,
        sectionId: enhanced.sectionId,
        unit: enhanced.unit,
        format: enhanced.format,
        options: enhanced.options,
        calculationHint: enhanced.calculationHint,
        formula: enhanced.formula,
        required: enhanced.required ?? field.required,
        readonly: enhanced.readonly ?? field.readonly,
        ignore: enhanced.ignore ?? false,
      };
    }
    
    return field;
  });
}

/**
 * Normalize a section title for comparison and deduplication
 * Handles case variations like "SECTION B - INFO" vs "Section B - Info"
 */
function normalizeSectionKey(title: string): string {
  // Trim and convert to lowercase
  let normalized = title.trim().toLowerCase();
  
  // Extract the section identifier pattern (e.g., "section a", "part 1", "i.")
  // Pattern matches: "section X", "part X", "X." where X is a letter or number
  const sectionMatch = normalized.match(/^(section|part)\s+([a-z0-9]+)/i);
  if (sectionMatch) {
    return `${sectionMatch[1]}_${sectionMatch[2]}`;
  }
  
  // Pattern for Roman numerals or letters with period: "I.", "A.", etc.
  const romanMatch = normalized.match(/^([ivxlcdm]+|[a-z])\.\s*/i);
  if (romanMatch) {
    return `roman_${romanMatch[1]}`;
  }
  
  // Fallback: use the full normalized title
  return normalized;
}

/**
 * Extract sort key from section title for proper ordering
 * Returns a string that sorts sections in the correct order:
 * - "Section A" before "Section B"
 * - "Part 1" before "Part 2"
 */
function extractSectionSortKey(title: string): string {
  const normalized = title.trim().toLowerCase();
  
  // Pattern: "Section A", "Section B", etc.
  const sectionLetterMatch = normalized.match(/^section\s+([a-z])/i);
  if (sectionLetterMatch) {
    // Return letter for alphabetical sorting (a=0, b=1, etc.)
    return `1_${sectionLetterMatch[1]}`;
  }
  
  // Pattern: "Part 1", "Part 2", etc.
  const partNumberMatch = normalized.match(/^part\s+(\d+)/i);
  if (partNumberMatch) {
    // Pad number for proper numeric sorting
    return `2_${partNumberMatch[1].padStart(3, '0')}`;
  }
  
  // Pattern: "Section 1", "Section 2", etc.
  const sectionNumberMatch = normalized.match(/^section\s+(\d+)/i);
  if (sectionNumberMatch) {
    return `1_${sectionNumberMatch[1].padStart(3, '0')}`;
  }
  
  // Pattern: Roman numerals "I.", "II.", "III.", etc.
  const romanMatch = normalized.match(/^([ivxlcdm]+)\./i);
  if (romanMatch) {
    const romanValue = romanToNumber(romanMatch[1]);
    return `3_${romanValue.toString().padStart(3, '0')}`;
  }
  
  // Pattern: Single letter "A.", "B.", etc.
  const letterMatch = normalized.match(/^([a-z])\./i);
  if (letterMatch) {
    return `4_${letterMatch[1]}`;
  }
  
  // Fallback: use original order position
  return `9_${normalized}`;
}

/**
 * Convert Roman numeral to number for sorting
 */
function romanToNumber(roman: string): number {
  const romanMap: Record<string, number> = {
    'i': 1, 'v': 5, 'x': 10, 'l': 50, 'c': 100, 'd': 500, 'm': 1000
  };
  
  let result = 0;
  const lower = roman.toLowerCase();
  
  for (let i = 0; i < lower.length; i++) {
    const current = romanMap[lower[i]] || 0;
    const next = romanMap[lower[i + 1]] || 0;
    
    if (current < next) {
      result -= current;
    } else {
      result += current;
    }
  }
  
  return result;
}

/**
 * Deduplicate and order sections from all pages
 * Handles case variations and sorts by section identifier
 */
function mergeSections(allSections: FormSection[][]): FormSection[] {
  // Use normalized key for deduplication, but keep original section data
  const sectionMap = new Map<string, FormSection>();
  
  for (const pageSections of allSections) {
    for (const section of pageSections) {
      // Generate a normalized key that handles case variations
      const normalizedKey = normalizeSectionKey(section.title);
      
      // Keep the first occurrence of each section (it should have the most context)
      if (!sectionMap.has(normalizedKey)) {
        sectionMap.set(normalizedKey, section);
      }
    }
  }
  
  // Sort by extracted section identifier, then by order as fallback
  return Array.from(sectionMap.values()).sort((a, b) => {
    const keyA = extractSectionSortKey(a.title);
    const keyB = extractSectionSortKey(b.title);
    
    // Primary sort: by extracted section key
    const keyCompare = keyA.localeCompare(keyB);
    if (keyCompare !== 0) {
      return keyCompare;
    }
    
    // Secondary sort: by order property
    return a.order - b.order;
  });
}

/**
 * Extract title from filename as fallback
 */
function extractTitleFromFilename(filename: string): string {
  return filename
    .replace(/\.[^/.]+$/, '')
    .replace(/[-_]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .trim();
}

/**
 * Enhance form fields using page-by-page parallel processing
 *
 * This is the main entry point for the page-by-page enhancement system.
 * It processes all pages in parallel, with caching and retry logic.
 *
 * @param filename - Original PDF filename
 * @param pdfBytes - PDF file bytes
 * @param basicFields - Fields extracted from PDF by pdfParser
 * @param fieldsByPage - Fields grouped by page number
 * @param pageImages - Rendered page images for Gemini vision
 * @param pageCount - Total number of pages
 * @param isXFA - Whether this is an XFA form
 * @param onProgress - Callback for progress updates
 * @returns Enhanced fields with LLM metadata
 */
export async function enhanceFormFieldsPageByPage(
  filename: string,
  pdfBytes: Uint8Array,
  basicFields: FormField[],
  fieldsByPage: Map<number, FormField[]>,
  pageImages: string[],
  pageCount: number,
  isXFA: boolean,
  onProgress: ProgressCallback,
): Promise<PageByPageEnhancementResult> {
  // Check if Gemini API is configured
  if (!isGeminiConfigured()) {
    console.warn('[PageEnhancer] Gemini API not configured, returning basic fields');
    return {
      fields: basicFields.map(f => ({
        ...f,
        originalName: f.originalName || f.name,
        type: f.type || 'text',
        description: f.description || `Please provide the value for ${f.name}`,
        ignore: f.ignore ?? false,
      })),
      sections: [],
      formTitle: extractTitleFromFilename(filename),
      formDescription: 'Form loaded without AI enhancement (API key not configured)',
      cachedPages: 0,
      errorPages: 0,
    };
  }

  // Compute PDF hash once for all pages
  const pdfHash = await getPDFHash(pdfBytes);
  
  // Get pages that have fields
  const pagesWithFields = Array.from(fieldsByPage.keys()).sort((a, b) => a - b);
  
  console.log(`[PageEnhancer] Processing ${pagesWithFields.length} pages with fields in parallel`);
  
  // Initialize progress for all pages
  for (const pageNum of pagesWithFields) {
    const fields = fieldsByPage.get(pageNum) || [];
    onProgress(pageNum, {
      pageNumber: pageNum,
      status: 'pending',
      fieldCount: fields.length,
      retryCount: 0,
      fromCache: false,
    });
  }

  // Process ALL pages in parallel
  const pagePromises = pagesWithFields.map(pageNum => {
    const pageFields = fieldsByPage.get(pageNum) || [];
    const fieldIds = pageFields.map(f => f.id);
    
    return processPage(
      pdfBytes,
      pageImages,
      pageNum,
      fieldIds,
      pageCount,
      isXFA,
      filename,
      pdfHash,
      onProgress,
    );
  });

  // Wait for all pages to complete
  const pageResults = await Promise.all(pagePromises);
  
  // Merge results into basic fields
  let enhancedFields = [...basicFields];
  const allSections: FormSection[][] = [];
  let cachedPages = 0;
  let errorPages = 0;
  let aiFormTitle: string | undefined;
  let aiFormDescription: string | undefined;
  
  for (let i = 0; i < pageResults.length; i++) {
    const result = pageResults[i];
    
    if (result) {
      enhancedFields = mergePageResults(enhancedFields, result);
      allSections.push(result.sections);
      
      // Extract form title from the first page result (page 1 typically has the header)
      // Only use if it's not a generic fallback value
      if (!aiFormTitle && result.formTitle && result.formTitle !== 'Untitled Form') {
        aiFormTitle = result.formTitle;
      }
      if (!aiFormDescription && result.formDescription && result.formDescription !== 'A fillable PDF form') {
        aiFormDescription = result.formDescription;
      }
      
      // Check if this was from cache
      const pageNum = pagesWithFields[i];
      const cached = getCachedPageEnhancement(filename, pdfHash, pageNum);
      if (cached) {
        cachedPages++;
      }
    } else {
      errorPages++;
    }
  }
  
  // Merge and deduplicate sections
  const sections = mergeSections(allSections);
  
  // Use AI-extracted title, fallback to filename-derived title
  const formTitle = aiFormTitle || extractTitleFromFilename(filename);
  const formDescription = errorPages > 0
    ? `Form analyzed with ${errorPages} page(s) that could not be processed`
    : (aiFormDescription || '');
  
  console.log(`[PageEnhancer] Complete: ${pagesWithFields.length - errorPages} pages processed, ${cachedPages} from cache, ${errorPages} errors`);
  
  return {
    fields: enhancedFields,
    sections,
    formTitle,
    formDescription,
    cachedPages,
    errorPages,
  };
}

/**
 * Get initial page statuses for a form
 */
export function getInitialPageStatuses(
  fieldsByPage: Map<number, FormField[]>
): PageProcessingStatus[] {
  const statuses: PageProcessingStatus[] = [];
  
  for (const [pageNum, fields] of fieldsByPage) {
    statuses.push({
      pageNumber: pageNum,
      status: 'pending',
      fieldCount: fields.length,
      retryCount: 0,
      fromCache: false,
    });
  }
  
  return statuses.sort((a, b) => a.pageNumber - b.pageNumber);
}