import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import AdminLayout from "@/components/admin/AdminLayout";
import AdminDashboardPage from "./pages/admin/Dashboard";
import CentresPage from "./pages/admin/Centres";
import StaffPage from "./pages/admin/Staff";
import AdminsPage from "./pages/admin/Admins";
import DailyActivityPage from "./pages/admin/DailyActivity";
import ReportsPage from "./pages/admin/Reports";
import ApprovalsPage from "./pages/admin/Approvals";
import SettingsPage from "./pages/admin/Settings";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route
              path="/admin"
              element={
                <ProtectedRoute requiredRole="admin">
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<AdminDashboardPage />} />
              <Route path="centres" element={<CentresPage />} />
              <Route path="staff" element={<StaffPage />} />
              <Route path="admins" element={<AdminsPage />} />
              <Route path="activity" element={<DailyActivityPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="approvals" element={<ApprovalsPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
