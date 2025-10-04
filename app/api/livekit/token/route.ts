import { NextRequest, NextResponse } from 'next/server';
import { createRoomToken } from '@/lib/livekit';

export async function POST(request: NextRequest) {
  try {
    const { roomName, userId } = await request.json();

    console.log('Token request:', { roomName, userId });

    if (!roomName || !userId) {
      return NextResponse.json(
        { error: 'Room name and user ID are required' },
        { status: 400 }
      );
    }

    // Check if environment variables are available
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    
    console.log('Environment check:', { 
      hasApiKey: !!apiKey, 
      hasApiSecret: !!apiSecret,
      apiKeyPrefix: apiKey?.substring(0, 8) + '...'
    });

    if (!apiKey || !apiSecret) {
      console.error('Missing LiveKit credentials');
      return NextResponse.json(
        { error: 'LiveKit credentials not configured' },
        { status: 500 }
      );
    }

    const tokenData = await createRoomToken(roomName, userId);
    
    console.log('Token generated successfully:', { 
      hasToken: !!tokenData.token,
      url: tokenData.url 
    });

    return NextResponse.json(tokenData);
  } catch (error) {
    console.error('Error generating LiveKit token:', error);
    return NextResponse.json(
      { error: `Failed to generate token: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    );
  }
}
