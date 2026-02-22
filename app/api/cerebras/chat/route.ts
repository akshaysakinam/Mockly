import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { messages, maxTokens, temperature } = await request.json();

    const apiKey = process.env.CEREBRAS_API_KEY;
    const baseUrl = process.env.CEREBRAS_BASE_URL || 'https://api.cerebras.ai/v1';

    if (!apiKey) {
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
      throw new Error(`Cerebras API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.choices && data.choices.length > 0) {
      return NextResponse.json({ 
        content: data.choices[0].message.content 
      });
    } else {
      throw new Error('No response from Cerebras API');
    }
  } catch (error) {
    console.error('Error calling Cerebras API:', error);
    return NextResponse.json(
      { error: 'Failed to generate response' },
      { status: 500 }
    );
  }
}
