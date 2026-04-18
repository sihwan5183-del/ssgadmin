import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";

export const AppShell = ({ children }: { children: ReactNode }) => {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <main className="lg:pl-64 pb-24 lg:pb-10">
        <div className="px-5 md:px-8 lg:px-10 pt-8 max-w-[1400px] mx-auto animate-fade-in">
          {children}
        </div>
      </main>
      <MobileNav />
    </div>
  );
};
