import { motion } from 'framer-motion';
import { Mic, MicOff, Phone, PhoneOff } from 'lucide-react';
import { cn } from '../../lib/utils';

type SessionStatus = 'disconnected' | 'disconnecting' | 'connecting' | 'idle' | 'listening' | 'thinking' | 'speaking';

interface VoiceOrbProps {
  status: SessionStatus;
  isMuted: boolean;
  onToggleMic: () => void;
  onEndCall: () => void;
}

const statusColors: Record<SessionStatus, string> = {
  disconnected: 'bg-slate-400',
  disconnecting: 'bg-slate-400',
  connecting: 'bg-yellow-500',
  idle: 'bg-emerald-500',
  listening: 'bg-gov-blue',
  thinking: 'bg-purple-500',
  speaking: 'bg-emerald-500'
};

const statusLabels: Record<SessionStatus, string> = {
  disconnected: 'Disconnected',
  disconnecting: 'Ending call...',
  connecting: 'Connecting...',
  idle: 'Ready',
  listening: 'Listening...',
  thinking: 'Thinking...',
  speaking: 'Speaking...'
};

export function VoiceOrb({ status, isMuted, onToggleMic, onEndCall }: VoiceOrbProps) {
  const isActive = status !== 'disconnected' && status !== 'disconnecting';
  const isPulsing = status === 'listening' || status === 'speaking';

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Main Orb */}
      <div className="relative">
        {/* Pulse rings */}
        {isPulsing && (
          <>
            <motion.div
              className={cn('absolute inset-0 rounded-full', statusColors[status])}
              animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <motion.div
              className={cn('absolute inset-0 rounded-full', statusColors[status])}
              animate={{ scale: [1, 1.3], opacity: [0.3, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 0.5 }}
            />
          </>
        )}
        
        {/* Core orb */}
        <motion.div
          className={cn(
            'relative w-20 h-20 rounded-full flex items-center justify-center shadow-lg',
            statusColors[status]
          )}
          animate={isPulsing ? { scale: [1, 1.05, 1] } : {}}
          transition={{ duration: 0.5, repeat: isPulsing ? Infinity : 0 }}
        >
          {status === 'speaking' && (
            <motion.div
              className="absolute inset-2 rounded-full bg-white/20"
              animate={{ scale: [0.8, 1.1, 0.8] }}
              transition={{ duration: 0.3, repeat: Infinity }}
            />
          )}
          <Phone className="w-8 h-8 text-white" />
        </motion.div>
      </div>

      {/* Status label */}
      <span className="text-sm font-medium text-slate-600">
        {statusLabels[status]}
      </span>

      {/* Control buttons */}
      {isActive && (
        <div className="flex gap-3">
          <button
            onClick={onToggleMic}
            className={cn(
              'p-3 rounded-full transition-colors',
              isMuted 
                ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            )}
          >
            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>
          
          <button
            onClick={onEndCall}
            className="p-3 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
          >
            <PhoneOff className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}