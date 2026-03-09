/**
 * Supported G7 languages
 */
export type SupportedLanguage = 'en' | 'fr' | 'de' | 'it' | 'ja';

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = ['en', 'fr', 'de', 'it', 'ja'];

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
