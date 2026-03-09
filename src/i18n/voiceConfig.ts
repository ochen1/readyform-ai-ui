import type { SupportedLanguage } from '../store/languageTypes';

export interface VoiceLanguageConfig {
  /** BCP47 language code for Ultravox languageHint */
  bcp47: string;
  /** Greeting in this language */
  greeting: string;
  /** Language name in its own language */
  nativeName: string;
  /** Language name in English */
  englishName: string;
  /** Common date format in this locale */
  dateFormat: string;
  /** Intl locale string */
  intlLocale: string;
}

export const VOICE_CONFIGS: Record<SupportedLanguage, VoiceLanguageConfig> = {
  en: {
    bcp47: 'en',
    greeting: 'Hello! Let me help you fill out your form.',
    nativeName: 'English',
    englishName: 'English',
    dateFormat: 'MM/DD/YYYY',
    intlLocale: 'en-US',
  },
  fr: {
    bcp47: 'fr',
    greeting: 'Bonjour\u00a0! Je vous aide à remplir votre formulaire.',
    nativeName: 'Français',
    englishName: 'French',
    dateFormat: 'DD/MM/YYYY',
    intlLocale: 'fr-FR',
  },
  de: {
    bcp47: 'de',
    greeting: 'Hallo! Ich helfe Ihnen beim Ausfüllen Ihres Formulars.',
    nativeName: 'Deutsch',
    englishName: 'German',
    dateFormat: 'DD.MM.YYYY',
    intlLocale: 'de-DE',
  },
  it: {
    bcp47: 'it',
    greeting: 'Ciao! Vi aiuto a compilare il vostro modulo.',
    nativeName: 'Italiano',
    englishName: 'Italian',
    dateFormat: 'DD/MM/YYYY',
    intlLocale: 'it-IT',
  },
  ja: {
    bcp47: 'ja',
    greeting: 'こんにちは！フォームの記入をお手伝いします。',
    nativeName: '日本語',
    englishName: 'Japanese',
    dateFormat: 'YYYY/MM/DD',
    intlLocale: 'ja-JP',
  },
};

/**
 * Build the ElevenLabs external voice configuration for Ultravox API.
 * Uses the multilingual v2 model for all languages.
 */
export function buildElevenLabsVoiceConfig(apiKey: string) {
  return {
    elevenLabs: {
      voiceId: 'pNInz6obpgDQGcFmaJgB',  // "Adam" - multilingual voice
      model: 'eleven_multilingual_v2',
      apiKey,
    },
  };
}

/**
 * Build the multilingual greeting that cycles through all G7 languages.
 */
export function buildMultilingualGreeting(): string {
  return [
    'Hello! Welcome to ReadyFormAI.',
    'Bonjour\u00a0! Bienvenue sur ReadyFormAI.',
    'Hallo! Willkommen bei ReadyFormAI.',
    'Ciao! Benvenuto su ReadyFormAI.',
    'こんにちは！ReadyFormAIへようこそ。',
    '',
    'Please respond in your preferred language.',
  ].join('\n');
}
