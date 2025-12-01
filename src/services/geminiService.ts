import type { GeminiFieldEnhancement, FieldType } from '../store/types';
import type { PageEnhancementResult } from './enhancementCache';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent';

/**
 * Comprehensive prompt for Gemini to analyze form fields
 * This prompt instructs the model to use both the PDF image and field names
 * to generate enhanced metadata for the voice assistant
 */
const FORM_ANALYSIS_PROMPT = `
# Form Field Analysis for Voice Assistant

You are analyzing a PDF form to generate enhanced metadata for a voice-assisted form filling application. This application helps seniors fill out government and business forms using voice commands.

## Your Task

Analyze the provided PDF form image and the list of extracted field names. For each field, provide enhanced metadata that will help a voice assistant guide users through filling out the form.

## Field Types

Assign one of these semantic types to each field:

| Type | Use For | Example |
|------|---------|---------|
| text | General text input | Names, descriptions, notes |
| number | Plain numeric values | Quantities, counts, IDs |
| weight | Weight measurements | Gross weight, net weight, tare |
| currency | Monetary values | Prices, totals, fees |
| percentage | Percentage values | Tax rate, dockage, discount |
| date | Date values | Issue date, delivery date |
| reference | IDs and codes | Receipt #, ticket #, contract ref |
| grade | Classifications | Grain grade, quality rating |
| selection | ONLY for dropdowns with 3+ VISIBLE PREDEFINED choices | Province dropdown (with explicit list), Payment method |
| boolean | Yes/No questions (2 options only) | "Temporary foreign worker? Yes/No", "Still employed? Yes/No" |
| checkbox | Single consent/agreement checkbox | "I agree to terms", "Declaration of truthfulness" |
| phone | Phone/telephone numbers | Telephone, Fax, Contact number |
| email | Email addresses | Contact email, Business email |
| postalcode | Postal/ZIP codes | Canadian postal code (A1A 1A1), US ZIP |
| address | Multi-line addresses | Producer address, delivery location |
| calculated | Auto-computed fields | Net = Gross - Tare (mark readonly) |
| ignore | Skip these entirely | undefined_*, signatures, internal fields |

### CRITICAL: Selection and Boolean Type Rules

**Selection type (3+ options):**
- ONLY use when the PDF shows 3 or more FIXED choices
- You MUST provide the "options" array with all valid choices
- If options are unknown, use "text" instead

**Boolean type (Yes/No questions):**
- Use for questions with exactly 2 choices: Yes/No, True/False
- The UI will render a toggle switch
- Store value as "true" or "false"

**Checkbox type (consent/agreement):**
- Use for single checkboxes for consent/agreement
- Store value as "true" (checked) or "false" (unchecked)

❌ WRONG - Selection without options (WILL BREAK THE UI):
\`\`\`json
{
  "id": "Province",
  "type": "selection",
  "options": null
}
\`\`\`

✅ CORRECT - Selection WITH options (3+ choices):
\`\`\`json
{
  "id": "Province",
  "type": "selection",
  "options": ["Alberta", "British Columbia", "Manitoba", "Ontario", "Quebec", "Saskatchewan"]
}
\`\`\`

✅ CORRECT - Boolean for Yes/No question:
\`\`\`json
{
  "id": "Temporary Foreign Worker",
  "type": "boolean",
  "description": "Are you a temporary foreign worker?"
}
\`\`\`

✅ CORRECT - Checkbox for consent:
\`\`\`json
{
  "id": "Declaration of Truthfulness",
  "type": "checkbox",
  "description": "I declare that the information provided is true and complete."
}
\`\`\`

✅ CORRECT - Phone for telephone numbers:
\`\`\`json
{
  "id": "Telephone",
  "type": "phone",
  "description": "Your telephone number in (999) 999-9999 format"
}
\`\`\`

**When in doubt, use "text" instead of "selection".**

## Output Format

Respond with a valid JSON object in this exact structure:

{
  "formTitle": "Human-readable form title based on the document",
  "formDescription": "Brief description of the form's purpose",
  "sections": [
    {
      "id": "section_a",
      "title": "Section A - Your Personal and Work Information",
      "description": "Information about you and your employment",
      "order": 0
    }
  ],
  "fields": [
    {
      "id": "exact_field_id_from_input",
      "displayName": "Human-Friendly Name (NO units - units go in 'unit' field)",
      "type": "one of the types above",
      "description": "Voice prompt description for the user. Be clear and include format hints.",
      "sectionId": "section_a (reference to a section id, or null if ungrouped)",
      "unit": "kg, tonnes, CAD, % (or null if not applicable)",
      "format": "yyyy-mm-dd (or null if not applicable)",
      "options": ["option1", "option2"] (REQUIRED if type is "selection", otherwise null),
      "calculationHint": "Human-readable description of calculation (for display)",
      "formula": "{Field A} - {Field B} (parseable formula for calculated fields)",
      "required": true/false,
      "readonly": true/false,
      "ignore": true/false
    }
  ],
  "ignoredFields": ["field_id_1", "field_id_2"]
}

## Guidelines

1. **Display Names**: Create clear, human-friendly names. **DO NOT include units in the display name** - units are shown separately in the UI.
   - "Gross weight" → "Gross Weight" (NOT "Gross Weight (tonnes)")
   - "Price per net tonne" → "Price Per Tonne" (NOT "Price Per Net Tonne (CAD)")
   - "Date of issue yyyymmdd" → "Date of Issue" (remove format hints)
   - "Levy deductible" → "Levy Deductible"

2. **Descriptions**: Write descriptions that a voice assistant will read aloud. Be clear and helpful.
   - Include format requirements (e.g., "in year-month-day format")
   - Mention units (e.g., "in tonnes" or "in Canadian dollars")
   - Explain what the field is for if not obvious
   - Units should be mentioned in descriptions for voice context, but NOT in displayName

3. **Identify Ignored Fields**: Mark these fields as ignore: true
   - Fields named "undefined" followed by numbers (undefined_3, undefined_4)
   - Signature fields
   - Internal/system fields not meant for user input
   - Any field that appears decorative or non-functional

4. **Calculated Fields**: For fields that are computed from other fields:
   - type: "calculated"
   - readonly: true
   - calculationHint: Human-readable description (e.g., "Gross Weight minus Vehicle Weight")
   - formula: Parseable formula using field IDs in curly braces

   **IMPORTANT: Formula Syntax**
   - Reference fields using their EXACT ID in curly braces: {Field ID}
   - Supported operators: + (add), - (subtract), * (multiply), / (divide)
   - Use parentheses for grouping: ({A} - {B}) * {C}
   - Numbers are allowed: {A} / 1000
   
   Examples:
   - Net weight: formula = "{Gross weight} - {Vehicle weight}"
   - Total price: formula = "({Net weight} / 1000) * {Price per net tonne}"
   - Net payable: formula = "{Total purchase price} - {Levy deductible}"
   - Adjusted weight: formula = "{Net weight} * (1 - {Dockage} / 100)"

5. **Required Fields**: Mark fields as required if they seem essential to the form's purpose.

6. **Look at the PDF Image**: Use visual context from the PDF to:
   - Identify labels that may not be in the field names
   - Understand the form's overall purpose
   - Determine units from column headers or labels
   - Identify which fields are likely required
   - Identify section headers and group fields into sections

## Section Detection

Many government forms are organized into sections (e.g., "Section A - Personal Information", "Part 1 - Applicant Details").
Analyze the PDF to identify these sections and assign each field to the appropriate section.

### Section Guidelines

1. **Look for visual section headers** in the PDF:
   - Bold text with section labels
   - Background colors or borders separating sections
   - Numbered or lettered sections (Section A, Part 1, I., etc.)

2. **Section ID format**: Use lowercase with underscores (e.g., "section_a", "personal_info", "employer_details")

3. **Order**: Assign order numbers starting from 0, based on how sections appear in the document

4. **If no clear sections exist**:
   - Leave the sections array empty: \`"sections": []\`
   - Leave sectionId as null for all fields
   - Do NOT create artificial groupings

5. **Every field in a sectioned form should have a sectionId** that references a valid section

### Section Example

For a form with "Section A - Personal Information" and "Section B - Employer Information":

\`\`\`json
{
  "sections": [
    {
      "id": "section_a",
      "title": "Section A - Your Personal and Work Information",
      "description": "Information about you, your employment dates, and job details",
      "order": 0
    },
    {
      "id": "section_b",
      "title": "Section B - Employer Information",
      "description": "Details about your employer and workplace",
      "order": 1
    }
  ],
  "fields": [
    {
      "id": "Last/Family name",
      "displayName": "Last Name",
      "type": "text",
      "sectionId": "section_a",
      ...
    },
    {
      "id": "Employer name",
      "displayName": "Employer Name",
      "type": "text",
      "sectionId": "section_b",
      ...
    }
  ]
}
\`\`\`

## Example Field Analyses

For "Gross weight" in a grain receipt:
{
  "id": "Gross weight",
  "displayName": "Gross Weight",
  "type": "weight",
  "description": "The total weight of the vehicle when fully loaded with grain. Please provide the weight in tonnes, as shown on the scale ticket.",
  "unit": "tonnes",
  "format": null,
  "options": null,
  "calculationHint": null,
  "formula": null,
  "required": true,
  "readonly": false,
  "ignore": false
}

For "Date of issue yyyymmdd":
{
  "id": "Date of issue yyyymmdd",
  "displayName": "Date of Issue",
  "type": "date",
  "description": "The date this receipt is being issued. Please provide the date in year-month-day format, for example, 2024-11-20.",
  "unit": null,
  "format": "yyyy-mm-dd",
  "options": null,
  "calculationHint": null,
  "formula": null,
  "required": true,
  "readonly": false,
  "ignore": false
}

For "Net weight" (calculated):
{
  "id": "Net weight",
  "displayName": "Net Weight",
  "type": "calculated",
  "description": "The weight of the grain after subtracting the vehicle weight. This is calculated automatically.",
  "unit": "tonnes",
  "format": null,
  "options": null,
  "calculationHint": "Gross Weight minus Vehicle Weight",
  "formula": "{Gross weight} - {Vehicle weight}",
  "required": false,
  "readonly": true,
  "ignore": false
}

For "Total purchase price" (calculated):
{
  "id": "Total purchase price",
  "displayName": "Total Purchase Price",
  "type": "calculated",
  "description": "The total value of the grain delivery. This is calculated automatically based on net weight and price.",
  "unit": "CAD",
  "format": null,
  "options": null,
  "calculationHint": "Net weight (in tonnes) times price per tonne",
  "formula": "({Net weight} / 1000) * {Price per net tonne}",
  "required": false,
  "readonly": true,
  "ignore": false
}

For "undefined_3":
{
  "id": "undefined_3",
  "displayName": "Undefined Field",
  "type": "ignore",
  "description": "This field should be skipped.",
  "unit": null,
  "format": null,
  "options": null,
  "calculationHint": null,
  "formula": null,
  "required": false,
  "readonly": false,
  "ignore": true
}

Now analyze the following form:
`.trim();

/**
 * Request structure for Gemini API
 */
interface GeminiRequest {
  contents: Array<{
    parts: Array<{
      text?: string;
      inline_data?: {
        mime_type: string;
        data: string;
      };
    }>;
  }>;
  generationConfig: {
    responseMimeType: string;
    temperature?: number;
    maxOutputTokens?: number;
  };
}

/**
 * Response structure from Gemini API
 */
interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
    finishReason?: string;
  }>;
  error?: {
    message: string;
    code: number;
  };
}

/**
 * Convert Uint8Array to base64 string
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Validate and clean the Gemini response
 */
function validateAndCleanResponse(data: unknown): GeminiFieldEnhancement {
  const response = data as GeminiFieldEnhancement;
  
  // Ensure required fields exist
  if (!response.formTitle) {
    response.formTitle = 'Untitled Form';
  }
  if (!response.formDescription) {
    response.formDescription = 'A fillable PDF form';
  }
  if (!Array.isArray(response.fields)) {
    response.fields = [];
  }
  if (!Array.isArray(response.ignoredFields)) {
    response.ignoredFields = [];
  }
  
  // Validate and clean sections
  if (!Array.isArray(response.sections)) {
    response.sections = [];
  } else {
    response.sections = response.sections.map((section, index) => ({
      id: section.id || `section_${index}`,
      title: section.title || `Section ${index + 1}`,
      description: section.description || undefined,
      order: typeof section.order === 'number' ? section.order : index,
    }));
  }
  
  // Create a set of valid section IDs for validation
  const validSectionIds = new Set(response.sections.map(s => s.id));
  
  // Validate and clean each field
  response.fields = response.fields.map(field => {
    // Check if options are valid for selection type
    const hasValidOptions = Array.isArray(field.options) && field.options.length > 0;
    const rawType = validateFieldType(field.type);
    
    // CRITICAL: If type is "selection" but no valid options, convert to "text"
    // This prevents broken dropdowns in the UI
    let effectiveType = rawType;
    if (rawType === 'selection' && !hasValidOptions) {
      console.warn(`[Gemini Validation] Field "${field.id}" has type "selection" but no options - converting to "text"`);
      effectiveType = 'text';
    }
    
    // Validate sectionId - only keep if it references a valid section
    const sectionId = field.sectionId && validSectionIds.has(field.sectionId)
      ? field.sectionId
      : undefined;
    
    return {
      id: field.id || '',
      displayName: field.displayName || field.id || 'Unknown Field',
      type: effectiveType,
      description: field.description || `Please provide the value for ${field.displayName || field.id}`,
      sectionId,
      unit: field.unit || undefined,
      format: field.format || undefined,
      // Only include options if type is selection AND options are valid
      options: (effectiveType === 'selection' && hasValidOptions) ? field.options : undefined,
      calculationHint: field.calculationHint || undefined,
      formula: field.formula || undefined,
      required: Boolean(field.required),
      readonly: Boolean(field.readonly),
      ignore: Boolean(field.ignore),
    };
  });
  
  return response;
}

/**
 * Validate field type, defaulting to 'text' if invalid
 */
function validateFieldType(type: unknown): FieldType {
  const validTypes: FieldType[] = [
    'text', 'number', 'weight', 'currency', 'percentage',
    'date', 'reference', 'grade', 'selection', 'boolean',
    'checkbox', 'phone', 'email', 'postalcode', 'address',
    'signature', 'calculated', 'ignore'
  ];
  
  if (typeof type === 'string' && validTypes.includes(type as FieldType)) {
    return type as FieldType;
  }
  
  return 'text';
}

/**
 * Analyze a PDF form using Gemini Flash with vision capabilities
 *
 * @param pdfBytes - The raw PDF bytes (used for AcroForms, ignored for XFA)
 * @param fieldNames - List of field names extracted from the PDF
 * @param pageImages - Optional rendered page images (base64 PNG) - REQUIRED for XFA forms
 * @param isXFA - Whether this is an XFA form (determines whether to send PDF or images)
 * @returns Enhanced field metadata from Gemini
 */
export async function analyzeFormWithGemini(
  pdfBytes: Uint8Array,
  fieldNames: string[],
  pageImages?: string[],
  isXFA: boolean = false
): Promise<GeminiFieldEnhancement> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error('VITE_GEMINI_API_KEY is not configured');
  }
  
  // Build the prompt with field names
  const fieldListText = fieldNames.map(name => `- "${name}"`).join('\n');
  
  // Build the parts array - start with the text prompt
  const parts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }> = [];
  
  // Decide whether to use images (for XFA) or PDF (for AcroForms)
  const useImagesOnly = isXFA && pageImages && pageImages.length > 0;
  
  if (useImagesOnly) {
    // For XFA forms: Use rendered page images since Gemini can't parse XFA PDFs
    console.log(`[Gemini] XFA form detected - using ${pageImages!.length} rendered page images instead of PDF`);
    
    const imageNote = `\n\n## Visual Context\nThis is an XFA (XML Forms Architecture) form. I'm providing ${pageImages!.length} rendered page image(s) showing the form layout. Use these images to understand the visual structure, identify field labels, and determine the purpose of each field.`;
    
    parts.push({
      text: `${FORM_ANALYSIS_PROMPT}\n\n## Field Names Extracted from PDF:\n${fieldListText}${imageNote}`
    });
    
    // Add all page images
    for (let i = 0; i < pageImages!.length; i++) {
      parts.push({
        inline_data: {
          mime_type: 'image/png',
          data: pageImages![i]
        }
      });
    }
  } else if (pageImages && pageImages.length > 0) {
    // For AcroForms with page images: Use both PDF and images for best results
    console.log(`[Gemini] Including PDF and ${pageImages.length} page images for visual analysis`);
    
    const base64PDF = uint8ArrayToBase64(pdfBytes);
    const imageNote = `\n\n## Additional Context\nI'm also providing ${pageImages.length} rendered page image(s) of the PDF form for additional visual context.`;
    
    parts.push({
      text: `${FORM_ANALYSIS_PROMPT}\n\n## Field Names Extracted from PDF:\n${fieldListText}${imageNote}`
    });
    
    parts.push({
      inline_data: {
        mime_type: 'application/pdf',
        data: base64PDF
      }
    });
    
    // Add page images
    for (let i = 0; i < pageImages.length; i++) {
      parts.push({
        inline_data: {
          mime_type: 'image/png',
          data: pageImages[i]
        }
      });
    }
  } else {
    // For AcroForms without page images: Use PDF only
    console.log(`[Gemini] Using PDF only for analysis (no page images provided)`);
    
    const base64PDF = uint8ArrayToBase64(pdfBytes);
    
    parts.push({
      text: `${FORM_ANALYSIS_PROMPT}\n\n## Field Names Extracted from PDF:\n${fieldListText}`
    });
    
    parts.push({
      inline_data: {
        mime_type: 'application/pdf',
        data: base64PDF
      }
    });
  }
  
  // Construct the request
  const request: GeminiRequest = {
    contents: [{
      parts
    }],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0, // Low temperature for more consistent output
      maxOutputTokens: 65536, // Ensure we get complete responses for large forms
    }
  };
  
  // Make the API call
  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error('Gemini API error response:', errorText);
    throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
  }
  
  const result: GeminiResponse = await response.json();
  
  // Check for API-level errors
  if (result.error) {
    throw new Error(`Gemini API error: ${result.error.message}`);
  }
  
  // Extract the JSON content from the response
  const content = result.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!content) {
    throw new Error('No content in Gemini response');
  }
  
  // Parse and validate the JSON response
  try {
    const parsed = JSON.parse(content);
    return validateAndCleanResponse(parsed);
  } catch (parseError) {
    console.error('Failed to parse Gemini response:', content);
    throw new Error('Failed to parse Gemini response as JSON');
  }
}

/**
 * Check if Gemini API is configured
 */
export function isGeminiConfigured(): boolean {
  return Boolean(import.meta.env.VITE_GEMINI_API_KEY);
}

// ============================================================================
// PAGE-SPECIFIC ANALYSIS
// ============================================================================

/**
 * Generate a page-specific prompt for Gemini
 * The model sees the FULL PDF for context but only outputs fields for the target page
 */
function generatePageSpecificPrompt(
  targetPage: number,
  fieldIdsOnPage: string[],
  totalPages: number
): string {
  const fieldList = fieldIdsOnPage.map(id => `- "${id}"`).join('\n');
  
  return `
# Form Field Analysis for Voice Assistant - PAGE ${targetPage} ONLY

You are analyzing a ${totalPages}-page PDF form. You can see the ENTIRE document for context, but you must ONLY output analysis for the fields that appear on PAGE ${targetPage}.

## CRITICAL INSTRUCTIONS

1. **Look at the ENTIRE PDF** to understand the form's structure, purpose, and section organization
2. **BUT ONLY OUTPUT** JSON for the specific fields listed below (they are on page ${targetPage})
3. If a section header appears on a previous page but the fields continue on this page, include that section in your output
4. Do NOT include fields from other pages in your output

## Field IDs on Page ${targetPage} (ONLY analyze these)

${fieldList}

${FORM_ANALYSIS_PROMPT}

Remember: Your output MUST only include the ${fieldIdsOnPage.length} fields listed above. Do not include any fields from other pages.
`.trim();
}

/**
 * Analyze a specific page of a PDF form using Gemini Flash
 * The model receives the full PDF for context but only outputs analysis for the target page
 *
 * @param pdfBytes - The raw PDF bytes (full document for context)
 * @param pageImages - Rendered page images (all pages for context)
 * @param targetPage - The specific page number to analyze (1-indexed)
 * @param fieldIdsOnPage - List of field IDs that appear on this page
 * @param totalPages - Total number of pages in the document
 * @param isXFA - Whether this is an XFA form
 * @returns Enhanced field metadata for the target page only
 */
export async function analyzeFormPageWithGemini(
  pdfBytes: Uint8Array,
  pageImages: string[],
  targetPage: number,
  fieldIdsOnPage: string[],
  totalPages: number,
  isXFA: boolean = false
): Promise<PageEnhancementResult> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error('VITE_GEMINI_API_KEY is not configured');
  }
  
  // Build the page-specific prompt
  const prompt = generatePageSpecificPrompt(targetPage, fieldIdsOnPage, totalPages);
  
  // Build the parts array
  const parts: Array<{ text?: string; inline_data?: { mime_type: string; data: string } }> = [];
  
  // Decide whether to use images (for XFA) or PDF (for AcroForms)
  const useImagesOnly = isXFA && pageImages.length > 0;
  
  if (useImagesOnly) {
    // For XFA forms: Use rendered page images
    console.log(`[Gemini Page ${targetPage}] XFA form - using ${pageImages.length} page images`);
    
    parts.push({ text: prompt });
    
    // Add all page images for context
    for (let i = 0; i < pageImages.length; i++) {
      parts.push({
        inline_data: {
          mime_type: 'image/png',
          data: pageImages[i]
        }
      });
    }
  } else if (pageImages.length > 0) {
    // For AcroForms with images: Use both PDF and images
    console.log(`[Gemini Page ${targetPage}] Using PDF + ${pageImages.length} page images`);
    
    const base64PDF = uint8ArrayToBase64(pdfBytes);
    
    parts.push({ text: prompt });
    
    parts.push({
      inline_data: {
        mime_type: 'application/pdf',
        data: base64PDF
      }
    });
    
    // Add page images for additional context
    for (let i = 0; i < pageImages.length; i++) {
      parts.push({
        inline_data: {
          mime_type: 'image/png',
          data: pageImages[i]
        }
      });
    }
  } else {
    // PDF only
    console.log(`[Gemini Page ${targetPage}] Using PDF only`);
    
    const base64PDF = uint8ArrayToBase64(pdfBytes);
    
    parts.push({ text: prompt });
    
    parts.push({
      inline_data: {
        mime_type: 'application/pdf',
        data: base64PDF
      }
    });
  }
  
  // Construct the request
  const request: GeminiRequest = {
    contents: [{
      parts
    }],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0,
      maxOutputTokens: 65536, // Page-level responses are smaller
    }
  };
  
  // Make the API call
  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request)
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Gemini Page ${targetPage}] API error:`, errorText);
    throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
  }
  
  const result: GeminiResponse = await response.json();
  
  // Check for API-level errors
  if (result.error) {
    throw new Error(`Gemini API error: ${result.error.message}`);
  }
  
  // Extract the JSON content from the response
  const content = result.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!content) {
    throw new Error(`No content in Gemini response for page ${targetPage}`);
  }
  
  // Parse and validate the JSON response
  try {
    const parsed = JSON.parse(content);
    const validated = validateAndCleanResponse(parsed);
    
    // Filter to only include fields that were requested for this page
    const pageFields = validated.fields.filter(f => fieldIdsOnPage.includes(f.id));
    
    // Log if we got unexpected fields
    if (validated.fields.length !== pageFields.length) {
      console.warn(
        `[Gemini Page ${targetPage}] Filtered ${validated.fields.length - pageFields.length} unexpected fields`
      );
    }
    
    return {
      pageNumber: targetPage,
      fields: pageFields,
      sections: validated.sections || [],
    };
  } catch (parseError) {
    console.error(`[Gemini Page ${targetPage}] Failed to parse response:`, content);
    throw new Error(`Failed to parse Gemini response for page ${targetPage}`);
  }
}