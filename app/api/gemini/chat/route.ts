import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, maxTokens, temperature } = body;

    // Validate request body
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Invalid request: messages array is required and must not be empty' },
        { status: 400 }
      );
    }

    // Validate message format
    for (const msg of messages) {
      if (!msg.role || !msg.content) {
        return NextResponse.json(
          { error: 'Invalid request: each message must have role and content' },
          { status: 400 }
        );
      }
    }

    const apiKey = process.env.GEMINI_API_KEY;
    // Gemini 2.5 Flash is free tier; use gemini-2.5-flash (stable) or gemini-2.5-flash-preview-09-2025
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

    if (!apiKey) {
      console.error('GEMINI_API_KEY is not configured');
      return NextResponse.json(
        { error: 'GEMINI_API_KEY environment variable is required' },
        { status: 500 }
      );
    }

    // Convert messages format from OpenAI/Cerebras format to Gemini format
    // Gemini uses 'user' and 'model' roles instead of 'user' and 'assistant'
    // Also, system messages need to be handled differently in Gemini
    const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];
    let systemInstruction = '';

    for (const msg of messages) {
      if (msg.role === 'system') {
        // System messages in Gemini are passed as systemInstruction
        systemInstruction = msg.content;
      } else {
        // Convert 'assistant' to 'model' for Gemini
        const role = msg.role === 'assistant' ? 'model' : 'user';
        contents.push({
          role,
          parts: [{ text: msg.content }]
        });
      }
    }

    // Gemini API endpoint
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const requestBody: any = {
      contents,
      generationConfig: {
        maxOutputTokens: maxTokens || 500,
        temperature: temperature || 0.7,
      }
    };

    // Add system instruction if present
    if (systemInstruction) {
      requestBody.systemInstruction = {
        parts: [{ text: systemInstruction }]
      };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      // Try to get the error details from the response
      let errorDetails = '';
      try {
        const errorData = await response.json();
        errorDetails = JSON.stringify(errorData);
        console.error('Gemini API error response:', errorData);
      } catch (e) {
        // If JSON parsing fails, try to get text
        try {
          errorDetails = await response.text();
          console.error('Gemini API error response (text):', errorDetails);
        } catch (textError) {
          errorDetails = `Status: ${response.status} ${response.statusText}`;
        }
      }
      
      return NextResponse.json(
        { 
          error: `Gemini API error: ${response.status} ${response.statusText}`,
          details: errorDetails,
          status: response.status
        },
        { status: response.status >= 400 && response.status < 500 ? response.status : 500 }
      );
    }

    const data = await response.json();
    
    // Extract text from Gemini response
    if (data.candidates && data.candidates.length > 0) {
      const candidate = data.candidates[0];
      if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
        const text = candidate.content.parts[0].text;
        return NextResponse.json({ 
          content: text
        });
      }
    }
    
    console.error('Unexpected Gemini API response format:', data);
    return NextResponse.json(
      { error: 'No response from Gemini API', details: 'Response format unexpected', data },
      { status: 500 }
    );
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { 
        error: 'Failed to generate response',
        details: errorMessage,
        type: error instanceof Error ? error.constructor.name : typeof error
      },
      { status: 500 }
    );
  }
}
