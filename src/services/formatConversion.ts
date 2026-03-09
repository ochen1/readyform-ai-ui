import type { SupportedLanguage } from '../store/languageTypes';
import { SUPPORTED_LANGUAGES } from '../store/languageTypes';
import type { FieldType } from '../store/types';

export interface FormatConversionConfig {
  language: SupportedLanguage;
  fieldType: FieldType;
  fieldFormat?: string;
}

// === Date format families ===
// Month/Day/Year (MDY) - primarily US English
const MDY_LANGUAGES = new Set<SupportedLanguage>(['en']);

// Year/Month/Day (YMD) - East Asian, some European
const YMD_LANGUAGES = new Set<SupportedLanguage>(['ja', 'zh', 'fa', 'sv', 'lt', 'hu']);

// All others default to Day/Month/Year (DMY) - most of the world

// === Decimal separator families ===
// Languages that use comma as decimal separator (and dot/space for thousands)
const COMMA_DECIMAL_LANGUAGES = new Set<SupportedLanguage>([
  'fr', 'de', 'it',            // G7
  'bg', 'cs', 'da', 'el', 'es', 'et', 'fi', 'hr', 'hu',
  'lt', 'lv', 'nl', 'pl', 'pt', 'ro', 'sk', 'sl', 'sv',  // EU
  'be', 'gl', 'mk', 'ru', 'sr', 'tr', 'uk', 'vi',        // Other
]);

// All others use dot as decimal separator (and comma for thousands)

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
 * Handles three major date order families:
 * - MDY: MM/DD/YYYY (US English)
 * - YMD: YYYY/MM/DD (Japanese, Chinese, etc.)
 * - DMY: DD/MM/YYYY or DD.MM.YYYY (most of the world)
 */
function normalizeDate(value: string, language: SupportedLanguage): string {
  // Already ISO format
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

  // YYYY/MM/DD pattern (YMD languages like Japanese, Chinese, etc.)
  // Check this FIRST to avoid misinterpreting 2024/01/15 as DD/MM/YYYY
  const ymd = value.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (ymd) {
    const [, year, month, day] = ymd;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // DD/MM/YYYY, DD.MM.YYYY, or MM/DD/YYYY pattern
  const dmy = value.match(/^(\d{1,2})[\/.](\d{1,2})[\/.](\d{4})$/);
  if (dmy) {
    if (MDY_LANGUAGES.has(language)) {
      // English: MM/DD/YYYY
      const [, month, day, year] = dmy;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    } else if (YMD_LANGUAGES.has(language)) {
      // YMD languages with non-standard separator: treat as ambiguous, assume DD/MM/YYYY
      const [, day, month, year] = dmy;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    } else {
      // DMY languages (majority): DD/MM/YYYY or DD.MM.YYYY
      const [, day, month, year] = dmy;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
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
 * Comma-decimal languages: 1.234,56 or 1 234,56 → 1234.56
 * Dot-decimal languages:   1,234.56 → 1234.56
 */
function normalizeNumber(value: string, language: SupportedLanguage): string {
  // Strip currency symbols and whitespace at edges
  let cleaned = value.replace(/[€$£¥₹₩₺₽฿₫₱₴₸₵₦₹]/g, '').trim();

  if (COMMA_DECIMAL_LANGUAGES.has(language)) {
    // European format: remove spaces and dots (thousands), convert comma to dot (decimal)
    cleaned = cleaned
      .replace(/\s/g, '')    // Remove space thousands (French, etc.)
      .replace(/\./g, '')    // Remove dot thousands (German, etc.)
      .replace(',', '.');    // Convert comma decimal to dot
  } else {
    // Dot-decimal format: remove commas (thousands separator)
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
  if (saved && SUPPORTED_LANGUAGES.includes(saved as SupportedLanguage)) {
    return saved as SupportedLanguage;
  }
  return 'en';
}
