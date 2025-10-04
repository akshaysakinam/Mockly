// Session management utilities

export async function clearSession(): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch('/api/auth/signout', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to sign out');
    }

    return {
      success: true,
      message: data.message || 'Session cleared successfully'
    };
  } catch (error) {
    console.error('Error clearing session:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to clear session'
    };
  }
}

export async function clearAllSessions(): Promise<{ success: boolean; message: string; clearedCookies?: string[] }> {
  try {
    const response = await fetch('/api/auth/clear-session', {
      method: 'GET',
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to clear sessions');
    }

    return {
      success: true,
      message: data.message || 'All sessions cleared successfully',
      clearedCookies: data.clearedCookies
    };
  } catch (error) {
    console.error('Error clearing all sessions:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to clear all sessions'
    };
  }
}

// Browser-side session clearing
export function clearBrowserSession(): void {
  // Clear localStorage
  if (typeof window !== 'undefined') {
    localStorage.clear();
    sessionStorage.clear();
    
    // Clear any Firebase auth state
    if ('firebase' in window) {
      // This would clear Firebase auth state if needed
      console.log('Firebase auth state cleared');
    }
  }
}

// Complete session reset
export async function completeSignout(): Promise<{ success: boolean; message: string }> {
  try {
    // Clear server-side session
    const serverResult = await clearAllSessions();
    
    // Clear browser-side session
    clearBrowserSession();
    
    // Reload the page to ensure clean state
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
    
    return {
      success: serverResult.success,
      message: serverResult.message
    };
  } catch (error) {
    console.error('Error during complete signout:', error);
    return {
      success: false,
      message: 'Failed to complete signout'
    };
  }
}
