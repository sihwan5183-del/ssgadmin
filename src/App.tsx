import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { useEffect, useState } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SplashScreen } from "@/components/SplashScreen";
import { ViewScopeProvider } from "@/contexts/ViewScopeContext";
import { PeriodProvider } from "@/contexts/PeriodContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AdminOnlyRoute } from "@/components/auth/AdminOnlyRoute";
import { AppShell } from "@/components/layout/AppShell";
import Index from "./pages/Index.tsx";
import InputPage from "./pages/InputPage.tsx";
import ActivitiesPage from "./pages/ActivitiesPage.tsx";
import RegularInputPage from "./pages/RegularInputPage.tsx";
import RegularsPage from "./pages/RegularsPage.tsx";
import ExpensesPage from "./pages/ExpensesPage.tsx";
import ExpenseInputPage from "./pages/ExpenseInputPage.tsx";
import FieldOptionsPage from "./pages/FieldOptionsPage.tsx";
import RankingPage from "./pages/RankingPage.tsx";
import TeamPage from "./pages/TeamPage.tsx";
import AdminPage from "./pages/AdminPage.tsx";
import ProductRatePlansPage from "./pages/ProductRatePlansPage.tsx";
import EquipmentCatalogPage from "./pages/EquipmentCatalogPage.tsx";
import DeviceInventoryPage from "./pages/DeviceInventoryPage.tsx";
import AdCalendarPage from "./pages/AdCalendarPage.tsx";
import DeviceModelsPage from "./pages/DeviceModelsPage.tsx";
import IncentiveRatesPage from "./pages/IncentiveRatesPage.tsx";
import AuthPage from "./pages/AuthPage.tsx";
import MagicLinkPage from "./pages/MagicLinkPage.tsx";
import MissingDocsPage from "./pages/MissingDocsPage.tsx";
import StaffStatusPage from "./pages/StaffStatusPage.tsx";
import RecentActivitiesPage from "./pages/RecentActivitiesPage.tsx";
import MenuManagerPage from "./pages/MenuManagerPage.tsx";
import DownloadsPage from "./pages/DownloadsPage.tsx";
import NotFound from "./pages/NotFound.tsx";
// /channel-intake 는 통합 CRM(/leads)으로 합쳐졌습니다 — 옛 페이지는 더 이상 라우팅하지 않습니다.
import BudgetCategoriesPage from "./pages/BudgetCategoriesPage.tsx";
import MyPage from "./pages/MyPage.tsx";
import SalesLedgerPage from "./pages/SalesLedgerPage.tsx";
import AccountManagementPage from "./pages/AccountManagementPage.tsx";
import AccountPendingPage from "./pages/AccountPendingPage.tsx";
import AccountStaffPage from "./pages/AccountStaffPage.tsx";
import AccountRolesPage from "./pages/AccountRolesPage.tsx";
import SegPartnersPage from "./pages/SegPartnersPage.tsx";
import SegCalendarPage from "./pages/SegCalendarPage.tsx";
import StaffGoalsPage from "./pages/StaffGoalsPage.tsx";
import PendingItemsAdminPage from "./pages/PendingItemsAdminPage.tsx";
import PlanRetentionAdminPage from "./pages/PlanRetentionAdminPage.tsx";
import PlanChangeCalendarPage from "./pages/PlanChangeCalendarPage.tsx";
import ApartmentPage from "./pages/ApartmentPage.tsx";
import FileVaultPage from "./pages/FileVaultPage.tsx";
import FileApprovalsPage from "./pages/FileApprovalsPage.tsx";
import AddonRetentionAdminPage from "./pages/AddonRetentionAdminPage.tsx";
import AddonTasksPage from "./pages/AddonTasksPage.tsx";
import CustomProposalsPage from "./pages/CustomProposalsPage.tsx";
import LeadsPage from "./pages/LeadsPage.tsx";

const queryClient = new QueryClient();

 const SPLASH_SESSION_KEY = "uplus-direct.splash.shown";

const App = () => {
  // 세션 동안 1회만 표시 (앱 진입 시), 새로고침 시 재표시
  const [showSplash, setShowSplash] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      return sessionStorage.getItem(SPLASH_SESSION_KEY) !== "1";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (!showSplash) return;
    try {
      sessionStorage.setItem(SPLASH_SESSION_KEY, "1");
    } catch {
      /* noop */
    }
  }, [showSplash]);

  return (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <BrowserRouter>
        <AuthProvider>
          <ViewScopeProvider>
            <PeriodProvider>
            {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
            <Toaster />
            <Sonner />
            <Routes>
              <Route path="/auth" element={<AuthPage />} />
              <Route path="/magic-link" element={<MagicLinkPage />} />
              <Route
                path="*"
                element={
                  <ProtectedRoute>
                    <AppShell>
                      <Routes>
                        <Route path="/" element={<Index />} />
                        <Route path="/input" element={<InputPage />} />
                        <Route path="/activities" element={<ActivitiesPage />} />
                        <Route path="/recent-activities" element={<RecentActivitiesPage />} />
                        <Route path="/missing-docs" element={<MissingDocsPage />} />
                        <Route path="/regular-input" element={<RegularInputPage />} />
                        <Route path="/regulars" element={<RegularsPage />} />
                        <Route path="/expenses" element={<ExpensesPage />} />
                        <Route path="/ad-spend" element={<ExpenseInputPage />} />
                        <Route path="/expense-input" element={<ExpenseInputPage />} />
                        <Route path="/field-options" element={<AdminOnlyRoute><FieldOptionsPage /></AdminOnlyRoute>} />
                        <Route path="/ranking" element={<RankingPage />} />
                        <Route path="/team" element={<TeamPage />} />
                        <Route path="/staff-status" element={<StaffStatusPage />} />
                        <Route path="/admin" element={<AdminOnlyRoute><AdminPage /></AdminOnlyRoute>} />
                        <Route path="/admin/menu" element={<AdminOnlyRoute><MenuManagerPage /></AdminOnlyRoute>} />
                        <Route
                          path="/admin/staff-goals"
                          element={
                            <AdminOnlyRoute>
                              <StaffGoalsPage />
                            </AdminOnlyRoute>
                          }
                        />
                        <Route path="/admin/pending-items" element={<AdminOnlyRoute><PendingItemsAdminPage /></AdminOnlyRoute>} />
                        <Route
                          path="/admin/plan-retention"
                          element={
                            <AdminOnlyRoute>
                              <PlanRetentionAdminPage />
                            </AdminOnlyRoute>
                          }
                        />
                        <Route path="/plan-change-calendar" element={<PlanChangeCalendarPage />} />
                        <Route
                          path="/admin/addon-retention"
                          element={<AdminOnlyRoute><AddonRetentionAdminPage /></AdminOnlyRoute>}
                        />
                        <Route path="/addon-tasks" element={<AddonTasksPage />} />
                        <Route path="/admin/accounts" element={<AdminOnlyRoute><AccountManagementPage /></AdminOnlyRoute>}>
                          <Route path="pending" element={<AccountPendingPage />} />
                          <Route path="staff" element={<AccountStaffPage />} />
                          <Route path="roles" element={<AccountRolesPage />} />
                        </Route>
                        <Route path="/product-rate-plans" element={<AdminOnlyRoute><ProductRatePlansPage /></AdminOnlyRoute>} />
                        <Route path="/equipment-catalog" element={<AdminOnlyRoute><EquipmentCatalogPage /></AdminOnlyRoute>} />
                        <Route path="/device-inventory" element={<DeviceInventoryPage />} />
                        <Route path="/ad-calendar" element={<AdCalendarPage />} />
                        <Route path="/device-models" element={<AdminOnlyRoute><DeviceModelsPage /></AdminOnlyRoute>} />
                        <Route path="/incentive-rates" element={<AdminOnlyRoute><IncentiveRatesPage /></AdminOnlyRoute>} />
                        <Route path="/downloads" element={<AdminOnlyRoute><DownloadsPage /></AdminOnlyRoute>} />
                        <Route path="/channel-intake" element={<Navigate to="/leads" replace />} />
                        <Route path="/budget-categories" element={<AdminOnlyRoute><BudgetCategoriesPage /></AdminOnlyRoute>} />
                        <Route path="/my" element={<MyPage />} />
                        <Route path="/sales-ledger" element={<SalesLedgerPage />} />
                        <Route path="/seg-partners" element={<SegPartnersPage />} />
                        <Route path="/seg-calendar" element={<SegCalendarPage />} />
                        <Route path="/apartment" element={<ApartmentPage />} />
                        <Route path="/file-vault" element={<FileVaultPage />} />
                        <Route path="/admin/file-approvals" element={<AdminOnlyRoute><FileApprovalsPage /></AdminOnlyRoute>} />
                        <Route path="/custom-proposals" element={<CustomProposalsPage />} />
                        <Route path="/leads" element={<LeadsPage />} />
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </AppShell>
                  </ProtectedRoute>
                }
              />
            </Routes>
            </PeriodProvider>
          </ViewScopeProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  );
};

export default App;
