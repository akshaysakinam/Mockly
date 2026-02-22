export interface CerebrasResponse {
  choices: Array<{
    message: {
      content: string;
      role: string;
    };
  }>;
}

export interface CerebrasRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  max_tokens?: number;
  temperature?: number;
}

export class CerebrasLLM {
  private apiKey: string;
  private baseUrl: string;

  constructor() {
    // Using Gemini instead of Cerebras
    this.apiKey = process.env.GEMINI_API_KEY || '';
    this.baseUrl = process.env.GEMINI_BASE_URL || '';
    
    // For client-side usage, we'll handle the API key differently
    if (typeof window === 'undefined' && !this.apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
  }

  async generateResponse(
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options: {
      maxTokens?: number;
      temperature?: number;
    } = {}
  ): Promise<string> {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        const response = await fetch('/api/gemini/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages,
            maxTokens: options.maxTokens || 500,
            temperature: options.temperature || 0.7,
          }),
        });

        if (response.status === 429) {
          // Rate limited - wait and retry
          const waitTime = Math.pow(2, attempt) * 2000; // Exponential backoff starting at 2s
          console.warn(`⚠️ Rate limited (429). Waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          attempt++;
          continue;
        }

        if (!response.ok) {
          // Try to get detailed error information
          let errorMessage = `API error: ${response.status} ${response.statusText}`;
          try {
            const errorData = await response.json();
            if (errorData.error) {
              errorMessage = errorData.error;
            }
            if (errorData.details) {
              errorMessage += ` - ${errorData.details}`;
            }
            console.error('API error details:', errorData);
          } catch (e) {
            // If we can't parse JSON, use the status text
            console.error('Could not parse error response:', e);
          }
          throw new Error(errorMessage);
        }

        const data = await response.json();
        
        if (data.content) {
          return data.content;
        } else if (data.error) {
          throw new Error(`API returned error: ${data.error}${data.details ? ` - ${data.details}` : ''}`);
        } else {
          console.error('Unexpected API response format:', data);
          throw new Error('No response content from API');
        }
      } catch (error) {
        console.error('Error calling Gemini API:', error);
        
        if (attempt === maxRetries - 1) {
          throw error;
        }
        
        attempt++;
        const waitTime = Math.pow(2, attempt) * 1000;
        console.warn(`⚠️ Request failed. Waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    throw new Error('Max retries exceeded');
  }

  // Generate interview feedback based on transcript
  async generateInterviewFeedback(
    transcript: Array<{ role: string; content: string }>,
    role: string,
    level: string,
    techStack: string[]
  ): Promise<{
    totalScore: number;
    categoryScores: Array<{
      name: string;
      score: number;
      comment: string;
    }>;
    strengths: string[];
    areasForImprovement: string[];
    finalAssessment: string;
  }> {
    const systemPrompt = `You are an expert interview evaluator. Analyze the interview transcript and provide detailed feedback.

Role: ${role}
Level: ${level}
Tech Stack: ${techStack.join(', ')}

Evaluate the candidate on these categories:
1. Technical Knowledge (0-100)
2. Communication Skills (0-100)
3. Problem Solving (0-100)
4. Experience Relevance (0-100)
5. Overall Fit (0-100)

Provide specific feedback for each category and overall assessment.`;

    const transcriptText = transcript
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    const userPrompt = `Please analyze this interview transcript and provide detailed feedback:

${transcriptText}

Return your response in the following JSON format:
{
  "totalScore": number (0-100),
  "categoryScores": [
    {
      "name": "Technical Knowledge",
      "score": number (0-100),
      "comment": "detailed feedback"
    },
    {
      "name": "Communication Skills", 
      "score": number (0-100),
      "comment": "detailed feedback"
    },
    {
      "name": "Problem Solving",
      "score": number (0-100), 
      "comment": "detailed feedback"
    },
    {
      "name": "Experience Relevance",
      "score": number (0-100),
      "comment": "detailed feedback"
    },
    {
      "name": "Overall Fit",
      "score": number (0-100),
      "comment": "detailed feedback"
    }
  ],
  "strengths": ["strength1", "strength2", "strength3"],
  "areasForImprovement": ["area1", "area2", "area3"],
  "finalAssessment": "comprehensive final assessment"
}`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userPrompt },
    ];

    const response = await this.generateResponse(messages, {
      maxTokens: 2000,
      temperature: 0.3, // Lower temperature for more consistent evaluation
    });

    try {
      // Clean the response to extract JSON from markdown if present
      let cleanResponse = response;
      
      // Remove markdown code blocks if present
      if (cleanResponse.includes('```json')) {
        cleanResponse = cleanResponse.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      } else if (cleanResponse.includes('```')) {
        cleanResponse = cleanResponse.replace(/```\n?/g, '');
      }
      
      // Try to extract JSON from the response
      const jsonMatch = cleanResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanResponse = jsonMatch[0];
      }
      
      const feedback = JSON.parse(cleanResponse);
      return feedback;
    } catch (error) {
      console.error('❌ CRITICAL: Failed to parse Gemini model feedback JSON:', error);
      console.log('📄 Raw Gemini response:', response);
      
      // Re-throw the error instead of providing fallback - we want REAL feedback only!
      throw new Error(`Failed to parse Gemini model feedback: ${error}. Raw response: ${response}`);
    }
  }

  // Generate interview questions based on role, experience level, and tech stack
  async generateInterviewQuestion({
    role,
    experienceLevel,
    techStack,
    previousAnswers = [],
    questionNumber = 1,
    totalQuestions = 5
  }: {
    role: string;
    experienceLevel: string;
    techStack: string[];
    previousAnswers?: string[];
    questionNumber?: number;
    totalQuestions?: number;
  }): Promise<string> {
    const systemPrompt = `You are an expert interviewer for a ${experienceLevel} ${role} position.

Candidate's tech stack: ${techStack.join(", ")}

This is question ${questionNumber} of ${totalQuestions} total questions.

Previous answers so far:
${previousAnswers.map((a, i) => `${i + 1}. ${a}`).join("\n")}

Your task: Write exactly ONE complete interview question. Critical rules:
1. The question MUST be a full, complete sentence that ends with a question mark.
2. Never cut off mid-sentence. Include the entire question from start to finish.
3. Make it appropriate for ${experienceLevel} level and relevant to ${techStack.join(", ")}.
4. Keep it conversational and natural for spoken delivery.
5. Do not add multiple questions, intros like "Sure," or explanations—only the one question.

Good examples (output only the question):
- "What aspects of JavaScript do you find most interesting or challenging?"
- "How would you explain the difference between let, const, and var to a beginner?"
- "Can you describe a project where you used JavaScript to solve a real problem?"
- "What is your experience with debugging JavaScript in the browser?"

Reply with ONLY the single question text, nothing else.`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: `Generate question ${questionNumber} of ${totalQuestions} for this ${experienceLevel} ${role} candidate. One complete question only.` },
    ];

    try {
      const question = await this.generateResponse(messages, {
        maxTokens: 300,
        temperature: 0.7,
      });

      // Clean up the response to ensure it's just a question
      let cleanQuestion = question.trim();
      
      // Remove any leading numbers or bullet points
      cleanQuestion = cleanQuestion.replace(/^\d+\.\s*/, '').replace(/^[-*]\s*/, '');
      
      // Ensure it ends with a question mark if it doesn't already
      if (!cleanQuestion.endsWith('?') && !cleanQuestion.endsWith('.')) {
        cleanQuestion += '?';
      }

      return cleanQuestion || "Could you tell me about your experience with the technologies you mentioned?";
    } catch (error) {
      console.error('Error generating interview question:', error);
      return "What is your experience with the technologies you mentioned?";
    }
  }

  // Generate natural conversation response
  async generateConversationalResponse(
    userMessage: string,
    context: string,
    interviewPhase: 'preliminary' | 'interview' | 'feedback'
  ): Promise<string> {
    const systemPrompt = `You are a professional AI interviewer conducting a ${interviewPhase} interview. 

Context: ${context}

Guidelines:
- Be professional but friendly
- Keep responses concise (1-2 sentences)
- Don't use bullet points or special characters
- Speak naturally as if in a real conversation
- If in preliminary phase, gather the required information
- If in interview phase, follow the structured question format strictly - NO follow-ups unless explicitly requested
- If in feedback phase, provide encouraging closing remarks`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userMessage },
    ];

    return await this.generateResponse(messages, {
      maxTokens: 200,
      temperature: 0.8,
    });
  }
}
