import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type ViewScope = "personal" | "team";

export interface Impersonation {
  managerName: string; // 보고자 이름 (sales.manager 와 매칭)
  startedAt: number;
}

interface ViewScopeCtx {
  scope: ViewScope;
  setScope: (s: ViewScope) => void;
  impersonation: Impersonation | null;
  startImpersonation: (managerName: string) => void;
  stopImpersonation: () => void;
}

const Ctx = createContext<ViewScopeCtx | null>(null);
const STORAGE_KEY = "lvbl_impersonation";

export const ViewScopeProvider = ({ children }: { children: ReactNode }) => {
  const [scope, setScope] = useState<ViewScope>("team");
  const [impersonation, setImpersonation] = useState<Impersonation | null>(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Impersonation) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (impersonation) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(impersonation));
    else sessionStorage.removeItem(STORAGE_KEY);
  }, [impersonation]);

  const startImpersonation = (managerName: string) => {
    setImpersonation({ managerName, startedAt: Date.now() });
    setScope("personal");
  };
  const stopImpersonation = () => {
    setImpersonation(null);
    setScope("team");
  };

  return (
    <Ctx.Provider value={{ scope, setScope, impersonation, startImpersonation, stopImpersonation }}>
      {children}
    </Ctx.Provider>
  );
};

export const useViewScope = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useViewScope must be inside ViewScopeProvider");
  return ctx;
};
