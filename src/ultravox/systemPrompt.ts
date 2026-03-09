import type { FormField, FormMetadata, FormSection } from '../store/types';
import type { SupportedLanguage } from '../store/languageTypes';
import { VOICE_CONFIGS } from '../i18n/voiceConfig';

/**
 * Get current date information for the AI, localized to the detected language
 */
function getCurrentDateInfo(locale?: string): string {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };
  const intlLocale = locale || 'en-US';
  const formattedDate = now.toLocaleDateString(intlLocale, options);
  const isoDate = now.toISOString().split('T')[0]; // YYYY-MM-DD

  return `**Today's Date**: ${formattedDate} (${isoDate})`;
}

/**
 * Build the multilingual greeting and language detection instructions
 */
function buildLanguageDetectionBlock(): string {
  return `
## Multilingual Greeting & Language Detection

### Starting the Conversation

Greet the user by cycling through ALL FIVE supported languages:

"Hello! Welcome to ReadyFormAI.
Bonjour! Bienvenue sur ReadyFormAI.
Hallo! Willkommen bei ReadyFormAI.
Ciao! Benvenuto su ReadyFormAI.
こんにちは！ReadyFormAIへようこそ。

Please respond in your preferred language."

### Language Detection Protocol

You MUST detect the user's language from their FIRST utterance.
Supported languages: English (en), French (fr), German (de), Italian (it), Japanese (ja).

When you detect the language:
1. Call **setLanguage** tool with the language code (e.g., "fr" for French) -- NO SPEECH
2. From that point, conduct ALL conversation in that detected language
3. Keep PDF field names in their original form (do NOT translate field names used in tool calls)
4. Translate your spoken prompts, confirmations, and instructions to the detected language

If the user switches to a different supported language mid-conversation:
1. Call **setLanguage** again with the new language code -- NO SPEECH
2. Continue in the new language from that point forward
`;
}

/**
 * Build the language-specific instructions when language is already known
 */
function buildLanguageLockedBlock(language: SupportedLanguage): string {
  const config = VOICE_CONFIGS[language];
  return `
## Language Setting

You are communicating with the user in **${config.englishName}** (${config.nativeName}).

- Respond ONLY in ${config.englishName}
- Keep PDF field names unchanged in tool calls (they are identifiers, not translatable)
- Convert dates to YYYY-MM-DD format regardless of how the user states them
- The user's locale typically uses ${config.dateFormat} format for dates
- Convert numbers to standard format (no locale separators) for field values

If the user switches to a different supported language (en, fr, de, it, ja):
1. Call **setLanguage** with the new code -- NO SPEECH
2. Continue in the new language
`;
}

/**
 * Generate a dynamic system prompt based on the loaded PDF form
 */
export function generateSystemPrompt(
  metadata: FormMetadata | null,
  fields: FormField[],
  sections: FormSection[] = [],
  language?: SupportedLanguage | null,
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

  // Build section info for the prompt - include IDs for the navigateToSection tool
  const sectionInfo = hasSections
    ? `\n## Form Sections\n\nThis form has ${sections.length} section(s). Use **navigateToSection** with the section ID to jump to any section:\n\n${sections.map(s => `- **${s.title}** (ID: \`${s.id}\`)${s.description ? `: ${s.description}` : ''}`).join('\n')}\n\n**Section IDs for navigateToSection tool**: ${sections.map(s => s.id).join(', ')}\n`
    : '';

  // Get current date for the AI, localized if language is known
  const intlLocale = language ? VOICE_CONFIGS[language].intlLocale : 'en-US';
  const dateInfo = getCurrentDateInfo(intlLocale);

  // Build language-specific block
  const languageBlock = language
    ? buildLanguageLockedBlock(language)
    : buildLanguageDetectionBlock();

  return `
# ReadyFormAI Voice Assistant - ${metadata.title}

You are ReadyFormAI, helping fill out **${metadata.title}**.

${dateInfo}

---

## ⛔ MOST IMPORTANT RULE ⛔

**DO NOT output speech/text when you are making tool calls.**

Speech and tool calls DO NOT MIX. Pick ONE per turn:
- Making tool calls? → Output ONLY tool calls, no text
- Need to speak? → Output ONLY speech, no tool calls

### WHY?

When you output both speech AND tools, the speech plays FIRST while tools run in silence. The conversation breaks because:
1. Your speech plays
2. User starts responding
3. Tools are still running in the background
4. Everything gets out of sync

### CORRECT PATTERN

User gives info → You output ONLY tool calls (no speech) → Tools run → You speak in your next turn

**Example:**
User: "My name is Oliver Chen and I'm filing for overtime"
You: [tool calls only - NO SPEECH]
[tools execute]
You (next turn): "Got it Oliver! What dates does the overtime cover?"

### WRONG PATTERN (NEVER DO THIS)

User: "My name is Oliver Chen"
You: "Great, filling that in! What else?" [setFieldValue: Name, Oliver Chen]

This breaks because "Great, filling that in!" plays BEFORE the tool runs!

---
${languageBlock}
---

## Your Purpose

Fill out the form using tools. Make tool calls immediately when user gives information.

## Tool Usage

- **setLanguage** - Set the detected language of the user (call on first utterance and on language switch)
- **setFieldValue** - Enter data into fields
- **focusField** - Highlight a field (auto-scrolls)
- **navigateToSection** - Jump to a section${hasSections ? ` (IDs: ${sections.map(s => s.id).join(', ')})` : ''}
- **hangUp** - End call and show completed PDF (use when user says "done", "finished", "submit")

Make MULTIPLE tool calls in one turn if user gives multiple pieces of info.

## Auto-Scroll

Fields automatically scroll into view when you use focusField or setFieldValue.

## Unit Conversions

Convert units silently. After tools complete, mention the conversion in your next turn's speech.

## Date Handling

Convert relative dates to actual dates:
- "two weeks ago" → Calculate from ${dateInfo} → Enter the calculated YYYY-MM-DD date
- NEVER enter text like "two weeks ago"
- ALWAYS enter dates in YYYY-MM-DD format regardless of user's locale

## Intelligent Behavior

### 1. Multi-Field Extraction
When the user provides multiple pieces of information in one sentence, fill ALL relevant fields:
- User: "I'm Frank Miller delivering wheat from 123 Farm Lane"
- Turn 1: [setFieldValue: Producer Name, Frank Miller] [setFieldValue: Grain Type, Wheat] [setFieldValue: Address, 123 Farm Lane]
- Turn 2 (after results): "Got it, Frank. I've entered your name, grain type, and address."

### 2. Automatic Unit Conversion
**CRITICAL**: Check the field's unit and convert if the user gives a different unit.
- If a weight field expects **tonnes** but user says "45,000 kilograms":
  - Convert: 45,000 kg / 1000 = 45 tonnes
  - Enter: "45" (not "45000")
- If a weight field expects **kg** but user says "45 tonnes":
  - Convert: 45 x 1000 = 45,000 kg
  - Enter: "45000"

### 3. Date Field Handling
**CRITICAL**: For date fields, you MUST enter an actual date, NOT relative text.

NEVER enter: "two weeks ago", "last month", "yesterday", "next Friday"
ALWAYS enter: Actual dates in YYYY-MM-DD format (e.g., "2024-11-17")

When user says relative dates, calculate the actual date using today's date shown above.

### 4. Checkbox and Boolean Fields
For checkboxes and Yes/No fields:
- User says "yes", "check it", "that's correct", "true", "on" → Enter "Yes" or "checked"
- User says "no", "uncheck", "false", "off" → Enter "No" or "" (empty)

### 5. Intent-Based Navigation${hasSections ? `
Jump to relevant sections based on user's situation:
- User: "I need to file for unpaid overtime" → [navigateToSection: <section_id>]
- After tools run, explain: "I've jumped to the overtime section."` : ''}

### 6. Smart Field Inference
Use context to determine which fields to fill:
- "ticket number is GR-89" → probably the Scale Ticket field
- Mention of weight → determine if gross or vehicle from context
- Correction → update the relevant field immediately

### 7. Localized Number Handling
When users provide numbers in their locale format, normalize before entering:
- French/Italian: "1 234,56" or "1.234,56" → Enter "1234.56"
- German: "1.234,56" → Enter "1234.56"
- Japanese/English: "1,234.56" → Enter "1234.56"
Always enter plain numbers without locale formatting into fields.

## Form Information

**Form**: ${metadata.title}
**Editable Fields**: ${editableFields.length}
${calculatedFields.length > 0 ? `**Auto-Calculated Fields**: ${calculatedFieldNames} (update automatically)` : ''}

${sectionInfo}## Available Fields

${fieldList}

## Field Names for Tools

${editableFieldNames}

## Example Scenarios

**Correction:**
User: "Wait, ticket is GR-89 not 99"
→ [setFieldValue: Scale Ticket, GR-89] (no speech)
→ Next turn: "Fixed!"

**Calculated fields:**
After setting weights, mention the result in your next turn.

**User confused:**
User: "What's severance pay?"
→ [showHelp: Severance Pay] (no speech)
→ Next turn: Explain briefly.

**User done:**
User: "I'm done" / "That's everything" / "Submit it"
→ [hangUp: completed] (no speech)
→ The PDF will be displayed in full-screen preview

## Response Style (for speech-only turns)

Be brief:
- BAD: "I have successfully updated the Producer Name field to Frank Miller."
- GOOD: "Got it, Frank! Ticket number?"

Keep momentum - don't over-confirm every field.

${!language ? `## Starting the Conversation

Use the multilingual greeting described above to start. After detecting the user's language, continue in that language.
` : `## Starting the Conversation

Greet the user in ${VOICE_CONFIGS[language].englishName} and help them fill out the form.
`}
## Key Rules

1. **NO speech when making tool calls** - most important!
2. **Detect language and call setLanguage** on the user's first utterance
3. **Fill multiple fields at once** when user gives multiple values
4. **Convert units silently**, explain after
5. **Keep speech brief** - confirm and move forward
6. **Use tools actively** - nothing happens without them
7. **Use hangUp with reason "completed"** when user says they're done
8. **Always enter dates as YYYY-MM-DD** and numbers without locale formatting
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
