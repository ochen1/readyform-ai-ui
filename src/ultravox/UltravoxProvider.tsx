import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { UltravoxSession } from 'ultravox-client';
import { useFormContext } from '../store/FormContext';
import { useLanguageContext } from '../store/LanguageContext';
import { generateSystemPrompt } from './systemPrompt';
import { generateFormTools } from './tools';
import { createToolImplementations } from './toolImplementations';
import { VOICE_CONFIGS, buildElevenLabsVoiceConfig } from '../i18n/voiceConfig';

// Define our own status type that matches the SDK's possible values
type SessionStatus = 'disconnected' | 'disconnecting' | 'connecting' | 'idle' | 'listening' | 'thinking' | 'speaking';

interface TranscriptItem {
  text: string;
  isFinal: boolean;
  speaker: 'user' | 'agent';
  medium: 'voice' | 'text';
}

interface UltravoxContextValue {
  status: SessionStatus;
  transcripts: TranscriptItem[];
  isConnected: boolean;
  isMicMuted: boolean;
  startCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleMic: () => void;
  sendText: (text: string, deferResponse?: boolean) => void;
  notifyFieldFocus: (fieldName: string) => void;
}

const UltravoxContext = createContext<UltravoxContextValue | null>(null);

export function UltravoxProvider({ children }: { children: React.ReactNode }) {
  const formContext = useFormContext();
  const { language, startDetecting, resetLanguage } = useLanguageContext();
  const sessionRef = useRef<UltravoxSession | null>(null);

  const [status, setStatus] = useState<SessionStatus>('disconnected');
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [isMicMuted, setIsMicMuted] = useState(false);

  const endCall = useCallback(async () => {
    if (sessionRef.current) {
      await sessionRef.current.leaveCall();
      sessionRef.current = null;
      setStatus('disconnected');
      setTranscripts([]);
      formContext.dispatch({ type: 'SET_VOICE_ACTIVE', active: false });
      // Reset detection state but keep the current language for UI
      resetLanguage();
    }
  }, [formContext, resetLanguage]);

  const startCall = useCallback(async () => {
    if (sessionRef.current) {
      await endCall();
    }

    const apiKey = import.meta.env.VITE_ULTRAVOX_API_KEY;
    if (!apiKey) {
      console.error('VITE_ULTRAVOX_API_KEY not set');
      return;
    }

    // Check if a PDF is loaded
    if (!formContext.state.pdfLoaded) {
      console.error('No PDF loaded - cannot start voice call');
      return;
    }

    // Mark that we're starting language detection
    startDetecting();

    // Generate dynamic tools based on loaded fields and sections
    const sectionIds = formContext.state.sections.map(s => s.id);
    const dynamicTools = generateFormTools(formContext.state.fields, sectionIds);

    // Determine current language state for prompt generation
    // If language is locked from a previous call, use it; otherwise pass null for multilingual greeting
    const currentLang = language.isLocked ? language.currentLanguage : null;

    // Generate system prompt with current form state and language context
    const systemPrompt = generateSystemPrompt(
      formContext.state.metadata,
      formContext.state.fields,
      formContext.state.sections,
      currentLang
    );

    // Build call configuration with multilingual voice support
    const callConfig: Record<string, unknown> = {
      systemPrompt,
      temperature: 0,
      firstSpeaker: 'FIRST_SPEAKER_AGENT',
      selectedTools: dynamicTools,
    };

    // Configure ElevenLabs multilingual voice if API key is available
    const elevenLabsKey = import.meta.env.VITE_ELEVENLABS_API_KEY;
    if (elevenLabsKey) {
      callConfig.externalVoice = buildElevenLabsVoiceConfig(elevenLabsKey);
    } else {
      // Fallback to Ultravox built-in voice
      callConfig.voice = 'Mark';
    }

    // Set language hint if language is already known
    if (language.currentLanguage && language.isLocked) {
      callConfig.languageHint = VOICE_CONFIGS[language.currentLanguage].bcp47;
    }

    try {
      const response = await fetch('https://api.ultravox.ai/api/calls', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Unsafe-API-Key': apiKey
        },
        body: JSON.stringify(callConfig)
      });

      if (!response.ok) {
        throw new Error(`Failed to create call: ${response.statusText}`);
      }

      const { joinUrl } = await response.json();

      // Create and configure session
      const session = new UltravoxSession({ experimentalMessages: new Set(['debug']) });
      sessionRef.current = session;

      // Register tool implementations
      const toolImpls = createToolImplementations(formContext, endCall);
      // Cast to expected type since our implementations follow the same pattern
      session.registerToolImplementations(toolImpls as unknown as { [name: string]: (params: { [key: string]: unknown }) => string | Promise<string> });

      // Set up event listeners
      session.addEventListener('status', () => {
        setStatus(session.status as SessionStatus);
      });

      // Track logged transcripts to avoid duplicates
      const loggedTranscriptTexts = new Set<string>();

      session.addEventListener('transcripts', () => {
        const newTranscripts = session.transcripts.map(t => ({
          text: t.text,
          isFinal: t.isFinal,
          speaker: t.speaker as 'user' | 'agent',
          medium: t.medium as 'voice' | 'text'
        }));

        setTranscripts(newTranscripts);

        // Log ALL final transcripts to console for debugging
        // Use a Set to track what we've already logged to avoid duplicates
        for (const transcript of newTranscripts) {
          if (transcript.isFinal) {
            // Create a unique key for this transcript
            const key = `${transcript.speaker}:${transcript.text}`;
            if (!loggedTranscriptTexts.has(key)) {
              loggedTranscriptTexts.add(key);
              const prefix = transcript.speaker === 'user' ? '🎤 User' : '🤖 Agent';
              console.log(`[Transcript] ${prefix}: ${transcript.text}`);
            }
          }
        }
      });

      // Join the call
      session.joinCall(joinUrl);
      formContext.dispatch({ type: 'SET_VOICE_ACTIVE', active: true });

    } catch (error) {
      console.error('Failed to start call:', error);
    }
  }, [formContext, endCall, language, startDetecting]);

  const toggleMic = useCallback(() => {
    if (!sessionRef.current) return;

    if (isMicMuted) {
      sessionRef.current.unmuteMic();
      setIsMicMuted(false);
    } else {
      sessionRef.current.muteMic();
      setIsMicMuted(true);
    }
  }, [isMicMuted]);

  const sendText = useCallback((text: string, deferResponse?: boolean) => {
    if (!sessionRef.current) return;
    sessionRef.current.sendText(text, deferResponse);
  }, []);

  const notifyFieldFocus = useCallback((fieldName: string) => {
    if (!sessionRef.current) return;
    // Send as message so the agent knows the user clicked on a field
    sessionRef.current.sendText(
      `[USER CLICKED ON FIELD: ${fieldName}] The user just clicked on the "${fieldName}" field in the form. They may want to discuss or update this field.`,
      false // Don't defer - let the agent acknowledge and guide the user
    );
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sessionRef.current) {
        sessionRef.current.leaveCall();
      }
    };
  }, []);

  const value: UltravoxContextValue = {
    status,
    transcripts,
    isConnected: status !== 'disconnected' && status !== 'disconnecting',
    isMicMuted,
    startCall,
    endCall,
    toggleMic,
    sendText,
    notifyFieldFocus
  };

  return (
    <UltravoxContext.Provider value={value}>
      {children}
    </UltravoxContext.Provider>
  );
}

export function useUltravox() {
  const context = useContext(UltravoxContext);
  if (!context) {
    throw new Error('useUltravox must be used within an UltravoxProvider');
  }
  return context;
}
