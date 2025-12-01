import type { GeminiFieldEnhancement } from '../store/types';

const CACHE_PREFIX = 'form-enhancement-';
const PAGE_CACHE_PREFIX = 'form-page-';
const CACHE_VERSION = 'v2'; // Updated for page-level caching

/**
 * Generate a SHA-256 hash from PDF bytes for cache key
 * Uses the Web Crypto API for efficient hashing
 */
async function hashPDFBytes(bytes: Uint8Array): Promise<string> {
  try {
    // Create a new Uint8Array copy to ensure we have a proper ArrayBuffer
    const copy = new Uint8Array(bytes);
    const hashBuffer = await crypto.subtle.digest('SHA-256', copy);
    const hashArray = Array.from(new Uint8Array(hashBuffer as ArrayBuffer));
    // Return first 16 hex characters (64 bits) - enough for uniqueness
    return hashArray
      .slice(0, 8)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  } catch (error) {
    // Fallback: use file size and first/last bytes as a simple hash
    const size = bytes.length;
    const first = bytes.slice(0, 16);
    const last = bytes.slice(-16);
    const combined = [...first, ...last, size];
    return combined.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
  }
}

/**
 * Generate a cache key from filename and content hash
 */
function getCacheKey(filename: string, hash: string): string {
  // Sanitize filename for use in key
  const sanitizedFilename = filename
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .slice(0, 50);
  return `${CACHE_PREFIX}${CACHE_VERSION}-${sanitizedFilename}-${hash}`;
}

/**
 * Cache entry structure for full form storage
 */
interface CacheEntry {
  enhancement: GeminiFieldEnhancement;
  timestamp: number;
  version: string;
}

/**
 * Page-level enhancement result for caching
 */
export interface PageEnhancementResult {
  pageNumber: number;
  fields: GeminiFieldEnhancement['fields'];
  sections: GeminiFieldEnhancement['sections'];
}

/**
 * Cache entry structure for page-level storage
 */
interface PageCacheEntry {
  result: PageEnhancementResult;
  timestamp: number;
  version: string;
}

/**
 * Maximum age for cache entries (7 days in milliseconds)
 */
const MAX_CACHE_AGE = 7 * 24 * 60 * 60 * 1000;

/**
 * Retrieve cached enhancement for a PDF file
 * 
 * @param filename - Original filename of the PDF
 * @param pdfBytes - PDF file bytes (used to generate content hash)
 * @returns Cached enhancement or null if not found/expired
 */
export async function getCachedEnhancement(
  filename: string,
  pdfBytes: Uint8Array
): Promise<GeminiFieldEnhancement | null> {
  try {
    const hash = await hashPDFBytes(pdfBytes);
    const key = getCacheKey(filename, hash);
    const cached = localStorage.getItem(key);
    
    if (!cached) {
      return null;
    }
    
    const entry: CacheEntry = JSON.parse(cached);
    
    // Check if cache version matches
    if (entry.version !== CACHE_VERSION) {
      localStorage.removeItem(key);
      return null;
    }
    
    // Check if cache has expired
    if (Date.now() - entry.timestamp > MAX_CACHE_AGE) {
      localStorage.removeItem(key);
      return null;
    }
    
    console.log(`[Cache] Using cached enhancement for ${filename}`);
    return entry.enhancement;
  } catch (error) {
    console.warn('[Cache] Failed to retrieve cached enhancement:', error);
    return null;
  }
}

/**
 * Store enhancement in cache
 * 
 * @param filename - Original filename of the PDF
 * @param pdfBytes - PDF file bytes (used to generate content hash)
 * @param enhancement - The enhancement data to cache
 */
export async function cacheEnhancement(
  filename: string,
  pdfBytes: Uint8Array,
  enhancement: GeminiFieldEnhancement
): Promise<void> {
  try {
    const hash = await hashPDFBytes(pdfBytes);
    const key = getCacheKey(filename, hash);
    
    const entry: CacheEntry = {
      enhancement,
      timestamp: Date.now(),
      version: CACHE_VERSION,
    };
    
    localStorage.setItem(key, JSON.stringify(entry));
    console.log(`[Cache] Cached enhancement for ${filename}`);
  } catch (error) {
    // LocalStorage might be full or disabled
    console.warn('[Cache] Failed to cache enhancement:', error);
    
    // Try to clear old entries and retry
    try {
      clearOldCacheEntries();
      const hash = await hashPDFBytes(pdfBytes);
      const key = getCacheKey(filename, hash);
      const entry: CacheEntry = {
        enhancement,
        timestamp: Date.now(),
        version: CACHE_VERSION,
      };
      localStorage.setItem(key, JSON.stringify(entry));
    } catch {
      // Give up silently - caching is not critical
    }
  }
}

/**
 * Clear all enhancement cache entries
 */
export function clearEnhancementCache(): void {
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX));
    keys.forEach(k => localStorage.removeItem(k));
    console.log(`[Cache] Cleared ${keys.length} cache entries`);
  } catch (error) {
    console.warn('[Cache] Failed to clear cache:', error);
  }
}

/**
 * Clear old/expired cache entries to free up space
 */
export function clearOldCacheEntries(): void {
  try {
    const keys = Object.keys(localStorage).filter(k => k.startsWith(CACHE_PREFIX));
    
    for (const key of keys) {
      try {
        const cached = localStorage.getItem(key);
        if (cached) {
          const entry: CacheEntry = JSON.parse(cached);
          
          // Remove if version doesn't match or expired
          if (entry.version !== CACHE_VERSION || Date.now() - entry.timestamp > MAX_CACHE_AGE) {
            localStorage.removeItem(key);
          }
        }
      } catch {
        // If we can't parse it, remove it
        localStorage.removeItem(key);
      }
    }
  } catch (error) {
    console.warn('[Cache] Failed to clear old cache entries:', error);
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { count: number; totalSize: number } {
  try {
    const keys = Object.keys(localStorage).filter(k =>
      k.startsWith(CACHE_PREFIX) || k.startsWith(PAGE_CACHE_PREFIX)
    );
    let totalSize = 0;
    
    for (const key of keys) {
      const value = localStorage.getItem(key);
      if (value) {
        totalSize += key.length + value.length;
      }
    }
    
    return {
      count: keys.length,
      totalSize: totalSize * 2, // Approximate bytes (UTF-16)
    };
  } catch {
    return { count: 0, totalSize: 0 };
  }
}

// ============================================================================
// PAGE-LEVEL CACHING
// ============================================================================

/**
 * Generate a cache key for a specific page
 */
function getPageCacheKey(filename: string, hash: string, pageNumber: number): string {
  const sanitizedFilename = filename
    .replace(/[^a-zA-Z0-9.-]/g, '_')
    .slice(0, 50);
  return `${PAGE_CACHE_PREFIX}${CACHE_VERSION}-${sanitizedFilename}-${hash}-p${pageNumber}`;
}

/**
 * Get the PDF hash for page-level caching
 * Exported so pageByPageEnhancer can compute it once and reuse
 */
export async function getPDFHash(pdfBytes: Uint8Array): Promise<string> {
  return hashPDFBytes(pdfBytes);
}

/**
 * Retrieve cached enhancement for a specific page
 *
 * @param filename - Original filename of the PDF
 * @param pdfHash - Pre-computed hash of PDF bytes
 * @param pageNumber - Page number (1-indexed)
 * @returns Cached page enhancement or null if not found/expired
 */
export function getCachedPageEnhancement(
  filename: string,
  pdfHash: string,
  pageNumber: number
): PageEnhancementResult | null {
  try {
    const key = getPageCacheKey(filename, pdfHash, pageNumber);
    const cached = localStorage.getItem(key);
    
    if (!cached) {
      return null;
    }
    
    const entry: PageCacheEntry = JSON.parse(cached);
    
    // Check if cache version matches
    if (entry.version !== CACHE_VERSION) {
      localStorage.removeItem(key);
      return null;
    }
    
    // Check if cache has expired
    if (Date.now() - entry.timestamp > MAX_CACHE_AGE) {
      localStorage.removeItem(key);
      return null;
    }
    
    console.log(`[Cache] Using cached enhancement for ${filename} page ${pageNumber}`);
    return entry.result;
  } catch (error) {
    console.warn(`[Cache] Failed to retrieve cached page ${pageNumber}:`, error);
    return null;
  }
}

/**
 * Store page enhancement in cache
 *
 * @param filename - Original filename of the PDF
 * @param pdfHash - Pre-computed hash of PDF bytes
 * @param pageNumber - Page number (1-indexed)
 * @param result - The page enhancement result to cache
 */
export function cachePageEnhancement(
  filename: string,
  pdfHash: string,
  pageNumber: number,
  result: PageEnhancementResult
): void {
  try {
    const key = getPageCacheKey(filename, pdfHash, pageNumber);
    
    const entry: PageCacheEntry = {
      result,
      timestamp: Date.now(),
      version: CACHE_VERSION,
    };
    
    localStorage.setItem(key, JSON.stringify(entry));
    console.log(`[Cache] Cached enhancement for ${filename} page ${pageNumber}`);
  } catch (error) {
    // LocalStorage might be full or disabled
    console.warn(`[Cache] Failed to cache page ${pageNumber}:`, error);
    
    // Try to clear old entries and retry
    try {
      clearOldCacheEntries();
      const key = getPageCacheKey(filename, pdfHash, pageNumber);
      const entry: PageCacheEntry = {
        result,
        timestamp: Date.now(),
        version: CACHE_VERSION,
      };
      localStorage.setItem(key, JSON.stringify(entry));
    } catch {
      // Give up silently - caching is not critical
    }
  }
}

/**
 * Clear all page-level cache entries for a specific PDF
 */
export function clearPageCache(filename: string, pdfHash: string): void {
  try {
    const prefix = `${PAGE_CACHE_PREFIX}${CACHE_VERSION}-${filename.replace(/[^a-zA-Z0-9.-]/g, '_').slice(0, 50)}-${pdfHash}`;
    const keys = Object.keys(localStorage).filter(k => k.startsWith(prefix));
    keys.forEach(k => localStorage.removeItem(k));
    console.log(`[Cache] Cleared ${keys.length} page cache entries for ${filename}`);
  } catch (error) {
    console.warn('[Cache] Failed to clear page cache:', error);
  }
}

/**
 * Check how many pages are already cached for a PDF
 */
export function getCachedPageCount(filename: string, pdfHash: string): number {
  try {
    const sanitizedFilename = filename
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .slice(0, 50);
    const prefix = `${PAGE_CACHE_PREFIX}${CACHE_VERSION}-${sanitizedFilename}-${pdfHash}`;
    const keys = Object.keys(localStorage).filter(k => k.startsWith(prefix));
    return keys.length;
  } catch {
    return 0;
  }
}