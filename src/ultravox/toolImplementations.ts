import type { FormContextValue } from '../store/FormContext';

/**
 * Create tool implementations that work with dynamic form fields
 * All field lookups are done by display name (case-insensitive)
 */
export function createToolImplementations(formContext: FormContextValue, endCall: () => void) {
  /**
   * Find a field by its display name (case-insensitive)
   */
  const findFieldByName = (fieldName: string) => {
    return formContext.state.fields.find(
      f => f.name.toLowerCase() === fieldName.toLowerCase()
    );
  };

  return {
    /**
     * Set a form field value
     */
    setFieldValue: ({ fieldName, value }: { fieldName: string; value: string }) => {
      const field = findFieldByName(fieldName);
      
      if (!field) {
        return JSON.stringify({
          success: false,
          message: `Field "${fieldName}" not found in form.`,
          fieldName,
        });
      }

      if (field.readonly) {
        return JSON.stringify({
          success: false,
          message: `Field "${fieldName}" is read-only and cannot be modified.`,
          fieldName,
        });
      }

      // Handle boolean fields specifically for voice interaction
      let processedValue = value;
      if (field.type === 'boolean') {
        const lowerValue = value.toLowerCase();
        if (lowerValue === 'yes' || lowerValue === 'true' || lowerValue === 'on') {
          processedValue = 'Yes';
        } else if (lowerValue === 'no' || lowerValue === 'false' || lowerValue === 'off') {
          processedValue = 'No';
        }
      }

      formContext.setField(field.id, processedValue);
      formContext.focusField(field.id);
      
      // Auto-mark field as complete when value is set by voice assistant
      formContext.dispatch({ type: 'MARK_FIELD_COMPLETE', fieldId: field.id });
      
      // Clear focus after 3 seconds
      setTimeout(() => formContext.focusField(null), 3000);
      
      return JSON.stringify({
        success: true,
        message: `Set "${field.name}" to "${processedValue}".`,
        fieldName: field.name,
        newValue: processedValue
      });
    },
    
    /**
     * Get current value of a form field
     */
    getFieldValue: ({ fieldName }: { fieldName: string }) => {
      const field = findFieldByName(fieldName);
      
      if (!field) {
        return JSON.stringify({
          fieldName,
          value: 'Not found',
          message: `Field "${fieldName}" not found in form.`
        });
      }
      
      const value = field.value || '(empty)';
      const isCalculated = field.type === 'calculated';
      
      // Build a more informative message for calculated fields
      let message = `Current value of "${field.name}": ${value}`;
      if (isCalculated) {
        message = `"${field.name}" is a calculated field that updates automatically. Current value: ${value}`;
        if (field.calculationHint) {
          message += ` (${field.calculationHint})`;
        }
      }
      
      return JSON.stringify({
        fieldName: field.name,
        value,
        isCalculated,
        calculationHint: field.calculationHint,
        message
      });
    },
    
    /**
     * Highlight a field in the UI
     */
    focusField: ({ fieldName }: { fieldName: string }) => {
      const field = findFieldByName(fieldName);
      
      if (!field) {
        return JSON.stringify({
          success: false,
          message: `Field "${fieldName}" not found in form.`
        });
      }

      formContext.focusField(field.id);
      setTimeout(() => formContext.focusField(null), 5000);
      
      return JSON.stringify({
        success: true,
        message: `Highlighting "${field.name}" on screen.`
      });
    },
    
    /**
     * Get form completion progress
     */
    getFormProgress: () => {
      const progress = formContext.getProgress();
      return JSON.stringify({
        ...progress,
        message: `Form is ${progress.percentage}% complete. ${progress.completed} of ${progress.total} fields confirmed.`
      });
    },
    
    /**
     * Get complete form summary
     */
    getFormSummary: () => {
      const summary = formContext.getFormSummary();
      return JSON.stringify({ summary, message: summary });
    },
    
    /**
     * Mark a field as confirmed
     */
    confirmValue: ({ fieldName }: { fieldName: string }) => {
      const field = findFieldByName(fieldName);
      
      if (!field) {
        return JSON.stringify({
          success: false,
          message: `Field "${fieldName}" not found in form.`
        });
      }

      formContext.dispatch({ type: 'MARK_FIELD_COMPLETE', fieldId: field.id });
      
      return JSON.stringify({
        success: true,
        message: `Marked "${field.name}" as confirmed.`
      });
    },
    
    /**
     * Show help information for a topic
     */
    showHelp: ({ topic }: { topic: string }) => {
      let helpText: string;
      
      if (topic === 'general') {
        helpText = 'I help you fill out this form. Just tell me the information and I will enter it. Ask to go back to any field anytime.';
      } else {
        // Try to find the field and give generic help
        const field = findFieldByName(topic);
        if (field) {
          helpText = `"${field.name}" is a form field. ${field.readonly ? 'This field is read-only.' : 'You can update this field by telling me the new value.'}`;
        } else {
          helpText = `I don't have specific help for "${topic}". You can ask me about any field in the form or say "general" for an overview.`;
        }
      }
      
      window.dispatchEvent(new CustomEvent('form:showHelp', { detail: { topic, helpText } }));
      return JSON.stringify({ topic, helpText, message: helpText });
    },
    
    /**
     * End the call
     */
    hangUp: ({ reason }: { reason: string }) => {
      const message = reason === 'completed'
        ? 'Form complete! Thank you for using ReadyFormAI.'
        : 'Call ended. Thank you for using ReadyFormAI.';
      
      // Small delay to allow final message to be spoken
      setTimeout(() => endCall(), 2000);
      
      return JSON.stringify({ success: true, message });
    }
  };
}

export type ToolImplementations = ReturnType<typeof createToolImplementations>;