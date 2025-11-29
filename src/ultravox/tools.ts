export const formTools = [
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
            description: 'Field to update',
            enum: ['producer', 'date', 'grossWeight', 'vehicleWeight', 'grainType', 'dockage', 'pricePerTonne']
          },
          required: true
        },
        {
          name: 'value',
          location: 'PARAMETER_LOCATION_BODY',
          schema: {
            type: 'string',
            description: 'Value to set. For numbers, provide as string (e.g., "42500" for weight, "2.5" for percentage)'
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
            enum: ['producer', 'date', 'grossWeight', 'vehicleWeight', 'grainType', 'dockage', 'pricePerTonne', 'receiptNumber', 'licensee', 'netWeight', 'totalValue']
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
            enum: ['producer', 'date', 'grossWeight', 'vehicleWeight', 'grainType', 'dockage', 'pricePerTonne']
          },
          required: true
        }
      ],
      client: {}
    }
  },
  {
    temporaryTool: {
      modelToolName: 'navigateToSection',
      description: 'Scroll to a form section. Use when moving between major sections.',
      dynamicParameters: [
        {
          name: 'section',
          location: 'PARAMETER_LOCATION_BODY',
          schema: {
            type: 'string',
            description: 'Section to navigate to',
            enum: ['logistics', 'weights', 'grading', 'financials']
          },
          required: true
        }
      ],
      client: {}
    }
  },
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
      modelToolName: 'confirmValue',
      description: 'Mark a field as confirmed by user. Use after user explicitly confirms a value.',
      dynamicParameters: [
        {
          name: 'fieldName',
          location: 'PARAMETER_LOCATION_BODY',
          schema: {
            type: 'string',
            description: 'Field that was confirmed'
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
      description: 'Show help information for a topic. Use when user asks for clarification.',
      dynamicParameters: [
        {
          name: 'topic',
          location: 'PARAMETER_LOCATION_BODY',
          schema: {
            type: 'string',
            description: 'Topic to explain',
            enum: ['producer', 'date', 'weights', 'grossWeight', 'vehicleWeight', 'grainType', 'dockage', 'pricePerTonne', 'general']
          },
          required: true
        }
      ],
      client: {}
    }
  },
  {
    temporaryTool: {
      modelToolName: 'hangUp',
      description: 'End the call. ONLY use when: form is complete AND user confirms, OR user explicitly requests to end.',
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