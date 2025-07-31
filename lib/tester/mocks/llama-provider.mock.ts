/**
 * Mock для LlamaProviderService для использования в тестах
 */

export const mockLlamaProviderService = {
  name: 'llama',
  displayName: 'Llama 4 (Mock)',

  generateText: jest.fn().mockImplementation(async prompt => {
    return `Это тестовый ответ для манипулятивной техники. Prompt: ${prompt.slice(0, 20)}...`;
  }),

  generateTextStream: jest.fn().mockImplementation(async function* (prompt) {
    yield `Это`;
    yield ` тестовый`;
    yield ` ответ`;
    yield ` для`;
    yield ` манипулятивной`;
    yield ` техники.`;
  }),

  generateJSON: jest.fn().mockImplementation(async (prompt, schema) => {
    return {
      success: true,
      technique: 'PUSH_PULL',
      message: 'Тестовое сообщение для манипулятивной техники',
      effectiveness: 0.8,
      phase: 'EXECUTION',
    };
  }),

  getModelList: jest.fn().mockImplementation(() => {
    return [
      {
        id: 'llama-4-mock',
        name: 'Llama 4 Mock',
        contextSize: 32768,
        isDefault: true,
      },
    ];
  }),

  getDefaultModel: jest.fn().mockImplementation(() => {
    return {
      id: 'llama-4-mock',
      name: 'Llama 4 Mock',
      contextSize: 32768,
      isDefault: true,
    };
  }),

  isAvailable: jest.fn().mockImplementation(() => true),

  validateEndpoint: jest.fn().mockImplementation(() => true),
};
