// Configuration for the AI Interview Platform
export const config = {
  // LiveKit Configuration
  livekit: {
    apiKey: process.env.LIVEKIT_API_KEY || '',
    apiSecret: process.env.LIVEKIT_API_SECRET || '',
    wsUrl: process.env.LIVEKIT_WS_URL || 'wss://your-livekit-server.com',
  },
  
  // Cerebras Configuration
  cerebras: {
    apiKey: process.env.CEREBRAS_API_KEY || '',
    baseUrl: process.env.CEREBRAS_BASE_URL || 'https://api.cerebras.ai/v1',
    model: 'llama-3.3-70b',
  },
  
  // Cartesia Configuration (for STT/TTS)
  cartesia: {
    apiKey: process.env.CARTESIA_API_KEY || '',
  },
  
  // Interview Configuration
  interview: {
    defaultQuestionCount: 5,
    maxQuestionCount: 15,
    defaultRole: 'Software Engineer',
    defaultLevel: 'Mid-level',
    defaultTechStack: ['JavaScript', 'React', 'Node.js'],
  },
};

// Validation function to check if required environment variables are set
export function validateConfig(): { isValid: boolean; missingVars: string[] } {
  const requiredVars = [
    'LIVEKIT_API_KEY',
    'LIVEKIT_API_SECRET',
    'CEREBRAS_API_KEY',
  ];
  
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  return {
    isValid: missingVars.length === 0,
    missingVars,
  };
}
