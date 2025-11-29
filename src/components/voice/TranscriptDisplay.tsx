import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../lib/utils';

interface TranscriptItem {
  text: string;
  isFinal: boolean;
  speaker: 'user' | 'agent';
  medium: 'voice' | 'text';
}

interface TranscriptDisplayProps {
  transcripts: TranscriptItem[];
  maxHeight?: string;
}

export function TranscriptDisplay({ transcripts, maxHeight = '200px' }: TranscriptDisplayProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcripts]);

  if (transcripts.length === 0) {
    return (
      <div className="text-center text-slate-400 text-sm py-4">
        Conversation will appear here...
      </div>
    );
  }

  return (
    <div 
      ref={scrollRef}
      className="overflow-y-auto space-y-2 pr-2"
      style={{ maxHeight }}
    >
      <AnimatePresence initial={false}>
        {transcripts.map((transcript, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              'p-3 rounded-lg text-sm',
              transcript.speaker === 'agent'
                ? 'bg-gov-blue/10 text-slate-700 mr-8'
                : 'bg-slate-100 text-slate-700 ml-8'
            )}
          >
            <span className="font-medium text-xs text-slate-500 block mb-1">
              {transcript.speaker === 'agent' ? 'FormAI' : 'You'}
            </span>
            <span className={cn(!transcript.isFinal && 'opacity-60')}>
              {transcript.text}
            </span>
            {!transcript.isFinal && (
              <span className="inline-block ml-1 w-1 h-3 bg-gov-blue/50 animate-pulse" />
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}