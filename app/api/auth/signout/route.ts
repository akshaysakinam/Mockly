import { NextRequest, NextResponse } from 'next/server';
import { signOut } from '@/lib/actions/auth.action';

export async function POST(request: NextRequest) {
  try {
    await signOut();
    
    return NextResponse.json({
      success: true,
      message: 'Signed out successfully'
    });

  } catch (error) {
    console.error('Signout API error:', error);
    return NextResponse.json(
      { error: 'Failed to sign out' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  // Allow GET request for easy testing
  return POST(request);
}
