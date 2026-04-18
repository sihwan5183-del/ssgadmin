import { createContext, useContext, useState, ReactNode } from "react";

export type ViewScope = "personal" | "team";

interface ViewScopeCtx {
  scope: ViewScope;
  setScope: (s: ViewScope) => void;
}

const Ctx = createContext<ViewScopeCtx | null>(null);

export const ViewScopeProvider = ({ children }: { children: ReactNode }) => {
  const [scope, setScope] = useState<ViewScope>("team");
  return <Ctx.Provider value={{ scope, setScope }}>{children}</Ctx.Provider>;
};

export const useViewScope = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useViewScope must be inside ViewScopeProvider");
  return ctx;
};
