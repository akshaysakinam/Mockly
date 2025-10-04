import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    
    // Clear all session-related cookies
    cookieStore.delete("session");
    
    // Also clear any other potential auth cookies
    const allCookies = cookieStore.getAll();
    allCookies.forEach(cookie => {
      if (cookie.name.includes('auth') || cookie.name.includes('session') || cookie.name.includes('token')) {
        cookieStore.delete(cookie.name);
      }
    });

    return NextResponse.json({
      success: true,
      message: 'All sessions cleared successfully',
      clearedCookies: allCookies.map(c => c.name)
    });

  } catch (error) {
    console.error('Clear session error:', error);
    return NextResponse.json(
      { error: 'Failed to clear session' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
