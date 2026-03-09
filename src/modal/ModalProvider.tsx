import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { useFormContext } from '../store/FormContext';
import { createToolImplementations } from '../ultravox/toolImplementations';
import { generateSystemPrompt } from '../ultravox/systemPrompt';

type SessionStatus = 'disconnected' | 'connecting' | 'connected';

interface ModalContextValue {
  status: SessionStatus;
  transcripts: never[];
  isConnected: boolean;
  isMicMuted: boolean;
  startCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleMic: () => void;
  sendText: (text: string, deferResponse?: boolean) => void;
  notifyFieldFocus: (fieldName: string) => void;
}

const ModalContext = createContext<ModalContextValue | null>(null);

export function ModalProvider({ children }: { children: React.ReactNode }) {
  const formContext = useFormContext();
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const toolImplsRef = useRef<ReturnType<typeof createToolImplementations> | null>(null);

  const [status, setStatus] = useState<SessionStatus>('disconnected');
  const [isMicMuted, setIsMicMuted] = useState(false);

  const endCall = useCallback(async () => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    dcRef.current = null;
    setStatus('disconnected');
    setIsMicMuted(false);
    formContext.dispatch({ type: 'SET_VOICE_ACTIVE', active: false });
  }, [formContext]);

  // Keep toolImpls ref current so data channel handler always uses latest formContext
  useEffect(() => {
    toolImplsRef.current = createToolImplementations(formContext, endCall);
  }, [formContext, endCall]);

  const sendFormContext = useCallback(() => {
    const dc = dcRef.current;
    if (!dc || dc.readyState !== 'open') return;

    const prompt = generateSystemPrompt(
      formContext.state.metadata,
      formContext.state.fields,
      formContext.state.sections,
    );
    dc.send(JSON.stringify({ type: 'form_context', content: prompt }));
  }, [formContext.state.metadata, formContext.state.fields, formContext.state.sections]);

  const startCall = useCallback(async () => {
    if (pcRef.current) await endCall();

    const botUrl = import.meta.env.VITE_MODAL_BOT_URL;
    if (!botUrl) {
      console.error('VITE_MODAL_BOT_URL not set');
      return;
    }
    if (!formContext.state.pdfLoaded) {
      console.error('No PDF loaded');
      return;
    }

    setStatus('connecting');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      pcRef.current = pc;

      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      // Play bot audio
      pc.ontrack = (event) => {
        const audio = new Audio();
        audio.srcObject = event.streams[0];
        audio.play();
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
          endCall();
        }
      };

      // Listen for data channel from Pipecat transport
      pc.ondatachannel = (event) => {
        const dc = event.channel;
        dcRef.current = dc;

        dc.onopen = () => {
          sendFormContext();
        };

        dc.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.type === 'tool_call') {
              handleToolCall(data);
            }
          } catch {
            // ignore non-JSON messages (e.g. pipecat internal)
          }
        };
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for ICE gathering
      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') return resolve();
        pc.onicecandidate = (e) => { if (!e.candidate) resolve(); };
      });

      const resp = await fetch(`${botUrl}/offer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sdp: pc.localDescription!.sdp,
          type: pc.localDescription!.type,
        }),
      });

      if (!resp.ok) throw new Error(`Offer failed: ${resp.statusText}`);
      const answer = await resp.json();
      await pc.setRemoteDescription(answer);

      setStatus('connected');
      formContext.dispatch({ type: 'SET_VOICE_ACTIVE', active: true });
    } catch (error) {
      console.error('Failed to start call:', error);
      await endCall();
    }
  }, [formContext, endCall, sendFormContext]);

  const handleToolCall = useCallback((data: { id: string; name: string; args: Record<string, string> }) => {
    const impls = toolImplsRef.current;
    if (!impls) return;

    const fn = (impls as Record<string, (args: Record<string, string>) => string | undefined>)[data.name];
    const result = fn ? fn(data.args) : JSON.stringify({ error: `Unknown tool: ${data.name}` });

    const dc = dcRef.current;
    if (dc && dc.readyState === 'open') {
      dc.send(JSON.stringify({ type: 'tool_result', id: data.id, result: JSON.parse(result || '{}') }));
    }
  }, []);

  const toggleMic = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    const track = stream.getAudioTracks()[0];
    if (!track) return;
    track.enabled = isMicMuted;
    setIsMicMuted(!isMicMuted);
  }, [isMicMuted]);

  const sendText = useCallback((_text: string, _deferResponse?: boolean) => {
    // No text channel in raw WebRTC — no-op
  }, []);

  const notifyFieldFocus = useCallback((fieldName: string) => {
    const dc = dcRef.current;
    if (!dc || dc.readyState !== 'open') return;
    dc.send(JSON.stringify({
      type: 'form_context',
      content: `[USER CLICKED ON FIELD: ${fieldName}] The user just clicked on the "${fieldName}" field.`,
    }));
  }, []);

  useEffect(() => {
    return () => { pcRef.current?.close(); streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, []);

  const value: ModalContextValue = {
    status,
    transcripts: [],
    isConnected: status === 'connected',
    isMicMuted,
    startCall,
    endCall,
    toggleMic,
    sendText,
    notifyFieldFocus,
  };

  return <ModalContext.Provider value={value}>{children}</ModalContext.Provider>;
}

export function useModal() {
  const context = useContext(ModalContext);
  if (!context) throw new Error('useModal must be used within a ModalProvider');
  return context;
}
