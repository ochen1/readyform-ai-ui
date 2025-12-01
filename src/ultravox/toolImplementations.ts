import type { FormContextValue } from '../store/FormContext';
import { fieldAnimationQueue } from '../services/fieldAnimationQueue';

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
      console.log(`[Tool Call] setFieldValue("${fieldName}", "${value}")`);
      
      const field = findFieldByName(fieldName);
      
      if (!field) {
        console.warn(`[Tool Call] setFieldValue FAILED: Field "${fieldName}" not found`);
        return JSON.stringify({
          success: false,
          message: `Field "${fieldName}" not found in form. Available fields: ${formContext.state.fields.map(f => f.name).join(', ')}`,
          fieldName,
        });
      }

      if (field.readonly) {
        console.warn(`[Tool Call] setFieldValue FAILED: Field "${fieldName}" is read-only`);
        return JSON.stringify({
          success: false,
          message: `Field "${fieldName}" is read-only and cannot be modified.`,
          fieldName,
        });
      }

      // Handle boolean and checkbox fields specifically for voice interaction
      let processedValue = value;
      if (field.type === 'boolean') {
        const lowerValue = value.toLowerCase();
        if (lowerValue === 'yes' || lowerValue === 'true' || lowerValue === 'on' || lowerValue === 'checked') {
          processedValue = 'Yes';
        } else if (lowerValue === 'no' || lowerValue === 'false' || lowerValue === 'off' || lowerValue === 'unchecked') {
          processedValue = 'No';
        }
      } else if (field.type === 'checkbox') {
        const lowerValue = value.toLowerCase();
        if (lowerValue === 'yes' || lowerValue === 'true' || lowerValue === 'on' || lowerValue === 'checked' || lowerValue === '1') {
          processedValue = 'checked';
        } else if (lowerValue === 'no' || lowerValue === 'false' || lowerValue === 'off' || lowerValue === 'unchecked' || lowerValue === '0' || lowerValue === '') {
          processedValue = '';
        }
      }

      // Queue the field update for animated display
      // This provides visual feedback with delays so users can follow along
      fieldAnimationQueue.enqueue({
        fieldId: field.id,
        value: processedValue,
        onSetValue: (fieldId, val) => formContext.setField(fieldId, val),
        onFocusField: (fieldId) => formContext.focusField(fieldId),
        onMarkComplete: (fieldId) => formContext.dispatch({ type: 'MARK_FIELD_COMPLETE', fieldId }),
      });
      
      console.log(`[Tool Call] setFieldValue QUEUED: "${field.name}" = "${processedValue}"`);
      
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
      console.log(`[Tool Call] getFieldValue("${fieldName}")`);
      
      const field = findFieldByName(fieldName);
      
      if (!field) {
        console.warn(`[Tool Call] getFieldValue FAILED: Field "${fieldName}" not found`);
        return JSON.stringify({
          fieldName,
          value: 'Not found',
          message: `Field "${fieldName}" not found in form. Available fields: ${formContext.state.fields.map(f => f.name).join(', ')}`
        });
      }
      
      const value = field.value || '(empty)';
      const isCalculated = field.type === 'calculated';
      
      console.log(`[Tool Call] getFieldValue SUCCESS: "${field.name}" = "${value}"`);
      
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
      console.log(`[Tool Call] focusField("${fieldName}")`);
      
      const field = findFieldByName(fieldName);
      
      if (!field) {
        console.warn(`[Tool Call] focusField FAILED: Field "${fieldName}" not found`);
        return JSON.stringify({
          success: false,
          message: `Field "${fieldName}" not found in form. Available fields: ${formContext.state.fields.map(f => f.name).join(', ')}`
        });
      }

      formContext.focusField(field.id);
      
      console.log(`[Tool Call] focusField SUCCESS: Highlighting "${field.name}" and scrolling to it`);
      
      setTimeout(() => formContext.focusField(null), 5000);
      
      return JSON.stringify({
        success: true,
        message: `Highlighting "${field.name}" on screen and scrolling to it.`
      });
    },
    
    /**
     * Get form completion progress
     */
    getFormProgress: () => {
      console.log(`[Tool Call] getFormProgress()`);
      const progress = formContext.getProgress();
      console.log(`[Tool Call] getFormProgress SUCCESS: ${progress.percentage}% complete`);
      return JSON.stringify({
        ...progress,
        message: `Form is ${progress.percentage}% complete. ${progress.completed} of ${progress.total} fields filled.`
      });
    },
    
    /**
     * Get complete form summary
     */
    getFormSummary: () => {
      console.log(`[Tool Call] getFormSummary()`);
      const summary = formContext.getFormSummary();
      console.log(`[Tool Call] getFormSummary SUCCESS`);
      return JSON.stringify({ summary, message: summary });
    },
    
    /**
     * Mark a field as confirmed
     */
    confirmValue: ({ fieldName }: { fieldName: string }) => {
      console.log(`[Tool Call] confirmValue("${fieldName}")`);
      
      const field = findFieldByName(fieldName);
      
      if (!field) {
        console.warn(`[Tool Call] confirmValue FAILED: Field "${fieldName}" not found`);
        return JSON.stringify({
          success: false,
          message: `Field "${fieldName}" not found in form.`
        });
      }

      formContext.dispatch({ type: 'MARK_FIELD_COMPLETE', fieldId: field.id });
      
      console.log(`[Tool Call] confirmValue SUCCESS: "${field.name}" marked complete`);
      
      return JSON.stringify({
        success: true,
        message: `Marked "${field.name}" as confirmed.`
      });
    },
    
    /**
     * Show help information for a topic
     */
    showHelp: ({ topic }: { topic: string }) => {
      console.log(`[Tool Call] showHelp("${topic}")`);
      
      let helpText: string;
      
      if (topic === 'general') {
        helpText = 'I help you fill out this form. Just tell me the information and I will enter it. Ask to go back to any field anytime.';
      } else {
        // Try to find the field and give generic help
        const field = findFieldByName(topic);
        if (field) {
          helpText = field.description || `"${field.name}" is a form field. ${field.readonly ? 'This field is read-only.' : 'You can update this field by telling me the new value.'}`;
        } else {
          helpText = `I don't have specific help for "${topic}". You can ask me about any field in the form or say "general" for an overview.`;
        }
      }
      
      console.log(`[Tool Call] showHelp SUCCESS: "${topic}"`);
      
      window.dispatchEvent(new CustomEvent('form:showHelp', { detail: { topic, helpText } }));
      return JSON.stringify({ topic, helpText, message: helpText });
    },
    
    /**
     * Navigate to a form section
     */
    navigateToSection: ({ sectionId }: { sectionId: string }) => {
      console.log(`[Tool Call] navigateToSection("${sectionId}")`);
      
      // Find the section in the form state
      const section = formContext.state.sections.find(s => s.id === sectionId);
      
      if (!section) {
        console.warn(`[Tool Call] navigateToSection FAILED: Section "${sectionId}" not found`);
        const availableSections = formContext.state.sections.map(s => `${s.id} (${s.title})`).join(', ');
        return JSON.stringify({
          success: false,
          message: `Section "${sectionId}" not found. Available sections: ${availableSections}`
        });
      }
      
      // Dispatch event to trigger smooth scroll animation in SimpleForm
      window.dispatchEvent(new CustomEvent('form:navigate', {
        detail: { section: sectionId }
      }));
      
      // Clear any active field focus
      formContext.focusField(null);
      
      console.log(`[Tool Call] navigateToSection SUCCESS: Scrolling to "${section.title}"`);
      
      return JSON.stringify({
        success: true,
        sectionId,
        sectionTitle: section.title,
        message: `Navigating to ${section.title}.`
      });
    },
    
    /**
     * End the call
     */
    hangUp: ({ reason }: { reason: string }) => {
      console.log(`[Tool Call] hangUp("${reason}")`);
      
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