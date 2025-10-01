import Link from "next/link";
import Image from "next/image";

import { ReactNode } from 'react'

const RootLayout = ({children}:{children:ReactNode}) => {
  return (
    <div>
      <div className="root-layout">
      <nav>
        <Link href="/" className="flex items-center gap-2">
      
          <Image src="/logo.svg" alt="MockMate Logo" width={38} height={32} />
          <h2 className="text-primary-100">Mockly</h2>
        </Link>
      </nav>

      {children}
    </div>
    </div>
  )
}

export default RootLayout