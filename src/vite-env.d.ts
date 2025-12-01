/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ULTRAVOX_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Custom events for Ultravox voice tools
declare global {
  interface WindowEventMap {
    'form:navigate': CustomEvent<{ section: string }>;
    'form:showHelp': CustomEvent<{ topic: string; helpText: string }>;
    'form:showTooltip': CustomEvent<{ fieldId: string; fieldName: string; content: string; duration: number }>;
  }
}

export {};