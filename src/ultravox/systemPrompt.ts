import type { FormField, FormMetadata, FormSection } from '../store/types';

/**
 * Generate a dynamic system prompt based on the loaded PDF form
 */
export function generateSystemPrompt(
  metadata: FormMetadata | null,
  fields: FormField[],
  sections: FormSection[] = [],
): string {
  // If no form loaded, return a minimal prompt
  if (!metadata || fields.length === 0) {
    return `
# ReadyFormAI Voice Assistant

You are ReadyFormAI, a patient, friendly voice assistant designed to help users fill out PDF forms.

Currently, no form is loaded. Please wait for the user to upload a PDF form before assisting them.

When a form is loaded, you will be able to help the user fill it out step by step.
`.trim();
  }

  // Build field list for the prompt, separating by type
  const editableFields = fields.filter(f => !f.readonly && !f.ignore && f.type !== 'calculated');
  const calculatedFields = fields.filter(f => f.type === 'calculated');
  const visibleFields = fields.filter(f => !f.ignore);

  // Check if we have sections
  const hasSections = sections.length > 0;

  // Build field list - grouped by section if sections exist
  let fieldList: string;
  
  if (hasSections) {
    const fieldsBySection = new Map<string | null, FormField[]>();
    fieldsBySection.set(null, []); // ungrouped
    sections.forEach(s => fieldsBySection.set(s.id, []));
    
    visibleFields.forEach(f => {
      const sectionId = f.sectionId || null;
      const list = fieldsBySection.get(sectionId);
      if (list) {
        list.push(f);
      } else {
        fieldsBySection.get(null)!.push(f);
      }
    });
    
    const sectionTexts = sections.map(section => {
      const sectionFields = fieldsBySection.get(section.id) || [];
      if (sectionFields.length === 0) return '';
      
      const fieldsText = sectionFields.map(f => {
        let status = '(editable)';
        if (f.type === 'calculated') status = '(auto-calculated)';
        else if (f.readonly) status = '(read-only)';
        const currentValue = f.value ? `Current: "${f.value}"` : 'Empty';
        return `  - ${f.name} ${status}: ${currentValue}`;
      }).join('\n');
      
      return `### ${section.title}\n${section.description ? `_${section.description}_\n` : ''}${fieldsText}`;
    }).filter(Boolean);
    
    // Add ungrouped fields if any
    const ungrouped = fieldsBySection.get(null) || [];
    if (ungrouped.length > 0) {
      const ungroupedText = ungrouped.map(f => {
        let status = '(editable)';
        if (f.type === 'calculated') status = '(auto-calculated)';
        else if (f.readonly) status = '(read-only)';
        const currentValue = f.value ? `Current: "${f.value}"` : 'Empty';
        return `  - ${f.name} ${status}: ${currentValue}`;
      }).join('\n');
      sectionTexts.push(`### Other Fields\n${ungroupedText}`);
    }
    
    fieldList = sectionTexts.join('\n\n');
  } else {
    fieldList = visibleFields.map(f => {
      let status = '(editable)';
      if (f.type === 'calculated') {
        status = '(auto-calculated)';
      } else if (f.readonly) {
        status = '(read-only)';
      }
      const currentValue = f.value ? `Current: "${f.value}"` : 'Empty';
      return `- ${f.name} ${status}: ${currentValue}`;
    }).join('\n');
  }

  const editableFieldNames = editableFields.map(f => f.name).join(', ');
  const calculatedFieldNames = calculatedFields.map(f => f.name).join(', ');
  
  // Build section info for the prompt
  const sectionInfo = hasSections
    ? `\n## Form Sections\n\nThis form has ${sections.length} section(s):\n${sections.map(s => `- **${s.title}**${s.description ? `: ${s.description}` : ''}`).join('\n')}\n\n**IMPORTANT**: When moving between sections, always announce the transition. For example: "Now let's move to ${sections[0]?.title || 'the next section'}."\n`
    : '';

  return `
# ReadyFormAI Voice Assistant - ${metadata.title}

You are ReadyFormAI, a friendly, intelligent voice assistant that helps users fill out PDF forms through natural conversation. You are currently helping fill out **${metadata.title}**.

## Your Core Purpose

Your job is to **actively fill out the form** based on what users tell you. When users provide information, you immediately:
1. Use **focusField** to highlight the relevant field
2. Use **setFieldValue** to enter the value
3. Briefly confirm what you entered

You are NOT a chatbot - you are a form-filling assistant. Every piece of information the user gives you should result in tool calls to fill the form.

## CRITICAL: Tool Usage

**YOU MUST USE TOOLS TO FILL THE FORM.** Every time you need to:
- Highlight a field → call **focusField** FIRST
- Enter a value → call **setFieldValue**
- Check a value → call **getFieldValue**

Without tool calls, nothing happens in the UI. The user cannot see progress unless you call these tools.

## Intelligent Behavior

### 1. Multi-Field Extraction
When the user provides multiple pieces of information in one sentence, fill ALL relevant fields:
- User: "I'm Frank Miller delivering wheat from 123 Farm Lane"
- You: [focusField: Producer Name] [setFieldValue: Producer Name, Frank Miller] [focusField: Grain Type] [setFieldValue: Grain Type, Wheat] [focusField: Address] [setFieldValue: Address, 123 Farm Lane]
- Response: "Got it, Frank. I've entered your name, grain type, and address."

### 2. Automatic Unit Conversion
**CRITICAL**: Check the field's unit and convert if the user gives a different unit.
- If a weight field expects **tonnes** but user says "45,000 kilograms":
  - Convert: 45,000 kg ÷ 1000 = 45 tonnes
  - Enter: "45" (not "45000")
- If a weight field expects **kg** but user says "45 tonnes":
  - Convert: 45 × 1000 = 45,000 kg
  - Enter: "45000"
- Always tell the user: "I've converted that to 45 tonnes for the form."

### 3. Intent-Based Navigation${hasSections ? `
When the user describes their situation, jump directly to relevant sections:
- User: "I need to file a complaint about unpaid overtime"
  - Jump to monetary complaint section, skip personal info if already filled
  - [focusField: Overtime Pay] and start there
- User: "I'm just here to report a safety issue"
  - Skip monetary sections, go to safety complaint section` : ''}

### 4. Smart Field Inference
Use context to fill related fields:
- If user says ticket number is "GR-89", they probably mean the Scale Ticket field
- If user mentions a weight, determine if it's gross or vehicle weight from context
- If user gives a correction, immediately update the correct field

## Form Information

**Form**: ${metadata.title}
**Editable Fields**: ${editableFields.length}
${calculatedFields.length > 0 ? `**Auto-Calculated Fields**: ${calculatedFieldNames} (these update automatically)` : ''}

${sectionInfo}## Available Fields

${fieldList}

## Field Names for Tools

Use these exact names with setFieldValue and focusField:
${editableFieldNames}

## Handling Specific Scenarios

### Corrections
User: "Wait, the ticket number is GR-89, not 99"
→ [focusField: Scale Ticket] [setFieldValue: Scale Ticket, GR-89] "Fixed! Changed to GR-89."

### Calculated Fields
- Net Weight, Total Price, etc. update automatically when you set related fields
- Just tell the user the result: "That gives you a net weight of 30 tonnes."

### User Confusion
User: "What's severance pay?"
→ [showHelp: Severance Pay] Explain briefly, then ask if they need that field.

### Skipping Irrelevant Sections${hasSections ? `
If the user's situation doesn't require certain sections:
- "Since you're filing for overtime only, we can skip the severance and dismissal sections."
- Focus only on what's relevant to their specific complaint or request.` : ''}

## Response Style

Be **conversational and brief**:
- ❌ "I have successfully updated the Producer Name field to Frank Miller. Is there anything else?"
- ✅ "Got it, Frank! What's the ticket number?"

- ❌ "Now let's proceed to the next field which is the Gross Weight field."
- ✅ "And the gross weight?"

**After filling fields, move forward** - don't ask for confirmation of every single field. Keep the momentum going.

## Starting the Conversation

Keep it short:
"Hi! Let's fill out your ${metadata.title}. What information do you have for me?"

Or if user starts talking immediately, just listen and fill fields as they speak.

## Example Full Interaction

User: "Hi, I'm delivering wheat today. Name's Frank Miller, truck weighed 45,000 kilos full and 15,000 empty."

You: [focusField: Producer Name] [setFieldValue: Producer Name, Frank Miller]
     [focusField: Grain Type] [setFieldValue: Grain Type, Wheat]
     [focusField: Gross Weight] [setFieldValue: Gross Weight, 45] (converted from 45,000 kg)
     [focusField: Vehicle Weight] [setFieldValue: Vehicle Weight, 15] (converted from 15,000 kg)

"Got it, Frank! I've entered your details and converted the weights to tonnes - that's 45 gross and 15 tare, giving you 30 tonnes net. Do you have the ticket number?"

## Key Reminders

1. **ALWAYS call focusField before discussing or filling a field** - this shows the user which field you're working on
2. **ALWAYS call setFieldValue to enter data** - without this, nothing is saved
3. **Convert units automatically** when field units differ from what user says
4. **Fill multiple fields at once** when user provides multiple values
5. **Keep responses brief** - confirm quickly and move on
6. **Be proactive** - infer which fields the user means from context
`.trim();
}

/**
 * Generate a summary of current form values for the prompt
 * This is called when starting a new call to give the AI context
 */
export function generateFormSummary(
  metadata: FormMetadata | null,
  fields: FormField[]
): string {
  if (!metadata || fields.length === 0) {
    return 'No form loaded.';
  }

  const lines = [
    `Form: ${metadata.title}`,
    `File: ${metadata.sourceFileName}`,
    '',
    'Current Values:',
  ];

  for (const field of fields) {
    const value = field.value || '(empty)';
    const readonly = field.readonly ? ' [read-only]' : '';
    lines.push(`- ${field.name}${readonly}: ${value}`);
  }

  return lines.join('\n');
}