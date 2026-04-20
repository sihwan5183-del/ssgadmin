import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { ImpersonationBar } from "./ImpersonationBar";

export const AppShell = ({ children }: { children: ReactNode }) => {
  return (
    <div className="min-h-screen">
      <ImpersonationBar />
      <Sidebar />
      <main className="lg:pl-[13.5rem] pb-20 lg:pb-6">
        <div className="px-3 md:px-5 lg:px-6 pt-4 max-w-[1600px] mx-auto animate-fade-in text-[0.92rem]">
          {children}
        </div>
      </main>
      <MobileNav />
    </div>
  );
};
