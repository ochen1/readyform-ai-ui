import type { FormField } from '../store/types';

/**
 * OpenAI function-calling tool definition
 */
export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, {
        type: string;
        description: string;
        enum?: string[];
      }>;
      required: string[];
    };
  };
}

/**
 * Static tools that don't depend on field names
 */
export const staticTools: OpenAITool[] = [
  {
    type: 'function',
    function: {
      name: 'getFormProgress',
      description: 'Get form completion progress. Returns completed/total fields and percentage.',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getFormSummary',
      description: 'Get complete form summary. Use to review all values before submission.',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'hangUp',
      description: 'End the call and show the completed PDF. Use when: user says they are done, finished, wants to submit, or explicitly requests to end the call. This displays a full-screen preview of the filled PDF.',
      parameters: {
        type: 'object',
        properties: {
          reason: {
            type: 'string',
            description: 'Reason for ending',
            enum: ['completed', 'user_requested']
          }
        },
        required: ['reason']
      }
    }
  }
];

/**
 * Generate a navigateToSection tool with section IDs from the form
 */
function generateSectionTool(sectionIds: string[]): OpenAITool | null {
  if (sectionIds.length === 0) {
    return null;
  }

  return {
    type: 'function',
    function: {
      name: 'navigateToSection',
      description: 'Scroll to and highlight a specific section of the form. Use when moving between major form sections. The form will animate smoothly to the section.',
      parameters: {
        type: 'object',
        properties: {
          sectionId: {
            type: 'string',
            description: 'The section ID to navigate to',
            enum: sectionIds
          }
        },
        required: ['sectionId']
      }
    }
  };
}

/**
 * Generate dynamic tools based on loaded form fields
 * This creates tools with enum values for the specific fields in the PDF
 */
export function generateFormTools(fields: FormField[], sectionIds: string[] = []): OpenAITool[] {
  // Get field names for enums (excluding readonly fields for setters)
  const editableFieldNames = fields
    .filter(f => !f.readonly)
    .map(f => f.name);

  const allFieldNames = fields.map(f => f.name);

  // If no fields loaded, return only static tools
  if (fields.length === 0) {
    return staticTools;
  }

  const dynamicTools: OpenAITool[] = [
    {
      type: 'function',
      function: {
        name: 'setFieldValue',
        description: 'Set a form field value. Use when user provides information. Always confirm the value afterward.',
        parameters: {
          type: 'object',
          properties: {
            fieldName: {
              type: 'string',
              description: 'Field to update (use the exact field name)',
              enum: editableFieldNames
            },
            value: {
              type: 'string',
              description: 'Value to set (always as a string)'
            }
          },
          required: ['fieldName', 'value']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'getFieldValue',
        description: 'Get current value of a form field. Use to check values before discussing them.',
        parameters: {
          type: 'object',
          properties: {
            fieldName: {
              type: 'string',
              description: 'Field to retrieve',
              enum: allFieldNames
            }
          },
          required: ['fieldName']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'focusField',
        description: 'Highlight a field in the UI. Use when discussing a specific field to help user locate it.',
        parameters: {
          type: 'object',
          properties: {
            fieldName: {
              type: 'string',
              description: 'Field to highlight',
              enum: editableFieldNames
            }
          },
          required: ['fieldName']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'confirmValue',
        description: 'Mark a field as confirmed by user. Use after user explicitly confirms a value.',
        parameters: {
          type: 'object',
          properties: {
            fieldName: {
              type: 'string',
              description: 'Field that was confirmed',
              enum: editableFieldNames
            }
          },
          required: ['fieldName']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'showHelp',
        description: 'Show help information for a field or general topic. Use when user asks for clarification.',
        parameters: {
          type: 'object',
          properties: {
            topic: {
              type: 'string',
              description: 'Topic to explain (field name or "general")',
              enum: [...allFieldNames, 'general']
            }
          },
          required: ['topic']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'showTooltip',
        description: 'Display the tooltip/description popup for a specific field. Use to visually explain a field to the user (RAG-style contextual help). The tooltip will appear next to the field with its description.',
        parameters: {
          type: 'object',
          properties: {
            fieldName: {
              type: 'string',
              description: 'Field to show tooltip for',
              enum: allFieldNames
            }
          },
          required: ['fieldName']
        }
      }
    }
  ];

  // Add section navigation tool if sections exist
  const sectionTool = generateSectionTool(sectionIds);
  if (sectionTool) {
    dynamicTools.push(sectionTool);
  }

  return [...dynamicTools, ...staticTools];
}