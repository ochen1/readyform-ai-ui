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
  onProgress: ProgressCallback
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
        isXFA
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
 * Deduplicate and order sections from all pages
 */
function mergeSections(allSections: FormSection[][]): FormSection[] {
  const sectionMap = new Map<string, FormSection>();
  
  for (const pageSections of allSections) {
    for (const section of pageSections) {
      // Keep the first occurrence of each section (it should have the most context)
      if (!sectionMap.has(section.id)) {
        sectionMap.set(section.id, section);
      }
    }
  }
  
  // Sort by order
  return Array.from(sectionMap.values()).sort((a, b) => a.order - b.order);
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
  onProgress: ProgressCallback
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
      onProgress
    );
  });

  // Wait for all pages to complete
  const pageResults = await Promise.all(pagePromises);
  
  // Merge results into basic fields
  let enhancedFields = [...basicFields];
  const allSections: FormSection[][] = [];
  let cachedPages = 0;
  let errorPages = 0;
  
  for (let i = 0; i < pageResults.length; i++) {
    const result = pageResults[i];
    
    if (result) {
      enhancedFields = mergePageResults(enhancedFields, result);
      allSections.push(result.sections);
      
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
  
  // Generate title and description
  const formTitle = extractTitleFromFilename(filename);
  const formDescription = errorPages > 0
    ? `Form analyzed with ${errorPages} page(s) that could not be processed`
    : ``;
  
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