/**
 * Supported languages for ReadyFormAI
 * Organized into G7, EU, and other (Ultravox extended) groups
 */
export type SupportedLanguage =
  // G7 Languages
  | 'en' | 'fr' | 'de' | 'it' | 'ja'
  // EU Official Languages (not in G7)
  | 'bg' | 'cs' | 'da' | 'el' | 'es' | 'et' | 'fi' | 'ga' | 'hr'
  | 'hu' | 'lt' | 'lv' | 'mt' | 'nl' | 'pl' | 'pt' | 'ro' | 'sk'
  | 'sl' | 'sv'
  // Other Languages (Ultravox extended, not G7 or EU)
  | 'ar' | 'be' | 'bn' | 'cy' | 'fa' | 'gl' | 'hi' | 'ka' | 'mk'
  | 'mr' | 'ru' | 'sr' | 'sw' | 'ta' | 'th' | 'tr' | 'uk' | 'ur'
  | 'vi' | 'zh';

/** G7 languages (shown first in dropdown) */
export const G7_LANGUAGES: SupportedLanguage[] = ['en', 'fr', 'de', 'it', 'ja'];

/** EU official languages not already in G7 */
export const EU_LANGUAGES: SupportedLanguage[] = [
  'bg', 'cs', 'da', 'el', 'es', 'et', 'fi', 'ga', 'hr', 'hu',
  'lt', 'lv', 'mt', 'nl', 'pl', 'pt', 'ro', 'sk', 'sl', 'sv',
];

/** Other languages from Ultravox extended set */
export const OTHER_LANGUAGES: SupportedLanguage[] = [
  'ar', 'be', 'bn', 'cy', 'fa', 'gl', 'hi', 'ka', 'mk', 'mr',
  'ru', 'sr', 'sw', 'ta', 'th', 'tr', 'uk', 'ur', 'vi', 'zh',
];

/** All supported languages (G7 first, then EU, then other) */
export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  ...G7_LANGUAGES,
  ...EU_LANGUAGES,
  ...OTHER_LANGUAGES,
];

/**
 * Language state for the application
 */
export interface LanguageState {
  /** Current active language (defaults to 'en') */
  currentLanguage: SupportedLanguage;
  /** Whether language has been locked by voice detection */
  isLocked: boolean;
  /** Whether detection is pending (call started, user hasn't spoken yet) */
  isDetecting: boolean;
}
