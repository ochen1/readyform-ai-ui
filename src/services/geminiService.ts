import type { GeminiFieldEnhancement, FieldType } from '../store/types';

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent';

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
| selection | Predefined choices | Grain type, payment method |
| address | Multi-line addresses | Producer address, delivery location |
| calculated | Auto-computed fields | Net = Gross - Tare (mark readonly) |
| ignore | Skip these entirely | undefined_*, signatures, internal fields |

## Output Format

Respond with a valid JSON object in this exact structure:

{
  "formTitle": "Human-readable form title based on the document",
  "formDescription": "Brief description of the form's purpose",
  "fields": [
    {
      "id": "exact_field_id_from_input",
      "displayName": "Human-Friendly Name (with units if applicable)",
      "type": "one of the types above",
      "description": "Voice prompt description for the user. Be clear and include format hints.",
      "unit": "kg, tonnes, $CAD, % (or null if not applicable)",
      "format": "yyyy-mm-dd (or null if not applicable)",
      "options": ["option1", "option2"] (or null if not a selection type),
      "calculationHint": "How this is calculated (for calculated type, or null)",
      "required": true/false,
      "readonly": true/false,
      "ignore": true/false
    }
  ],
  "ignoredFields": ["field_id_1", "field_id_2"]
}

## Guidelines

1. **Display Names**: Create clear, human-friendly names. Include units in parentheses when applicable.
   - "Gross weight" → "Gross Weight (tonnes)"
   - "Price per net tonne" → "Price Per Net Tonne (CAD)"

2. **Descriptions**: Write descriptions that a voice assistant will read aloud. Be clear and helpful.
   - Include format requirements (e.g., "in year-month-day format")
   - Mention units (e.g., "in tonnes" or "in Canadian dollars")
   - Explain what the field is for if not obvious
   - It's OK to repeat units in both displayName AND description

3. **Identify Ignored Fields**: Mark these fields as ignore: true
   - Fields named "undefined" followed by numbers (undefined_3, undefined_4)
   - Signature fields
   - Internal/system fields not meant for user input
   - Any field that appears decorative or non-functional

4. **Calculated Fields**: If a field appears to be calculated from other fields (like Net Weight = Gross - Vehicle), mark it as:
   - type: "calculated"
   - readonly: true
   - Include the calculationHint

5. **Required Fields**: Mark fields as required if they seem essential to the form's purpose.

6. **Look at the PDF Image**: Use visual context from the PDF to:
   - Identify labels that may not be in the field names
   - Understand the form's overall purpose
   - Determine units from column headers or labels
   - Identify which fields are likely required

## Example Field Analyses

For "Gross weight" in a grain receipt:
{
  "id": "Gross weight",
  "displayName": "Gross Weight (tonnes)",
  "type": "weight",
  "description": "The total weight of the vehicle when fully loaded with grain. Please provide the weight in tonnes, as shown on the scale ticket.",
  "unit": "tonnes",
  "format": null,
  "options": null,
  "calculationHint": null,
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
  "required": true,
  "readonly": false,
  "ignore": false
}

For "Net weight" (calculated):
{
  "id": "Net weight",
  "displayName": "Net Weight (tonnes)",
  "type": "calculated",
  "description": "The weight of the grain after subtracting the vehicle weight. This is calculated automatically.",
  "unit": "tonnes",
  "format": null,
  "options": null,
  "calculationHint": "Gross Weight minus Vehicle Weight",
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
  
  // Validate and clean each field
  response.fields = response.fields.map(field => ({
    id: field.id || '',
    displayName: field.displayName || field.id || 'Unknown Field',
    type: validateFieldType(field.type),
    description: field.description || `Please provide the value for ${field.displayName || field.id}`,
    unit: field.unit || undefined,
    format: field.format || undefined,
    options: Array.isArray(field.options) ? field.options : undefined,
    calculationHint: field.calculationHint || undefined,
    required: Boolean(field.required),
    readonly: Boolean(field.readonly),
    ignore: Boolean(field.ignore),
  }));
  
  return response;
}

/**
 * Validate field type, defaulting to 'text' if invalid
 */
function validateFieldType(type: unknown): FieldType {
  const validTypes: FieldType[] = [
    'text', 'number', 'weight', 'currency', 'percentage',
    'date', 'reference', 'grade', 'selection', 'address',
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
 * @param pdfBytes - The raw PDF bytes
 * @param fieldNames - List of field names extracted from the PDF
 * @returns Enhanced field metadata from Gemini
 */
export async function analyzeFormWithGemini(
  pdfBytes: Uint8Array,
  fieldNames: string[]
): Promise<GeminiFieldEnhancement> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error('VITE_GEMINI_API_KEY is not configured');
  }
  
  // Convert PDF to base64
  const base64PDF = uint8ArrayToBase64(pdfBytes);
  
  // Build the prompt with field names
  const fieldListText = fieldNames.map(name => `- "${name}"`).join('\n');
  const fullPrompt = `${FORM_ANALYSIS_PROMPT}\n\n## Field Names Extracted from PDF:\n${fieldListText}`;
  
  // Construct the request
  const request: GeminiRequest = {
    contents: [{
      parts: [
        {
          text: fullPrompt
        },
        {
          inline_data: {
            mime_type: 'application/pdf',
            data: base64PDF
          }
        }
      ]
    }],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.2, // Low temperature for more consistent output
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