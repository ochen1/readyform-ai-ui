import type { FormContextValue } from '../store/FormContext';
import { SUPPORTED_LANGUAGES } from '../store/languageTypes';
import { fieldAnimationQueue } from '../services/fieldAnimationQueue';
import { normalizeFieldValue, getCurrentLanguage } from '../services/formatConversion';

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
     * Set the detected language of the user
     */
    setLanguage: ({ languageCode }: { languageCode: string }) => {
      console.log(`[Tool Call] setLanguage("${languageCode}")`);

      if (!SUPPORTED_LANGUAGES.includes(languageCode as typeof SUPPORTED_LANGUAGES[number])) {
        return JSON.stringify({
          success: false,
          message: `Invalid language code "${languageCode}". Supported: ${SUPPORTED_LANGUAGES.join(', ')}`
        });
      }

      // Dispatch event for LanguageContext to pick up
      window.dispatchEvent(new CustomEvent('language:detected', {
        detail: { languageCode }
      }));

      console.log(`[Tool Call] setLanguage SUCCESS: Language set to "${languageCode}"`);

      return JSON.stringify({
        success: true,
        message: `Language set to ${languageCode}. UI will update to match.`,
        languageCode,
      });
    },

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

      // Normalize localized formats (dates, numbers) to PDF-compatible formats
      processedValue = normalizeFieldValue(processedValue, {
        language: getCurrentLanguage(),
        fieldType: field.type,
        fieldFormat: field.format,
      });

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
     * Show tooltip popup for a specific field (RAG-style visual help)
     */
    showTooltip: ({ fieldName }: { fieldName: string }) => {
      console.log(`[Tool Call] showTooltip("${fieldName}")`);
      
      const field = findFieldByName(fieldName);
      
      if (!field) {
        console.warn(`[Tool Call] showTooltip FAILED: Field "${fieldName}" not found`);
        return JSON.stringify({
          success: false,
          message: `Field "${fieldName}" not found in form.`
        });
      }
      
      // Build tooltip content from field metadata
      const tooltipContent = {
        fieldName: field.name,
        description: field.description || `Enter the value for ${field.name}`,
        calculationHint: field.calculationHint,
        format: field.format,
        unit: field.unit,
        type: field.type,
      };
      
      // Dispatch event to show tooltip on the field
      window.dispatchEvent(new CustomEvent('form:showTooltip', {
        detail: {
          fieldId: field.id,
          fieldName: field.name,
          content: tooltipContent,
          duration: 8000, // Show for 8 seconds
        }
      }));
      
      // Also focus the field so it scrolls into view
      formContext.focusField(field.id);
      
      console.log(`[Tool Call] showTooltip SUCCESS: Displaying tooltip for "${field.name}"`);
      
      return JSON.stringify({
        success: true,
        fieldName: field.name,
        description: tooltipContent.description,
        message: tooltipContent.description
      });
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
     * End the call and show the completed PDF preview
     */
    hangUp: ({ reason }: { reason: string }) => {
      console.log(`[Tool Call] hangUp("${reason}")`);
      
      // Dispatch event to trigger full-screen PDF preview in SimpleForm
      window.dispatchEvent(new CustomEvent('form:submit'));
      
      const message = reason === 'completed'
        ? 'Form complete! The PDF is now displayed. Thank you for using ReadyFormAI.'
        : 'Call ended. The PDF is now displayed. Thank you for using ReadyFormAI.';
      
      // Small delay to allow final message to be spoken, then end call
      setTimeout(() => endCall(), 2000);
      
      console.log(`[Tool Call] hangUp SUCCESS: Showing PDF preview and ending call`);
      
      return JSON.stringify({ success: true, message });
    }
  };
}

export type ToolImplementations = ReturnType<typeof createToolImplementations>;