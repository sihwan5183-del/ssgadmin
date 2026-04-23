import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { MobileTopBar } from "./MobileTopBar";
import { ImpersonationBar } from "./ImpersonationBar";
import { SecurityWatermark } from "./SecurityWatermark";

export const AppShell = ({ children }: { children: ReactNode }) => {
  return (
    <div className="min-h-screen">
      <ImpersonationBar />
      <SecurityWatermark />
      <Sidebar />
      <MobileTopBar />
      <main className="lg:pl-[13.5rem] pb-24 lg:pb-6">
        <div className="px-3 md:px-5 lg:px-6 pt-3 lg:pt-4 max-w-[1600px] mx-auto animate-fade-in">
          {children}
        </div>
      </main>
      <MobileNav />
    </div>
  );
};
