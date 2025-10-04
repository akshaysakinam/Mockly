import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.CARTESIA_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'CARTESIA_API_KEY not configured' },
        { status: 500 }
      );
    }

    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    
    if (!audioFile) {
      return NextResponse.json(
        { error: 'No audio file provided' },
        { status: 400 }
      );
    }

    // Create FormData for Cartesia API
    const cartesiaFormData = new FormData();
    cartesiaFormData.append('file', audioFile);
    cartesiaFormData.append('model', 'ink-whisper');
    cartesiaFormData.append('language', 'en');
    cartesiaFormData.append('timestamp_granularities[]', 'word');

    // Call Cartesia STT API
    const response = await fetch('https://api.cartesia.ai/stt', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Cartesia-Version': '2025-04-16',
      },
      body: cartesiaFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Cartesia STT API error:', response.status, errorText);
      return NextResponse.json(
        { error: `STT API error: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    return NextResponse.json({
      success: true,
      text: data.text,
      language: data.language,
      duration: data.duration,
      words: data.words || []
    });

  } catch (error) {
    console.error('Cartesia STT error:', error);
    return NextResponse.json(
      { error: 'Failed to process audio' },
      { status: 500 }
    );
  }
}
