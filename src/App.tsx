import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ViewScopeProvider } from "@/contexts/ViewScopeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppShell } from "@/components/layout/AppShell";
import Index from "./pages/Index.tsx";
import InputPage from "./pages/InputPage.tsx";
import ActivitiesPage from "./pages/ActivitiesPage.tsx";
import RegularInputPage from "./pages/RegularInputPage.tsx";
import ExpensesPage from "./pages/ExpensesPage.tsx";
import ExpenseInputPage from "./pages/ExpenseInputPage.tsx";
import FieldOptionsPage from "./pages/FieldOptionsPage.tsx";
import RankingPage from "./pages/RankingPage.tsx";
import TeamPage from "./pages/TeamPage.tsx";
import AdminPage from "./pages/AdminPage.tsx";
import AuthPage from "./pages/AuthPage.tsx";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <AuthProvider>
          <ViewScopeProvider>
            <Toaster />
            <Sonner />
            <Routes>
              <Route path="/auth" element={<AuthPage />} />
              <Route
                path="*"
                element={
                  <ProtectedRoute>
                    <AppShell>
                      <Routes>
                        <Route path="/" element={<Index />} />
                        <Route path="/input" element={<InputPage />} />
                        <Route path="/activities" element={<ActivitiesPage />} />
                        <Route path="/regular-input" element={<RegularInputPage />} />
                        <Route path="/expenses" element={<ExpensesPage />} />
                        <Route path="/ad-spend" element={<ExpenseInputPage />} />
                        <Route path="/expense-input" element={<ExpenseInputPage />} />
                        <Route path="/field-options" element={<FieldOptionsPage />} />
                        <Route path="/ranking" element={<RankingPage />} />
                        <Route path="/team" element={<TeamPage />} />
                        <Route path="/admin" element={<AdminPage />} />
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </AppShell>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </ViewScopeProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
