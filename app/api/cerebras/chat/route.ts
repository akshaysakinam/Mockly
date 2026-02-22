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

    const apiKey = process.env.CEREBRAS_API_KEY;
    const baseUrl = process.env.CEREBRAS_BASE_URL || 'https://api.cerebras.ai/v1';

    if (!apiKey) {
      console.error('CEREBRAS_API_KEY is not configured');
      return NextResponse.json(
        { error: 'CEREBRAS_API_KEY environment variable is required' },
        { status: 500 }
      );
    }

    const requestBody = {
      model: 'llama-3.3-70b',
      messages,
      max_tokens: maxTokens || 500,
      temperature: temperature || 0.7,
    };

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
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
        console.error('Cerebras API error response:', errorData);
      } catch (e) {
        // If JSON parsing fails, try to get text
        try {
          errorDetails = await response.text();
          console.error('Cerebras API error response (text):', errorDetails);
        } catch (textError) {
          errorDetails = `Status: ${response.status} ${response.statusText}`;
        }
      }
      
      return NextResponse.json(
        { 
          error: `Cerebras API error: ${response.status} ${response.statusText}`,
          details: errorDetails,
          status: response.status
        },
        { status: response.status >= 400 && response.status < 500 ? response.status : 500 }
      );
    }

    const data = await response.json();
    
    if (data.choices && data.choices.length > 0) {
      return NextResponse.json({ 
        content: data.choices[0].message.content 
      });
    } else {
      console.error('Unexpected Cerebras API response format:', data);
      return NextResponse.json(
        { error: 'No response from Cerebras API', details: 'Response format unexpected', data },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error calling Cerebras API:', error);
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
