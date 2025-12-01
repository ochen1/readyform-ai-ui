import type { FormField } from '../store/types';

/**
 * Tool definition type for Ultravox
 */
export interface ToolDefinition {
  temporaryTool: {
    modelToolName: string;
    description: string;
    dynamicParameters: Array<{
      name: string;
      location: string;
      schema: {
        type: string;
        description: string;
        enum?: string[];
      };
      required: boolean;
    }>;
    client: Record<string, unknown>;
  };
}

/**
 * Static tools that don't depend on field names
 */
export const staticTools: ToolDefinition[] = [
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
      modelToolName: 'hangUp',
      description: 'End the call and show the completed PDF. Use when: user says they are done, finished, wants to submit, or explicitly requests to end the call. This displays a full-screen preview of the filled PDF.',
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

/**
 * Generate a navigateToSection tool with section IDs from the form
 */
export function generateSectionTool(sectionIds: string[]): ToolDefinition | null {
  if (sectionIds.length === 0) {
    return null;
  }
  
  return {
    temporaryTool: {
      modelToolName: 'navigateToSection',
      description: 'Scroll to and highlight a specific section of the form. Use when moving between major form sections. The form will animate smoothly to the section.',
      dynamicParameters: [
        {
          name: 'sectionId',
          location: 'PARAMETER_LOCATION_BODY',
          schema: {
            type: 'string',
            description: 'The section ID to navigate to',
            enum: sectionIds
          },
          required: true
        }
      ],
      client: {}
    }
  };
}

/**
 * Generate dynamic tools based on loaded form fields
 * This creates tools with enum values for the specific fields in the PDF
 */
export function generateFormTools(fields: FormField[], sectionIds: string[] = []): ToolDefinition[] {
  // Get field names for enums (excluding readonly fields for setters)
  const editableFieldNames = fields
    .filter(f => !f.readonly)
    .map(f => f.name);
  
  const allFieldNames = fields.map(f => f.name);

  // If no fields loaded, return only static tools
  if (fields.length === 0) {
    return staticTools;
  }

  const dynamicTools: ToolDefinition[] = [
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
              description: 'Field to update (use the exact field name)',
              enum: editableFieldNames
            },
            required: true
          },
          {
            name: 'value',
            location: 'PARAMETER_LOCATION_BODY',
            schema: {
              type: 'string',
              description: 'Value to set (always as a string)'
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
              enum: allFieldNames
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
              enum: editableFieldNames
            },
            required: true
          }
        ],
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
              description: 'Field that was confirmed',
              enum: editableFieldNames
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
        description: 'Show help information for a field or general topic. Use when user asks for clarification.',
        dynamicParameters: [
          {
            name: 'topic',
            location: 'PARAMETER_LOCATION_BODY',
            schema: {
              type: 'string',
              description: 'Topic to explain (field name or "general")',
              enum: [...allFieldNames, 'general']
            },
            required: true
          }
        ],
        client: {}
      }
    },
    {
      temporaryTool: {
        modelToolName: 'showTooltip',
        description: 'Display the tooltip/description popup for a specific field. Use to visually explain a field to the user (RAG-style contextual help). The tooltip will appear next to the field with its description.',
        dynamicParameters: [
          {
            name: 'fieldName',
            location: 'PARAMETER_LOCATION_BODY',
            schema: {
              type: 'string',
              description: 'Field to show tooltip for',
              enum: allFieldNames
            },
            required: true
          }
        ],
        client: {}
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

/**
 * Default export for backwards compatibility
 * Returns static tools only (for when no PDF is loaded)
 */
export const formTools = staticTools;