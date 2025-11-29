import { motion, AnimatePresence } from 'framer-motion';
import { Phone, X } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { VoiceOrb } from './VoiceOrb';
import { TranscriptDisplay } from './TranscriptDisplay';
import { useUltravox } from '../../ultravox/UltravoxProvider';
import { useFormContext, FIELD_LABELS } from '../../store/FormContext';

export function VoiceAssistantPanel() {
  const { status, transcripts, isConnected, isMicMuted, startCall, endCall, toggleMic } = useUltravox();
  const { state } = useFormContext();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-6 right-6 z-50"
    >
      <AnimatePresence mode="wait">
        {!isConnected ? (
          // Start Call Button
          <motion.button
            key="start-button"
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0.9 }}
            onClick={startCall}
            className="flex items-center gap-3 bg-gov-blue text-white px-6 py-4 rounded-2xl shadow-lg hover:shadow-xl hover:bg-gov-blue/90 transition-all"
          >
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <Phone className="w-5 h-5" />
            </div>
            <div className="text-left">
              <div className="font-semibold">Start Voice Assistant</div>
              <div className="text-xs opacity-80">FormAI will help you fill out the form</div>
            </div>
          </motion.button>
        ) : (
          // Active Call Panel
          <motion.div
            key="call-panel"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
          >
            <GlassCard className="w-96 p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gov-blue">FormAI Assistant</h3>
                <button 
                  onClick={endCall}
                  className="p-1 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              {/* Voice Orb */}
              <div className="flex justify-center mb-6">
                <VoiceOrb 
                  status={status}
                  isMuted={isMicMuted}
                  onToggleMic={toggleMic}
                  onEndCall={endCall}
                />
              </div>

              {/* Current Field Indicator */}
              {state.activeField && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mb-4 p-2 bg-gov-blue/5 rounded-lg text-center"
                >
                  <span className="text-xs text-slate-500">Discussing:</span>
                  <span className="ml-2 text-sm font-medium text-gov-blue">
                    {FIELD_LABELS[state.activeField] || state.activeField}
                  </span>
                </motion.div>
              )}

              {/* Transcript */}
              <div className="border-t border-slate-200 pt-4">
                <TranscriptDisplay transcripts={transcripts} />
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}