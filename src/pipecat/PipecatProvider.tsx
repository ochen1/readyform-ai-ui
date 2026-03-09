import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { PipecatClient } from '@pipecat-ai/client-js';
import type { TranscriptData, BotLLMTextData, FunctionCallParams } from '@pipecat-ai/client-js';
import { SmallWebRTCTransport } from '@pipecat-ai/small-webrtc-transport';
import { useFormContext } from '../store/FormContext';
import { generateSystemPrompt } from './systemPrompt';
import { generateFormTools } from './tools';
import { createToolImplementations } from './toolImplementations';

type SessionStatus = 'disconnected' | 'disconnecting' | 'connecting' | 'idle' | 'listening' | 'thinking' | 'speaking';

interface TranscriptItem {
  text: string;
  isFinal: boolean;
  speaker: 'user' | 'agent';
  medium: 'voice' | 'text';
}

interface PipecatContextValue {
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

const ENDPOINT = import.meta.env.VITE_PIPECAT_URL || 'https://aizuko--voice-agent-serve-frontend.modal.run';

const PipecatContext = createContext<PipecatContextValue | null>(null);

export function PipecatProvider({ children }: { children: React.ReactNode }) {
  const formContext = useFormContext();
  const clientRef = useRef<PipecatClient | null>(null);

  const [status, setStatus] = useState<SessionStatus>('disconnected');
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [isMicMuted, setIsMicMuted] = useState(false);

  // Refs for tracking speaking/thinking state to derive status
  const stateRef = useRef({ botSpeaking: false, userSpeaking: false, llmProcessing: false });
  const loggedTranscriptTextsRef = useRef(new Set<string>());

  const deriveStatus = useCallback((): SessionStatus => {
    const s = stateRef.current;
    if (s.botSpeaking) return 'speaking';
    if (s.llmProcessing) return 'thinking';
    if (s.userSpeaking) return 'listening';
    return 'idle';
  }, []);

  const endCall = useCallback(async () => {
    if (clientRef.current) {
      try {
        await clientRef.current.disconnect();
      } catch (e) {
        console.warn('Error disconnecting Pipecat client:', e);
      }
      clientRef.current = null;
      stateRef.current = { botSpeaking: false, userSpeaking: false, llmProcessing: false };
      loggedTranscriptTextsRef.current.clear();
      setStatus('disconnected');
      setTranscripts([]);
      setIsMicMuted(false);
      formContext.dispatch({ type: 'SET_VOICE_ACTIVE', active: false });
    }
  }, [formContext]);

  const startCall = useCallback(async () => {
    if (clientRef.current) {
      await endCall();
    }

    // Check if a PDF is loaded
    if (!formContext.state.pdfLoaded) {
      console.error('No PDF loaded - cannot start voice call');
      return;
    }

    // Generate dynamic tools and system prompt
    const sectionIds = formContext.state.sections.map(s => s.id);
    const tools = generateFormTools(formContext.state.fields, sectionIds);
    const systemPrompt = generateSystemPrompt(
      formContext.state.metadata,
      formContext.state.fields,
      formContext.state.sections
    );

    setStatus('connecting');

    try {
      // Step 1: Configure the session on the backend
      const configResponse = await fetch(`${ENDPOINT}/configure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_prompt: systemPrompt,
          tools,
          config: { temperature: 0 }
        })
      });

      if (!configResponse.ok) {
        throw new Error(`Failed to configure session: ${configResponse.statusText}`);
      }

      const { session_id: sessionId } = await configResponse.json();

      // Step 2: Create PipecatClient with SmallWebRTCTransport
      const transport = new SmallWebRTCTransport({ waitForICEGathering: true });
      const client = new PipecatClient({
        transport,
        enableMic: true,
        enableCam: false,
        callbacks: {
          onBotStartedSpeaking: () => {
            stateRef.current.botSpeaking = true;
            setStatus(deriveStatus());
          },
          onBotStoppedSpeaking: () => {
            stateRef.current.botSpeaking = false;
            setStatus(deriveStatus());
          },
          onUserStartedSpeaking: () => {
            stateRef.current.userSpeaking = true;
            setStatus(deriveStatus());
          },
          onUserStoppedSpeaking: () => {
            stateRef.current.userSpeaking = false;
            setStatus(deriveStatus());
          },
          onBotLlmStarted: () => {
            stateRef.current.llmProcessing = true;
            setStatus(deriveStatus());
          },
          onBotLlmStopped: () => {
            stateRef.current.llmProcessing = false;
            setStatus(deriveStatus());
          },
          onUserTranscript: (data: TranscriptData) => {
            const item: TranscriptItem = {
              text: data.text,
              isFinal: data.final,
              speaker: 'user',
              medium: 'voice'
            };

            setTranscripts(prev => {
              // Replace the last non-final user transcript or append
              if (!data.final) {
                let lastIdx = -1;
                for (let i = prev.length - 1; i >= 0; i--) {
                  if (prev[i].speaker === 'user' && !prev[i].isFinal) {
                    lastIdx = i;
                    break;
                  }
                }
                if (lastIdx >= 0) {
                  const updated = [...prev];
                  updated[lastIdx] = item;
                  return updated;
                }
              }
              return [...prev, item];
            });

            if (data.final) {
              const key = `user:${data.text}`;
              if (!loggedTranscriptTextsRef.current.has(key)) {
                loggedTranscriptTextsRef.current.add(key);
                console.log(`[Transcript] User: ${data.text}`);
              }
            }
          },
          onBotTranscript: (data: BotLLMTextData) => {
            const item: TranscriptItem = {
              text: data.text,
              isFinal: true,
              speaker: 'agent',
              medium: 'voice'
            };
            setTranscripts(prev => [...prev, item]);

            const key = `agent:${data.text}`;
            if (!loggedTranscriptTextsRef.current.has(key)) {
              loggedTranscriptTextsRef.current.add(key);
              console.log(`[Transcript] Agent: ${data.text}`);
            }
          },
          onConnected: () => {
            setStatus('idle');
          },
          onDisconnected: () => {
            stateRef.current = { botSpeaking: false, userSpeaking: false, llmProcessing: false };
            setStatus('disconnected');
          },
          onError: (message) => {
            console.error('Pipecat error:', message);
          },
        }
      });

      clientRef.current = client;

      // Step 3: Register function call handlers for each tool
      type ToolFn = (args: Record<string, unknown>) => string;
      const toolImpls = createToolImplementations(formContext, endCall) as unknown as Record<string, ToolFn>;
      for (const tool of tools) {
        const name = tool.function.name;
        const impl = toolImpls[name];
        if (impl) {
          client.registerFunctionCallHandler(name, async (data: FunctionCallParams) => {
            return JSON.parse(impl(data.arguments));
          });
        }
      }

      // Step 4: Connect via WebRTC
      await client.connect({
        webrtcUrl: `${ENDPOINT}/offer?session_id=${sessionId}`
      });

      formContext.dispatch({ type: 'SET_VOICE_ACTIVE', active: true });

    } catch (error) {
      console.error('Failed to start call:', error);
      setStatus('disconnected');
    }
  }, [formContext, endCall, deriveStatus]);

  const toggleMic = useCallback(() => {
    if (!clientRef.current) return;

    if (isMicMuted) {
      clientRef.current.enableMic(true);
      setIsMicMuted(false);
    } else {
      clientRef.current.enableMic(false);
      setIsMicMuted(true);
    }
  }, [isMicMuted]);

  const sendText = useCallback((text: string, _deferResponse?: boolean) => {
    if (!clientRef.current) return;
    clientRef.current.sendText(text);
  }, []);

  const notifyFieldFocus = useCallback((fieldName: string) => {
    if (!clientRef.current) return;
    clientRef.current.sendText(
      `[USER CLICKED ON FIELD: ${fieldName}] The user just clicked on the "${fieldName}" field in the form. They may want to discuss or update this field.`
    );
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (clientRef.current) {
        clientRef.current.disconnect();
      }
    };
  }, []);

  const value: PipecatContextValue = {
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
    <PipecatContext.Provider value={value}>
      {children}
    </PipecatContext.Provider>
  );
}

export function usePipecat() {
  const context = useContext(PipecatContext);
  if (!context) {
    throw new Error('usePipecat must be used within a PipecatProvider');
  }
  return context;
}
