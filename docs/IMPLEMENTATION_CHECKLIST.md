# Implementation Checklist for Coding Agents

This document provides step-by-step implementation instructions for integrating Ultravox voice AI into the Agentic Form Filler application. Follow each phase in order.

---

## Prerequisites

Before starting, ensure you have:
- [ ] Ultravox API key (from https://app.ultravox.ai)
- [ ] Node.js 18+ installed
- [ ] pnpm package manager

---

## Phase 1: Dependencies & Environment

### Task 1.1: Install Ultravox SDK

```bash
pnpm add ultravox-client
```

### Task 1.2: Create Environment Configuration

Create `.env.example`:
```env
# Ultravox API Configuration
VITE_ULTRAVOX_API_KEY=your-api-key-here
```

Create `.env` (copy from example, add your key):
```env
VITE_ULTRAVOX_API_KEY=aBCDef.123456
```

Add to `.gitignore`:
```
.env
.env.local
```

---

## Phase 2: State Management

### Task 2.1: Create Form State Types

Create `src/store/types.ts`:

```typescript
export interface GrainReceiptFormData {
  receiptNumber: string;
  licensee: string;
  producer: string;
  date: string;
  grossWeight: number;
  vehicleWeight: number;
  grainType: string;
  dockage: number;
  pricePerTonne: number;
}

export interface FormState {
  data: GrainReceiptFormData;
  activeField: string | null;
  lastUpdatedField: string | null;
  lastUpdateTimestamp: number;
  completedFields: string[];
  validationErrors: Record<string, string>;
  isVoiceActive: boolean;
}

export type FormAction =
  | { type: 'SET_FIELD'; field: keyof GrainReceiptFormData; value: string | number }
  | { type: 'SET_ACTIVE_FIELD'; field: string | null }
  | { type: 'MARK_FIELD_COMPLETE'; field: string }
  | { type: 'SET_VALIDATION_ERROR'; field: string; error: string }
  | { type: 'CLEAR_VALIDATION_ERROR'; field: string }
  | { type: 'SET_VOICE_ACTIVE'; active: boolean }
  | { type: 'RESET_FORM' };

export const EDITABLE_FIELDS = [
  'producer',
  'date', 
  'grossWeight',
  'vehicleWeight',
  'grainType',
  'dockage',
  'pricePerTonne'
] as const;

export const FIELD_LABELS: Record<string, string> = {
  receiptNumber: 'Receipt Number',
  licensee: 'Licensee',
  producer: 'Producer Name',
  date: 'Delivery Date',
  grossWeight: 'Gross Weight (kg)',
  vehicleWeight: 'Vehicle Tare Weight (kg)',
  grainType: 'Grain Type',
  dockage: 'Dockage (%)',
  pricePerTonne: 'Price per Tonne ($)'
};
```

### Task 2.2: Create Form Reducer

Create `src/store/formReducer.ts`:

```typescript
import { FormState, FormAction, GrainReceiptFormData } from './types';

export const initialFormData: GrainReceiptFormData = {
  receiptNumber: 'GR-2024-8842',
  licensee: 'Prairie Grain Co-op',
  producer: 'Oliver Smith',
  date: '2024-11-20',
  grossWeight: 42500,
  vehicleWeight: 18200,
  grainType: 'CWRS Wheat',
  dockage: 2.5,
  pricePerTonne: 385.50,
};

export const initialFormState: FormState = {
  data: initialFormData,
  activeField: null,
  lastUpdatedField: null,
  lastUpdateTimestamp: 0,
  completedFields: [],
  validationErrors: {},
  isVoiceActive: false,
};

export function formReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'SET_FIELD':
      return {
        ...state,
        data: {
          ...state.data,
          [action.field]: action.value,
        },
        lastUpdatedField: action.field,
        lastUpdateTimestamp: Date.now(),
      };

    case 'SET_ACTIVE_FIELD':
      return {
        ...state,
        activeField: action.field,
      };

    case 'MARK_FIELD_COMPLETE':
      if (state.completedFields.includes(action.field)) {
        return state;
      }
      return {
        ...state,
        completedFields: [...state.completedFields, action.field],
      };

    case 'SET_VALIDATION_ERROR':
      return {
        ...state,
        validationErrors: {
          ...state.validationErrors,
          [action.field]: action.error,
        },
      };

    case 'CLEAR_VALIDATION_ERROR':
      const { [action.field]: _, ...remainingErrors } = state.validationErrors;
      return {
        ...state,
        validationErrors: remainingErrors,
      };

    case 'SET_VOICE_ACTIVE':
      return {
        ...state,
        isVoiceActive: action.active,
      };

    case 'RESET_FORM':
      return initialFormState;

    default:
      return state;
  }
}
```

### Task 2.3: Create Form Context

Create `src/store/FormContext.tsx`:

```typescript
import React, { createContext, useContext, useReducer, useCallback, useMemo } from 'react';
import { FormState, FormAction, GrainReceiptFormData, EDITABLE_FIELDS, FIELD_LABELS } from './types';
import { formReducer, initialFormState } from './formReducer';

interface FormContextValue {
  state: FormState;
  dispatch: React.Dispatch<FormAction>;
  
  // Convenience methods for voice tools
  setField: (field: string, value: string | number) => void;
  getField: (field: string) => string | number | undefined;
  focusField: (field: string | null) => void;
  getFormSummary: () => string;
  getProgress: () => { completed: number; total: number; percentage: number };
  getCalculatedValues: () => { netWeight: number; totalValue: number };
}

const FormContext = createContext<FormContextValue | null>(null);

export function FormProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(formReducer, initialFormState);

  const setField = useCallback((field: string, value: string | number) => {
    if (EDITABLE_FIELDS.includes(field as any)) {
      dispatch({ 
        type: 'SET_FIELD', 
        field: field as keyof GrainReceiptFormData, 
        value 
      });
    }
  }, []);

  const getField = useCallback((field: string): string | number | undefined => {
    if (field === 'netWeight') {
      return state.data.grossWeight - state.data.vehicleWeight;
    }
    if (field === 'totalValue') {
      const netWeight = state.data.grossWeight - state.data.vehicleWeight;
      return (netWeight / 1000) * state.data.pricePerTonne * (1 - state.data.dockage / 100);
    }
    return state.data[field as keyof GrainReceiptFormData];
  }, [state.data]);

  const focusField = useCallback((field: string | null) => {
    dispatch({ type: 'SET_ACTIVE_FIELD', field });
  }, []);

  const getFormSummary = useCallback((): string => {
    const { data } = state;
    const netWeight = data.grossWeight - data.vehicleWeight;
    const totalValue = (netWeight / 1000) * data.pricePerTonne * (1 - data.dockage / 100);
    
    return `
Form Summary:
- Receipt Number: ${data.receiptNumber} (auto-generated)
- Licensee: ${data.licensee}
- Producer: ${data.producer}
- Delivery Date: ${data.date}
- Gross Weight: ${data.grossWeight.toLocaleString()} kg
- Vehicle Tare: ${data.vehicleWeight.toLocaleString()} kg
- Net Weight: ${netWeight.toLocaleString()} kg
- Grain Type: ${data.grainType}
- Dockage: ${data.dockage}%
- Price per Tonne: $${data.pricePerTonne.toFixed(2)}
- Total Net Payable: $${totalValue.toFixed(2)} CAD
    `.trim();
  }, [state.data]);

  const getProgress = useCallback(() => {
    const total = EDITABLE_FIELDS.length;
    const completed = state.completedFields.length;
    const percentage = Math.round((completed / total) * 100);
    return { completed, total, percentage };
  }, [state.completedFields]);

  const getCalculatedValues = useCallback(() => {
    const netWeight = state.data.grossWeight - state.data.vehicleWeight;
    const totalValue = (netWeight / 1000) * state.data.pricePerTonne * (1 - state.data.dockage / 100);
    return { netWeight, totalValue };
  }, [state.data]);

  const value = useMemo(() => ({
    state,
    dispatch,
    setField,
    getField,
    focusField,
    getFormSummary,
    getProgress,
    getCalculatedValues,
  }), [state, setField, getField, focusField, getFormSummary, getProgress, getCalculatedValues]);

  return (
    <FormContext.Provider value={value}>
      {children}
    </FormContext.Provider>
  );
}

export function useFormContext() {
  const context = useContext(FormContext);
  if (!context) {
    throw new Error('useFormContext must be used within a FormProvider');
  }
  return context;
}

export { FIELD_LABELS, EDITABLE_FIELDS };
```

---

## Phase 3: Ultravox Integration Layer

### Task 3.1: Create System Prompt Generator

Create `src/ultravox/systemPrompt.ts`:

```typescript
export function generateSystemPrompt(formSummary: string): string {
  return `
# FormAI Voice Assistant - Grain Receipt Form

You are FormAI, a patient, friendly voice assistant designed specifically to help seniors fill out government forms. You are currently helping the user complete a **Grain Receipt Form** (Primary Elevator Receipt - Form 6).

## Your Core Personality

- **Patient & Understanding**: Never rush the user. Repeat information if asked. Speak clearly and at a moderate pace.
- **Warm & Reassuring**: Use a friendly, conversational tone. Make the user feel comfortable.
- **Clear & Concise**: Give one piece of information at a time. Avoid jargon.
- **Proactive Helper**: Anticipate confusion and offer clarification before being asked.
- **Respectful of Expertise**: The user is an experienced grain producer - respect their knowledge while helping with the form.

## Form Structure

The form has four sections:
1. **Logistics & Identification**: Producer name, delivery date
2. **Weight Data**: Gross weight (truck + grain), vehicle tare weight (empty truck)
3. **Grading & Dockage**: Grain type, dockage percentage
4. **Financials**: Price per tonne

**Read-only fields** (shown for reference but cannot be changed by voice):
- Receipt Number
- Licensee

**Calculated fields** (computed automatically):
- Net Weight = Gross Weight - Vehicle Tare Weight
- Total Value = (Net Weight / 1000) × Price × (1 - Dockage%)

## Current Form State

${formSummary}

## Conversation Guidelines

### Starting the Call
Begin by greeting the user warmly. Confirm their identity by asking about the producer name. Then proceed through fields systematically.

### Field-by-Field Approach
1. **One field at a time**: Focus on a single field before moving on
2. **State current value**: If a field has a value, tell the user what it is
3. **Request confirmation or update**: Ask if it's correct or if they want to change it
4. **Confirm after changes**: Always read back what you entered
5. **Visual feedback**: Use the focusField tool so they can see which field you're discussing

### Handling Numbers
- For weights: "That's forty-two thousand five hundred kilograms, correct?"
- For percentages: "Two point five percent dockage"
- For money: "Three hundred eighty-five dollars and fifty cents per tonne"

### Handling Dates
- Accept natural language: "yesterday", "November 20th", "the 20th"
- Always confirm: "So that's November 20th, 2024?"
- Store as YYYY-MM-DD format internally

### Navigation Between Sections
- Tell the user where you are: "Now let's move to the weight section"
- Offer to go back: "Would you like to change anything we've already covered?"

### Ending the Call
1. Use getFormSummary to read back all values
2. Ask if everything looks correct
3. If confirmed, use hangUp with reason "completed"
4. If they want changes, go back to the relevant field

## Tool Usage Rules

1. **Always use focusField** when discussing a field - highlights it on screen
2. **Use setFieldValue** only after the user provides a clear value
3. **Use getFieldValue** to check current values before asking
4. **Use confirmValue** after user explicitly confirms a value
5. **Use showHelp** when user asks "what is this?" or seems confused
6. **Use hangUp** ONLY when form is complete AND user confirms, OR user explicitly asks to end

## Response Style

Keep responses SHORT and natural:
- ❌ "I have successfully updated the producer name field to the value Oliver Smith."
- ✅ "Got it, Oliver Smith. Spelled correctly?"

Don't fill silence - wait for user responses.

## Example Interactions

**Confirming a value:**
"That's correct" → [confirmValue] "Perfect. Let's check the delivery date. [focusField: date] I have November 20th. Is that right?"

**Updating a value:**
"Change the gross weight to 43,000" → [setFieldValue] "Updated to 43,000 kilograms. [getFieldValue: netWeight] That makes your net weight 24,800 kilograms."

**User confused:**
"What's dockage?" → [showHelp: dockage] "Dockage is what they deduct for foreign material or damaged kernels. You have 2.5% right now."
`.trim();
}
```

### Task 3.2: Create Tool Definitions

Create `src/ultravox/tools.ts`:

```typescript
export const formTools = [
  {
    temporaryTool: {
      modelToolName: 'setFieldValue',
      description: 'Set a form field value. Use when user provides information. Always confirm the value afterward.',
      dynamicParameters: [
        {
          name: 'fieldName',
          location: 'PARAMETER_LOCATION_BODY',
          schema: {
            type: 'string',
            description: 'Field to update',
            enum: ['producer', 'date', 'grossWeight', 'vehicleWeight', 'grainType', 'dockage', 'pricePerTonne']
          },
          required: true
        },
        {
          name: 'value',
          location: 'PARAMETER_LOCATION_BODY',
          schema: {
            type: 'string',
            description: 'Value to set. For numbers, provide as string (e.g., "42500" for weight, "2.5" for percentage)'
          },
          required: true
        }
      ],
      client: {}
    }
  },
  {
    temporaryTool: {
      modelToolName: 'getFieldValue',
      description: 'Get current value of a form field. Use to check values before discussing them.',
      dynamicParameters: [
        {
          name: 'fieldName',
          location: 'PARAMETER_LOCATION_BODY',
          schema: {
            type: 'string',
            description: 'Field to retrieve',
            enum: ['producer', 'date', 'grossWeight', 'vehicleWeight', 'grainType', 'dockage', 'pricePerTonne', 'receiptNumber', 'licensee', 'netWeight', 'totalValue']
          },
          required: true
        }
      ],
      client: {}
    }
  },
  {
    temporaryTool: {
      modelToolName: 'focusField',
      description: 'Highlight a field in the UI. Use when discussing a specific field to help user locate it.',
      dynamicParameters: [
        {
          name: 'fieldName',
          location: 'PARAMETER_LOCATION_BODY',
          schema: {
            type: 'string',
            description: 'Field to highlight',
            enum: ['producer', 'date', 'grossWeight', 'vehicleWeight', 'grainType', 'dockage', 'pricePerTonne']
          },
          required: true
        }
      ],
      client: {}
    }
  },
  {
    temporaryTool: {
      modelToolName: 'navigateToSection',
      description: 'Scroll to a form section. Use when moving between major sections.',
      dynamicParameters: [
        {
          name: 'section',
          location: 'PARAMETER_LOCATION_BODY',
          schema: {
            type: 'string',
            description: 'Section to navigate to',
            enum: ['logistics', 'weights', 'grading', 'financials']
          },
          required: true
        }
      ],
      client: {}
    }
  },
  {
    temporaryTool: {
      modelToolName: 'getFormProgress',
      description: 'Get form completion progress. Returns completed/total fields and percentage.',
      dynamicParameters: [],
      client: {}
    }
  },
  {
    temporaryTool: {
      modelToolName: 'getFormSummary',
      description: 'Get complete form summary. Use to review all values before submission.',
      dynamicParameters: [],
      client: {}
    }
  },
  {
    temporaryTool: {
      modelToolName: 'confirmValue',
      description: 'Mark a field as confirmed by user. Use after user explicitly confirms a value.',
      dynamicParameters: [
        {
          name: 'fieldName',
          location: 'PARAMETER_LOCATION_BODY',
          schema: {
            type: 'string',
            description: 'Field that was confirmed'
          },
          required: true
        }
      ],
      client: {}
    }
  },
  {
    temporaryTool: {
      modelToolName: 'showHelp',
      description: 'Show help information for a topic. Use when user asks for clarification.',
      dynamicParameters: [
        {
          name: 'topic',
          location: 'PARAMETER_LOCATION_BODY',
          schema: {
            type: 'string',
            description: 'Topic to explain',
            enum: ['producer', 'date', 'weights', 'grossWeight', 'vehicleWeight', 'grainType', 'dockage', 'pricePerTonne', 'general']
          },
          required: true
        }
      ],
      client: {}
    }
  },
  {
    temporaryTool: {
      modelToolName: 'hangUp',
      description: 'End the call. ONLY use when: form is complete AND user confirms, OR user explicitly requests to end.',
      dynamicParameters: [
        {
          name: 'reason',
          location: 'PARAMETER_LOCATION_BODY',
          schema: {
            type: 'string',
            description: 'Reason for ending',
            enum: ['completed', 'user_requested']
          },
          required: true
        }
      ],
      client: {}
    }
  }
];
```

### Task 3.3: Create Tool Implementations

Create `src/ultravox/toolImplementations.ts`:

```typescript
import { FormContextValue } from '../store/FormContext';

const HELP_TEXTS: Record<string, string> = {
  producer: 'The producer is the person or business delivering the grain. This must match your registered name.',
  date: 'The delivery date when the grain arrives at the elevator. Affects pricing.',
  weights: 'Gross weight is truck plus grain. Vehicle tare is empty truck. Net weight is calculated automatically.',
  grossWeight: 'The total weight measured when the truck arrives fully loaded.',
  vehicleWeight: 'The weight of the empty truck, measured after unloading or from registered tare.',
  grainType: 'The grain classification per Canadian Grain Commission standards. CWRS means Canada Western Red Spring wheat.',
  dockage: 'Percentage deducted for foreign material and damaged kernels. Set by the grain inspector.',
  pricePerTonne: 'Current market price for this grain type and grade.',
  general: 'I help you fill out this grain receipt. Just tell me the information and I will enter it. Ask to go back to any field anytime.'
};

const NUMERIC_FIELDS = ['grossWeight', 'vehicleWeight', 'dockage', 'pricePerTonne'];

export function createToolImplementations(formContext: FormContextValue, endCall: () => void) {
  return {
    setFieldValue: ({ fieldName, value }: { fieldName: string; value: string }) => {
      const parsedValue = NUMERIC_FIELDS.includes(fieldName) 
        ? parseFloat(value) 
        : value;
      
      formContext.setField(fieldName, parsedValue);
      formContext.focusField(fieldName);
      
      // Clear focus after 3 seconds
      setTimeout(() => formContext.focusField(null), 3000);
      
      let displayValue = String(parsedValue);
      if (fieldName.includes('Weight')) displayValue += ' kg';
      if (fieldName === 'dockage') displayValue += '%';
      if (fieldName === 'pricePerTonne') displayValue = '$' + parsedValue;
      
      return JSON.stringify({
        success: true,
        message: `Set ${fieldName} to ${displayValue}. Please confirm this with the user.`,
        fieldName,
        newValue: parsedValue
      });
    },
    
    getFieldValue: ({ fieldName }: { fieldName: string }) => {
      const value = formContext.getField(fieldName);
      return JSON.stringify({
        fieldName,
        value: value ?? 'Not set',
        message: `Current value of ${fieldName}: ${value ?? 'not set'}`
      });
    },
    
    focusField: ({ fieldName }: { fieldName: string }) => {
      formContext.focusField(fieldName);
      setTimeout(() => formContext.focusField(null), 5000);
      return JSON.stringify({
        success: true,
        message: `Highlighting ${fieldName} on screen.`
      });
    },
    
    navigateToSection: ({ section }: { section: string }) => {
      window.dispatchEvent(new CustomEvent('form:navigate', { detail: { section } }));
      return JSON.stringify({
        success: true,
        message: `Scrolled to ${section} section.`
      });
    },
    
    getFormProgress: () => {
      const progress = formContext.getProgress();
      return JSON.stringify({
        ...progress,
        message: `Form is ${progress.percentage}% complete. ${progress.completed} of ${progress.total} fields confirmed.`
      });
    },
    
    getFormSummary: () => {
      const summary = formContext.getFormSummary();
      return JSON.stringify({ summary, message: summary });
    },
    
    confirmValue: ({ fieldName }: { fieldName: string }) => {
      formContext.dispatch({ type: 'MARK_FIELD_COMPLETE', field: fieldName });
      return JSON.stringify({
        success: true,
        message: `Marked ${fieldName} as confirmed.`
      });
    },
    
    showHelp: ({ topic }: { topic: string }) => {
      const helpText = HELP_TEXTS[topic] || HELP_TEXTS.general;
      window.dispatchEvent(new CustomEvent('form:showHelp', { detail: { topic, helpText } }));
      return JSON.stringify({ topic, helpText, message: helpText });
    },
    
    hangUp: ({ reason }: { reason: string }) => {
      const message = reason === 'completed' 
        ? 'Form complete! Thank you for using FormAI.'
        : 'Call ended. Thank you for using FormAI.';
      
      // Small delay to allow final message to be spoken
      setTimeout(() => endCall(), 2000);
      
      return JSON.stringify({ success: true, message });
    }
  };
}
```

### Task 3.4: Create Ultravox Provider

Create `src/ultravox/UltravoxProvider.tsx`:

```typescript
import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { UltravoxSession, UltravoxSessionStatus, Transcript } from 'ultravox-client';
import { useFormContext } from '../store/FormContext';
import { generateSystemPrompt } from './systemPrompt';
import { formTools } from './tools';
import { createToolImplementations } from './toolImplementations';

interface UltravoxContextValue {
  status: UltravoxSessionStatus;
  transcripts: Transcript[];
  isConnected: boolean;
  isMicMuted: boolean;
  startCall: () => Promise<void>;
  endCall: () => Promise<void>;
  toggleMic: () => void;
}

const UltravoxContext = createContext<UltravoxContextValue | null>(null);

export function UltravoxProvider({ children }: { children: React.ReactNode }) {
  const formContext = useFormContext();
  const sessionRef = useRef<UltravoxSession | null>(null);
  
  const [status, setStatus] = useState<UltravoxSessionStatus>('disconnected');
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
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

    // Create the call via Ultravox API
    const callConfig = {
      systemPrompt: generateSystemPrompt(formContext.getFormSummary()),
      voice: 'Jessica',
      temperature: 0.4,
      firstSpeaker: 'FIRST_SPEAKER_AGENT',
      selectedTools: formTools
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
      const session = new UltravoxSession({ experimentalMessages: ['debug'] });
      sessionRef.current = session;

      // Register tool implementations
      const toolImpls = createToolImplementations(formContext, endCall);
      session.registerToolImplementations(toolImpls);

      // Set up event listeners
      session.addEventListener('status', () => {
        setStatus(session.status);
      });

      session.addEventListener('transcripts', () => {
        setTranscripts([...session.transcripts]);
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
    toggleMic
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
```

---

## Phase 4: Voice UI Components

### Task 4.1: Create Voice Orb Component

Create `src/components/voice/VoiceOrb.tsx`:

```typescript
import { motion } from 'framer-motion';
import { Mic, MicOff, Phone, PhoneOff } from 'lucide-react';
import { UltravoxSessionStatus } from 'ultravox-client';
import { cn } from '../../lib/utils';

interface VoiceOrbProps {
  status: UltravoxSessionStatus;
  isMuted: boolean;
  onToggleMic: () => void;
  onEndCall: () => void;
}

const statusColors: Record<UltravoxSessionStatus, string> = {
  disconnected: 'bg-slate-400',
  disconnecting: 'bg-slate-400',
  connecting: 'bg-yellow-500',
  idle: 'bg-emerald-500',
  listening: 'bg-gov-blue',
  thinking: 'bg-purple-500',
  speaking: 'bg-emerald-500'
};

const statusLabels: Record<UltravoxSessionStatus, string> = {
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
```

### Task 4.2: Create Transcript Display

Create `src/components/voice/TranscriptDisplay.tsx`:

```typescript
import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Transcript } from 'ultravox-client';
import { cn } from '../../lib/utils';

interface TranscriptDisplayProps {
  transcripts: Transcript[];
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
```

### Task 4.3: Create Voice Assistant Panel

Create `src/components/voice/VoiceAssistantPanel.tsx`:

```typescript
import { motion, AnimatePresence } from 'framer-motion';
import { Phone, X } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { VoiceOrb } from './VoiceOrb';
import { TranscriptDisplay } from './TranscriptDisplay';
import { useUltravox } from '../../ultravox/UltravoxProvider';
import { useFormContext } from '../../store/FormContext';
import { FIELD_LABELS } from '../../store/FormContext';

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
```

---

## Phase 5: Form Integration

### Task 5.1: Update GrainReceiptForm

Update `src/components/views/GrainReceiptForm.tsx` to use FormContext and add field highlighting:

**Key changes:**
1. Replace local state with FormContext
2. Add field highlighting based on `state.activeField`
3. Add section refs for navigation
4. Listen for navigation and help events

```typescript
// Add to imports
import { useFormContext } from '../../store/FormContext';
import { useEffect, useRef } from 'react';

// Inside component:
const { state, dispatch, getCalculatedValues } = useFormContext();
const { netWeight, totalValue } = getCalculatedValues();

// Section refs for navigation
const sectionRefs = {
  logistics: useRef<HTMLElement>(null),
  weights: useRef<HTMLElement>(null),
  grading: useRef<HTMLElement>(null),
  financials: useRef<HTMLElement>(null)
};

// Listen for navigation events
useEffect(() => {
  const handleNavigate = (e: CustomEvent<{ section: string }>) => {
    const ref = sectionRefs[e.detail.section as keyof typeof sectionRefs];
    ref?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  
  window.addEventListener('form:navigate', handleNavigate as EventListener);
  return () => window.removeEventListener('form:navigate', handleNavigate as EventListener);
}, []);

// Field highlight helper
const isFieldActive = (fieldName: string) => state.activeField === fieldName;
const wasFieldUpdated = (fieldName: string) => 
  state.lastUpdatedField === fieldName && 
  Date.now() - state.lastUpdateTimestamp < 2000;

// Use in SuperInput:
<SuperInput 
  label="Producer Name"
  value={state.data.producer}
  onChange={(e) => dispatch({ type: 'SET_FIELD', field: 'producer', value: e.target.value })}
  className={cn(
    isFieldActive('producer') && 'ring-4 ring-gov-blue/50 ring-offset-2',
    wasFieldUpdated('producer') && 'animate-pulse bg-emerald-50'
  )}
/>
```

### Task 5.2: Update SuperInput for Controlled Input

Update `src/components/ui/SuperInput.tsx` to support controlled inputs:

```typescript
interface SuperInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  badgeIcon?: LucideIcon;
  badgeText?: string;
  containerClassName?: string;
  isHighlighted?: boolean;  // NEW
}

// Add highlight styling
<input
  className={cn(
    // ... existing classes
    isHighlighted && 'ring-4 ring-gov-blue/50 ring-offset-2 animate-pulse'
  )}
/>
```

---

## Phase 6: App Assembly

### Task 6.1: Update App.tsx

Update `src/App.tsx` to include providers and voice panel:

```typescript
import { useState } from "react";
import { AnimatePresence } from "framer-motion";
import { Sidebar } from "./components/layout/Sidebar";
import { Dashboard } from "./components/views/Dashboard";
import { GrainReceiptForm } from "./components/views/GrainReceiptForm";
import { AccessibilitySettings } from "./components/views/AccessibilitySettings";
import { VoiceAssistantPanel } from "./components/voice/VoiceAssistantPanel";
import { FormProvider } from "./store/FormContext";
import { UltravoxProvider } from "./ultravox/UltravoxProvider";

function App() {
  const [currentView, setCurrentView] = useState<'dashboard' | 'form' | 'settings'>('dashboard');

  return (
    <FormProvider>
      <UltravoxProvider>
        <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-800 font-sans selection:bg-gov-blue/20 selection:text-gov-blue">
          <Sidebar currentView={currentView} onViewChange={setCurrentView} />

          <main className="flex-1 ml-80 h-full relative">
            {/* Background Ambient Glows */}
            <div className="fixed top-0 right-0 w-[800px] h-[800px] bg-gov-blue/5 rounded-full blur-[120px] pointer-events-none -z-10" />
            <div className="fixed bottom-0 left-80 w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none -z-10" />

            <AnimatePresence mode="wait">
              {currentView === 'dashboard' && (
                <Dashboard key="dashboard" onResume={() => setCurrentView('form')} />
              )}
              {currentView === 'form' && (
                <GrainReceiptForm key="form" />
              )}
              {currentView === 'settings' && (
                <AccessibilitySettings key="settings" />
              )}
            </AnimatePresence>
          </main>

          {/* Voice Assistant - only show on form view */}
          {currentView === 'form' && <VoiceAssistantPanel />}
        </div>
      </UltravoxProvider>
    </FormProvider>
  );
}

export default App;
```

### Task 6.2: Update Sidebar Voice Status

Update `src/components/layout/Sidebar.tsx` to show voice status:

Add to the AI Agent Orb section:

```typescript
import { useUltravox } from '../../ultravox/UltravoxProvider';

// Inside component:
const { status, isConnected } = useUltravox();

// Update the orb display:
<div className="p-8 flex flex-col items-center border-b border-white/10">
  <div className="relative w-24 h-24 mb-4 flex items-center justify-center">
    {isConnected && (
      <>
        <div className="absolute inset-0 rounded-full bg-gov-blue/20 animate-ping" />
        <div className="absolute inset-2 rounded-full bg-gov-blue/30 animate-pulse" />
      </>
    )}
    <div className={cn(
      "relative w-16 h-16 rounded-full shadow-glow flex items-center justify-center",
      isConnected 
        ? "bg-gradient-to-br from-gov-blue to-indigo-600" 
        : "bg-gradient-to-br from-slate-400 to-slate-500"
    )}>
      <div className={cn(
        "w-2 h-2 rounded-full",
        isConnected ? "bg-white animate-bounce" : "bg-white/50"
      )} />
    </div>
  </div>
  <h2 className="text-sm font-semibold text-gov-blue tracking-widest uppercase">
    {isConnected ? 'FormAI Active' : 'FormAI Ready'}
  </h2>
  <p className="text-xs text-slate-500 mt-1">
    {isConnected ? status : 'Click to start'}
  </p>
</div>
```

---

## Phase 7: Type Declarations

### Task 7.1: Add Vite Environment Types

Update `src/vite-env.d.ts`:

```typescript
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ULTRAVOX_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Custom events for Ultravox tools
interface WindowEventMap {
  'form:navigate': CustomEvent<{ section: string }>;
  'form:showHelp': CustomEvent<{ topic: string; helpText: string }>;
}
```

---

## Testing Checklist

After implementation, verify:

- [ ] App starts without errors
- [ ] Clicking "Start Voice Assistant" creates a call
- [ ] Voice orb shows correct status (connecting → listening)
- [ ] Saying field values updates the form
- [ ] Form fields highlight when discussed
- [ ] Transcripts appear in real-time
- [ ] Mute button works
- [ ] End call button works
- [ ] Saying "hang up" ends the call
- [ ] Form values persist after call ends

---

## Common Issues & Solutions

### Issue: "VITE_ULTRAVOX_API_KEY not set"
**Solution**: Create `.env` file with your API key

### Issue: Call fails to connect
**Solution**: Check API key is valid and has credits

### Issue: Tools not being called
**Solution**: Verify tool names match exactly between `tools.ts` and `toolImplementations.ts`

### Issue: Field updates not showing
**Solution**: Ensure FormContext is wrapping the components correctly

---

## File Creation Order

1. `src/store/types.ts`
2. `src/store/formReducer.ts`
3. `src/store/FormContext.tsx`
4. `src/ultravox/systemPrompt.ts`
5. `src/ultravox/tools.ts`
6. `src/ultravox/toolImplementations.ts`
7. `src/ultravox/UltravoxProvider.tsx`
8. `src/components/voice/VoiceOrb.tsx`
9. `src/components/voice/TranscriptDisplay.tsx`
10. `src/components/voice/VoiceAssistantPanel.tsx`
11. Update `src/components/views/GrainReceiptForm.tsx`
12. Update `src/components/ui/SuperInput.tsx`
13. Update `src/components/layout/Sidebar.tsx`
14. Update `src/App.tsx`
15. Update `src/vite-env.d.ts`
16. Create `.env.example` and `.env`