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

    const { text, voice_id, language } = await request.json();
    
    if (!text) {
      return NextResponse.json(
        { error: 'No text provided' },
        { status: 400 }
      );
    }

    // Call Cartesia TTS API
    const response = await fetch('https://api.cartesia.ai/tts/bytes', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Cartesia-Version': '2025-04-16',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model_id: 'sonic-english',
        transcript: text,
        voice: {
          mode: 'id',
          id: voice_id || 'bf0a246a-8642-498a-9950-80c35e9276b5', // Default voice
        },
        output_format: {
          container: 'wav',
          encoding: 'pcm_s16le',
          sample_rate: 44100,
        },
        language: language || 'en',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Cartesia TTS API error:', response.status, errorText);
      return NextResponse.json(
        { error: `TTS API error: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }

    // Return the audio data as a blob
    const audioBuffer = await response.arrayBuffer();
    
    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': audioBuffer.byteLength.toString(),
      },
    });

  } catch (error) {
    console.error('Cartesia TTS error:', error);
    return NextResponse.json(
      { error: 'Failed to generate speech' },
      { status: 500 }
    );
  }
}
