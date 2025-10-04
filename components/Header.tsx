'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { clearSession } from '@/lib/utils/session';

export default function Header() {
  const [isSigningOut, setIsSigningOut] = useState(false);
  const router = useRouter();

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      const result = await clearSession();
      if (result.success) {
        // Clear any client-side storage
        if (typeof window !== 'undefined') {
          localStorage.clear();
          sessionStorage.clear();
        }
        // Redirect to sign-in page
        router.push('/sign-in');
      } else {
        console.error('Signout failed:', result.message);
      }
    } catch (error) {
      console.error('Error during signout:', error);
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <header className="w-full dark-gradient border-b border-input">
      <div className="mx-auto max-w-7xl px-16 max-sm:px-4 py-3 flex justify-between items-center">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-dark-200 rounded-lg flex items-center justify-center border border-input">
          <Image src="/logo.svg" alt="MockMate Logo" width={38} height={32} />
          <h2 className="text-primary-100">Mockly</h2>
          </div>
          
        
        </Link>

        <nav className="flex items-center gap-4">
          <Link 
            href="/" 
            className="text-light-100 hover:text-primary-200 transition-colors font-medium"
          >
            Home
          </Link>
          <Link 
            href="/interview" 
            className="text-light-100 hover:text-primary-200 transition-colors font-medium"
          >
            New Interview
          </Link>
          <Button
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="btn-secondary"
            size="sm"
          >
            {isSigningOut ? 'Signing out...' : 'Sign Out'}
          </Button>
        </nav>
      </div>
    </header>
  );
}
