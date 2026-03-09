import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { SupportedLanguage, LanguageState } from './languageTypes';
import { SUPPORTED_LANGUAGES } from './languageTypes';
import i18n from '../i18n';

export interface LanguageContextValue {
  language: LanguageState;
  /** Set language manually (from UI dropdown) */
  setLanguage: (lang: SupportedLanguage) => void;
  /** Reset detection state (called when voice call ends) */
  resetLanguage: () => void;
  /** Called by setLanguage voice tool when agent detects user language */
  onLanguageDetected: (lang: SupportedLanguage) => void;
  /** Mark that language detection is in progress */
  startDetecting: () => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

function getInitialLanguage(): SupportedLanguage {
  const saved = localStorage.getItem('preferred-language');
  if (saved && SUPPORTED_LANGUAGES.includes(saved as SupportedLanguage)) {
    return saved as SupportedLanguage;
  }
  return 'en';
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<LanguageState>({
    currentLanguage: getInitialLanguage(),
    isLocked: false,
    isDetecting: false,
  });

  const setLanguage = useCallback((lang: SupportedLanguage) => {
    setLanguageState(prev => ({
      ...prev,
      currentLanguage: lang,
    }));
    i18n.changeLanguage(lang);
    localStorage.setItem('preferred-language', lang);
  }, []);

  const onLanguageDetected = useCallback((lang: SupportedLanguage) => {
    setLanguageState(prev => ({
      ...prev,
      currentLanguage: lang,
      isLocked: true,
      isDetecting: false,
    }));
    i18n.changeLanguage(lang);
    localStorage.setItem('preferred-language', lang);
  }, []);

  const resetLanguage = useCallback(() => {
    setLanguageState(prev => ({
      ...prev,
      isLocked: false,
      isDetecting: false,
    }));
  }, []);

  const startDetecting = useCallback(() => {
    setLanguageState(prev => ({
      ...prev,
      isDetecting: true,
      isLocked: false,
    }));
  }, []);

  // Listen for language:detected events from voice tool implementations
  useEffect(() => {
    const handleLanguageDetected = (event: Event) => {
      const customEvent = event as CustomEvent<{ languageCode: string }>;
      const { languageCode } = customEvent.detail;
      if (SUPPORTED_LANGUAGES.includes(languageCode as SupportedLanguage)) {
        onLanguageDetected(languageCode as SupportedLanguage);
      }
    };

    window.addEventListener('language:detected', handleLanguageDetected);
    return () => {
      window.removeEventListener('language:detected', handleLanguageDetected);
    };
  }, [onLanguageDetected]);

  const value: LanguageContextValue = {
    language,
    setLanguage,
    resetLanguage,
    onLanguageDetected,
    startDetecting,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguageContext() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguageContext must be used within a LanguageProvider');
  }
  return context;
}
