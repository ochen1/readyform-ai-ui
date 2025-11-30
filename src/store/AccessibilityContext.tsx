import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface AccessibilitySettings {
  dyslexiaFont: boolean;
  highContrast: boolean;
  reducedMotion: boolean;
  fontSizeScale: number;
}

interface AccessibilityContextValue {
  settings: AccessibilitySettings;
  toggleDyslexiaFont: () => void;
  toggleHighContrast: () => void;
  toggleReducedMotion: () => void;
  increaseFontSize: () => void;
  decreaseFontSize: () => void;
  updateSetting: (key: keyof AccessibilitySettings, value: boolean | number) => void;
}

const defaultSettings: AccessibilitySettings = {
  dyslexiaFont: false,
  highContrast: false,
  reducedMotion: false,
  fontSizeScale: 1.0,
};

const AccessibilityContext = createContext<AccessibilityContextValue | null>(null);

const STORAGE_KEY = 'accessibility-settings';

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AccessibilitySettings>(() => {
    // Load from localStorage on initial render
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return { ...defaultSettings, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Failed to load accessibility settings:', e);
    }
    return defaultSettings;
  });

  // Persist settings to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn('Failed to save accessibility settings:', e);
    }
  }, [settings]);

  // Apply dyslexia font class to document body
  useEffect(() => {
    if (settings.dyslexiaFont) {
      document.body.classList.add('dyslexia-font');
    } else {
      document.body.classList.remove('dyslexia-font');
    }
  }, [settings.dyslexiaFont]);

  // Apply high contrast mode
  useEffect(() => {
    if (settings.highContrast) {
      document.body.classList.add('high-contrast');
    } else {
      document.body.classList.remove('high-contrast');
    }
  }, [settings.highContrast]);

  // Apply reduced motion preference
  useEffect(() => {
    if (settings.reducedMotion) {
      document.body.classList.add('reduced-motion');
    } else {
      document.body.classList.remove('reduced-motion');
    }
  }, [settings.reducedMotion]);

  // Apply font size scale
  useEffect(() => {
    document.documentElement.style.setProperty('--font-scale', settings.fontSizeScale.toString());
  }, [settings.fontSizeScale]);

  const updateSetting = useCallback((key: keyof AccessibilitySettings, value: boolean | number) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const toggleDyslexiaFont = useCallback(() => {
    setSettings(prev => ({ ...prev, dyslexiaFont: !prev.dyslexiaFont }));
  }, []);

  const toggleHighContrast = useCallback(() => {
    setSettings(prev => ({ ...prev, highContrast: !prev.highContrast }));
  }, []);

  const toggleReducedMotion = useCallback(() => {
    setSettings(prev => ({ ...prev, reducedMotion: !prev.reducedMotion }));
  }, []);

  const increaseFontSize = useCallback(() => {
    setSettings(prev => ({ ...prev, fontSizeScale: Math.min(prev.fontSizeScale + 0.1, 2.0) }));
  }, []);

  const decreaseFontSize = useCallback(() => {
    setSettings(prev => ({ ...prev, fontSizeScale: Math.max(prev.fontSizeScale - 0.1, 0.5) }));
  }, []);

  const value: AccessibilityContextValue = {
    settings,
    toggleDyslexiaFont,
    toggleHighContrast,
    toggleReducedMotion,
    increaseFontSize,
    decreaseFontSize,
    updateSetting,
  };

  return (
    <AccessibilityContext.Provider value={value}>
      {children}
    </AccessibilityContext.Provider>
  );
}

export function useAccessibility() {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within an AccessibilityProvider');
  }
  return context;
}