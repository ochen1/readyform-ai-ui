import type { FormContextValue } from '../store/FormContext';

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

export type ToolImplementations = ReturnType<typeof createToolImplementations>;