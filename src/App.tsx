import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
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
// import RecentActivitiesPage from "./pages/RecentActivitiesPage.tsx"; // 컴포넌트 보관 중 — 추후 대시보드 위젯 재사용 예정
import MenuManagerPage from "./pages/MenuManagerPage.tsx";
import DownloadsPage from "./pages/DownloadsPage.tsx";
import NotFound from "./pages/NotFound.tsx";
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
import ApartmentPage from "./pages/ApartmentPage.tsx";
import FileVaultPage from "./pages/FileVaultPage.tsx";
import FileApprovalsPage from "./pages/FileApprovalsPage.tsx";
import AddonRetentionAdminPage from "./pages/AddonRetentionAdminPage.tsx";
import AddonTasksPage from "./pages/AddonTasksPage.tsx";
import CustomProposalsPage from "./pages/CustomProposalsPage.tsx";
import LeadsPage from "./pages/LeadsPage.tsx";
import ReservationsPage from "./pages/reservations/ReservationsPage.tsx";
import ReservationStatsPage from "./pages/reservations/ReservationStatsPage.tsx";
import ResponseTimePage from "./pages/reservations/ResponseTimePage.tsx";
import ProfitPage from "./pages/ProfitPage.tsx";
import DogmaruPage from "./pages/DogmaruPage.tsx";
import TrashPage from "./pages/TrashPage.tsx";
import SmsTemplatePage from "./pages/SmsTemplatePage.tsx";
import SalesAnalyticsPage from "./pages/SalesAnalyticsPage.tsx";
import { LeadsRealtimeNotifier } from "./components/leads/LeadsRealtimeNotifier.tsx";
import { ReservationAlertSystem } from "./pages/reservations/ReservationAlertSystem.tsx";
// 영업 활동 리포트 — 1단계 신규 독립 카테고리
import MyWorkDashboard from "./pages/work-report/MyWorkDashboard.tsx";
import TeamWorkDashboard from "./pages/work-report/TeamWorkDashboard.tsx";
import DailyWorkReport from "./pages/work-report/DailyWorkReport.tsx";
import ActivityLogs from "./pages/work-report/ActivityLogs.tsx";
import ProgressDelay from "./pages/work-report/ProgressDelay.tsx";
import IncentiveDashboard from "./pages/work-report/IncentiveDashboard.tsx";
import ReportSettings from "./pages/work-report/ReportSettings.tsx";
import StaffPerformanceAnalysis from "./pages/work-report/StaffPerformanceAnalysis.tsx";
import ChannelFunnelPage from "./pages/work-report/ChannelFunnelPage.tsx";

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
                      <LeadsRealtimeNotifier />
                      <Routes>
                        <Route path="/" element={<Index />} />
                        <Route path="/input" element={<InputPage />} />
                        <Route path="/activities" element={<ActivitiesPage />} />
                        <Route path="/recent-activities" element={<Navigate to="/activities" replace />} />
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
                        <Route path="/plan-change-calendar" element={<Navigate to="/activities?tab=plan-change" replace />} />
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
                        {/* SEG 활동 관리 단일 화면으로 통합 — 기존 딥링크는 리다이렉트 */}
                        <Route path="/seg-calendar" element={<Navigate to="/seg-partners?tab=partners" replace />} />
                        <Route path="/apartment" element={<Navigate to="/seg-partners?tab=apartment" replace />} />
                        <Route path="/file-vault" element={<FileVaultPage />} />
                        <Route path="/admin/file-approvals" element={<AdminOnlyRoute><FileApprovalsPage /></AdminOnlyRoute>} />
                        <Route path="/custom-proposals" element={<CustomProposalsPage />} />
                        <Route path="/leads" element={<LeadsPage />} />
                        <Route path="/dogmaru" element={<DogmaruPage />} />
                        <Route path="/profit" element={<AdminOnlyRoute><ProfitPage /></AdminOnlyRoute>} />
                        <Route path="/trash" element={<AdminOnlyRoute><TrashPage /></AdminOnlyRoute>} />
                        <Route path="/sms-templates" element={<AdminOnlyRoute><SmsTemplatePage /></AdminOnlyRoute>} />
                        <Route path="/sales-analytics" element={<AdminOnlyRoute><SalesAnalyticsPage /></AdminOnlyRoute>} />
                        {/* 사전예약 관리 */}
                        <Route path="/reservations" element={<ReservationsPage />} />
                        <Route path="/reservations/stats" element={<ReservationStatsPage />} />
                        <Route path="/reservations/response-time" element={<ResponseTimePage />} />
                        {/* 영업 활동 리포트 — 신규 독립 카테고리 (1단계: mock data 레이아웃) */}
                        <Route path="/work-report/my-dashboard" element={<MyWorkDashboard />} />
                        <Route path="/work-report/team-dashboard" element={<TeamWorkDashboard />} />
                        <Route path="/work-report/daily-report" element={<DailyWorkReport />} />
                        <Route path="/work-report/activity-logs" element={<ActivityLogs />} />
                        <Route path="/work-report/progress-delay" element={<ProgressDelay />} />
              <Route path="/work-report/staff-performance" element={<StaffPerformanceAnalysis />} />
                         <Route path="/work-report/channel-funnel" element={<ChannelFunnelPage />} />
                        <Route path="/work-report/incentive" element={<IncentiveDashboard />} />
                        <Route path="/work-report/settings" element={<AdminOnlyRoute><ReportSettings /></AdminOnlyRoute>} />
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </AppShell>
                    <ReservationAlertSystem />
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




