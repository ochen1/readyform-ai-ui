import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { UltravoxSession } from 'ultravox-client';
import { useFormContext } from '../store/FormContext';
import { generateSystemPrompt } from './systemPrompt';
import { generateFormTools } from './tools';
import { createToolImplementations } from './toolImplementations';

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
    }
  }, [formContext]);

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

    // Generate dynamic tools based on loaded fields
    const dynamicTools = generateFormTools(formContext.state.fields);

    // Generate system prompt with current form state (including sections)
    const systemPrompt = generateSystemPrompt(
      formContext.state.metadata,
      formContext.state.fields,
      formContext.state.sections
    );

    // Create the call via Ultravox API
    const callConfig = {
      systemPrompt,
      voice: 'Mark',
      temperature: 0.4,
      firstSpeaker: 'FIRST_SPEAKER_AGENT',
      selectedTools: dynamicTools
    };

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

      session.addEventListener('transcripts', () => {
        setTranscripts(session.transcripts.map(t => ({
          text: t.text,
          isFinal: t.isFinal,
          speaker: t.speaker as 'user' | 'agent',
          medium: t.medium as 'voice' | 'text'
        })));
      });

      // Join the call
      session.joinCall(joinUrl);
      formContext.dispatch({ type: 'SET_VOICE_ACTIVE', active: true });

    } catch (error) {
      console.error('Failed to start call:', error);
    }
  }, [formContext, endCall]);

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