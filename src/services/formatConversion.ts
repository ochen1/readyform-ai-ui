import type { SupportedLanguage } from '../store/languageTypes';
import type { FieldType } from '../store/types';

export interface FormatConversionConfig {
  language: SupportedLanguage;
  fieldType: FieldType;
  fieldFormat?: string;
}

/**
 * Normalize a value from localized voice input to PDF field format.
 * This is a safety net -- the LLM should already send normalized values,
 * but this catches edge cases where locale-formatted values slip through.
 */
export function normalizeFieldValue(
  value: string,
  config: FormatConversionConfig
): string {
  switch (config.fieldType) {
    case 'date':
      return normalizeDate(value, config.language);
    case 'number':
    case 'weight':
    case 'currency':
    case 'percentage':
      return normalizeNumber(value, config.language);
    default:
      return value;
  }
}

/**
 * Normalize locale-formatted dates to YYYY-MM-DD (ISO 8601).
 *
 * Handles:
 * - French/Italian: DD/MM/YYYY
 * - German: DD.MM.YYYY
 * - Japanese: YYYY/MM/DD
 * - English: MM/DD/YYYY
 * - Already ISO: YYYY-MM-DD (pass through)
 */
function normalizeDate(value: string, language: SupportedLanguage): string {
  // Already ISO format
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  // DD/MM/YYYY or DD.MM.YYYY pattern
  const dmy = value.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})$/);
  if (dmy) {
    if (language === 'en') {
      // English: MM/DD/YYYY
      const [, month, day, year] = dmy;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    } else {
      // French/German/Italian: DD/MM/YYYY or DD.MM.YYYY
      const [, day, month, year] = dmy;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
  }

  // YYYY/MM/DD pattern (Japanese)
  const ymd = value.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (ymd) {
    const [, year, month, day] = ymd;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Fallback: try native Date parsing
  const parsed = new Date(value);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  // Unparseable - return as-is
  return value;
}

/**
 * Normalize locale-formatted numbers to standard format.
 *
 * Handles:
 * - French: 1 234,56 (space thousands, comma decimal)
 * - German: 1.234,56 (dot thousands, comma decimal)
 * - Italian: 1.234,56 (same as German)
 * - English/Japanese: 1,234.56 (comma thousands, dot decimal)
 */
function normalizeNumber(value: string, language: SupportedLanguage): string {
  // Strip currency symbols and whitespace at edges
  let cleaned = value.replace(/[€$£¥₹]/g, '').trim();

  if (['fr', 'de', 'it'].includes(language)) {
    // European format: remove spaces and dots (thousands), convert comma to dot (decimal)
    cleaned = cleaned
      .replace(/\s/g, '')    // Remove space thousands (French)
      .replace(/\./g, '')    // Remove dot thousands (German/Italian)
      .replace(',', '.');    // Convert comma decimal to dot
  } else {
    // English/Japanese: remove commas (thousands separator)
    cleaned = cleaned.replace(/,/g, '');
  }

  return cleaned;
}

/**
 * Get the current language from localStorage.
 * Used by tool implementations that run outside React context.
 */
export function getCurrentLanguage(): SupportedLanguage {
  const saved = localStorage.getItem('preferred-language');
  if (saved && ['en', 'fr', 'de', 'it', 'ja'].includes(saved)) {
    return saved as SupportedLanguage;
  }
  return 'en';
}
