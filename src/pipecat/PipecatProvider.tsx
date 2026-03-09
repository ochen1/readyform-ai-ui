import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
} from "react";
import { PipecatClient } from "@pipecat-ai/client-js";
import type { TransportState } from "@pipecat-ai/client-js";
import { SmallWebRTCTransport } from "@pipecat-ai/small-webrtc-transport";
import { useFormContext } from "../store/FormContext";
import { createToolImplementations } from "../ultravox/toolImplementations";

const PIPECAT_SERVER_URL =
  import.meta.env.VITE_PIPECAT_SERVER_URL ?? "http://localhost:7860";

// Reuse the same status type as UltravoxProvider for compatibility
type SessionStatus =
  | "disconnected"
  | "disconnecting"
  | "connecting"
  | "idle"
  | "listening"
  | "thinking"
  | "speaking";

interface TranscriptItem {
  text: string;
  isFinal: boolean;
  speaker: "user" | "agent";
  medium: "voice" | "text";
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

const PipecatContext = createContext<PipecatContextValue | null>(null);

function deriveStatus(
  transportState: TransportState,
  botSpeaking: boolean,
  userSpeaking: boolean,
  botThinking: boolean,
): SessionStatus {
  switch (transportState) {
    case "disconnected":
    case "error":
      return "disconnected";
    case "disconnecting":
      return "disconnecting";
    case "initializing":
    case "initialized":
    case "authenticating":
    case "authenticated":
    case "connecting":
      return "connecting";
    case "connected":
    case "ready":
      if (botSpeaking) return "speaking";
      if (botThinking) return "thinking";
      if (userSpeaking) return "listening";
      return "idle";
    default:
      return "disconnected";
  }
}

export function PipecatProvider({ children }: { children: React.ReactNode }) {
  const formContext = useFormContext();
  const clientRef = useRef<PipecatClient | null>(null);

  const [status, setStatus] = useState<SessionStatus>("disconnected");
  const [transcripts, setTranscripts] = useState<TranscriptItem[]>([]);
  const [isMicMuted, setIsMicMuted] = useState(false);

  // Mutable refs for bot/user speaking state (avoid re-renders on every event)
  const transportStateRef = useRef<TransportState>("disconnected");
  const botSpeakingRef = useRef(false);
  const userSpeakingRef = useRef(false);
  const botThinkingRef = useRef(false);

  const updateStatus = useCallback(() => {
    setStatus(
      deriveStatus(
        transportStateRef.current,
        botSpeakingRef.current,
        userSpeakingRef.current,
        botThinkingRef.current,
      ),
    );
  }, []);

  const endCall = useCallback(async () => {
    const client = clientRef.current;
    if (client) {
      await client.disconnect();
      clientRef.current = null;
      setStatus("disconnected");
      setTranscripts([]);
      setIsMicMuted(false);
      formContext.dispatch({ type: "SET_VOICE_ACTIVE", active: false });
    }
  }, [formContext]);

  const startCall = useCallback(async () => {
    if (clientRef.current) {
      await endCall();
    }

    if (!formContext.state.pdfLoaded) {
      console.error("No PDF loaded - cannot start voice call");
      return;
    }

    try {
      const transport = new SmallWebRTCTransport({
        waitForICEGathering: true,
      });

      const client = new PipecatClient({
        transport,
        enableMic: true,
        enableCam: false,
      });

      // Register tool implementations for function call forwarding
      const toolImpls = createToolImplementations(formContext, endCall);
      for (const [name, impl] of Object.entries(toolImpls)) {
        client.registerFunctionCallHandler(
          name,
          async (fn: { functionName: string; arguments: Record<string, unknown> }) => {
            const result = (impl as (args: Record<string, unknown>) => string)(
              fn.arguments,
            );
            return result;
          },
        );
      }

      // Track transcript texts for dedup logging
      const loggedTranscriptTexts = new Set<string>();

      // --- Event listeners ---
      client.on("transportStateChanged", (state: TransportState) => {
        transportStateRef.current = state;
        updateStatus();
      });

      client.on("botStartedSpeaking", () => {
        botSpeakingRef.current = true;
        botThinkingRef.current = false;
        updateStatus();
      });

      client.on("botStoppedSpeaking", () => {
        botSpeakingRef.current = false;
        updateStatus();
      });

      client.on("userStartedSpeaking", () => {
        userSpeakingRef.current = true;
        updateStatus();
      });

      client.on("userStoppedSpeaking", () => {
        userSpeakingRef.current = false;
        updateStatus();
      });

      client.on("botLlmStarted", () => {
        botThinkingRef.current = true;
        updateStatus();
      });

      client.on("botLlmStopped", () => {
        botThinkingRef.current = false;
        updateStatus();
      });

      client.on("userTranscript", (data: { text: string; final: boolean }) => {
        if (!data.text) return;
        setTranscripts((prev) => {
          const item: TranscriptItem = {
            text: data.text,
            isFinal: data.final,
            speaker: "user",
            medium: "voice",
          };
          if (data.final) {
            const key = `user:${data.text}`;
            if (!loggedTranscriptTexts.has(key)) {
              loggedTranscriptTexts.add(key);
              console.log(`[Transcript] User: ${data.text}`);
            }
          }
          return [...prev, item];
        });
      });

      client.on("botTranscript", (data: { text: string }) => {
        if (!data.text) return;
        setTranscripts((prev) => {
          const key = `agent:${data.text}`;
          if (!loggedTranscriptTexts.has(key)) {
            loggedTranscriptTexts.add(key);
            console.log(`[Transcript] Agent: ${data.text}`);
          }
          return [
            ...prev,
            {
              text: data.text,
              isFinal: true,
              speaker: "agent" as const,
              medium: "voice" as const,
            },
          ];
        });
      });

      // Connect directly to /offer
      clientRef.current = client;
      await client.connect({
        webrtcRequestParams: {
          baseUrl: PIPECAT_SERVER_URL,
          endpoint: "/offer",
        },
      });

      formContext.dispatch({ type: "SET_VOICE_ACTIVE", active: true });
    } catch (error) {
      console.error("Failed to start call:", error);
      clientRef.current = null;
      setStatus("disconnected");
    }
  }, [formContext, endCall, updateStatus]);

  const toggleMic = useCallback(() => {
    const client = clientRef.current;
    if (!client) return;

    if (isMicMuted) {
      client.enableMic(true);
      setIsMicMuted(false);
    } else {
      client.enableMic(false);
      setIsMicMuted(true);
    }
  }, [isMicMuted]);

  const sendText = useCallback((text: string, _deferResponse?: boolean) => {
    const client = clientRef.current;
    if (!client) return;
    if (transportStateRef.current !== "ready" && transportStateRef.current !== "connected") return;
    client.sendText(text);
  }, []);

  const notifyFieldFocus = useCallback(
    (fieldName: string) => {
      const client = clientRef.current;
      if (!client) return;
      if (transportStateRef.current !== "ready" && transportStateRef.current !== "connected") return;
      client.sendText(
        `[USER CLICKED ON FIELD: ${fieldName}] The user just clicked on the "${fieldName}" field in the form. They may want to discuss or update this field.`,
      );
    },
    [],
  );

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
    isConnected: status !== "disconnected" && status !== "disconnecting",
    isMicMuted,
    startCall,
    endCall,
    toggleMic,
    sendText,
    notifyFieldFocus,
  };

  return (
    <PipecatContext.Provider value={value}>{children}</PipecatContext.Provider>
  );
}

export function usePipecat() {
  const context = useContext(PipecatContext);
  if (!context) {
    throw new Error("usePipecat must be used within a PipecatProvider");
  }
  return context;
}
