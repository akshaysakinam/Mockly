import Link from "next/link";
import Image from "next/image";

import { ReactNode } from "react";
import { isAuthenticated } from "@/lib/actions/auth.action";
import { redirect } from "next/navigation";
import Header from "@/components/Header";

const RootLayout = async ({ children }: { children: ReactNode }) => {
  const isUserAuthenticated = await isAuthenticated();
  if (!isUserAuthenticated) redirect("/sign-in");
  return (
    <div>
      <Header />
      <div className="root-layout">
        <nav className="card-border p-0.5 rounded-2xl">
          <div className="dark-gradient rounded-2xl px-4 py-3">
            
          </div>
        </nav>

        {children}
      </div>
    </div>
  );
};

export default RootLayout;
