import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AdminLayout } from "./components/AdminLayout";
import { useAuth } from "./context/AuthContext";
import { AuthPage } from "./pages/AuthPage";
import { Dashboard } from "./pages/Dashboard";
import { OrdersPage } from "./pages/OrdersPage";
import { ProductsPage } from "./pages/ProductsPage";
import { VendorsPage } from "./pages/VendorsPage";
import type { Role } from "./types";

function LoadingScreen() {
  return <div className="grid min-h-screen place-items-center bg-canvas text-sm font-medium text-muted">Loading VendorHub...</div>;
}

function ProtectedLayout({ role }: { role: Role }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (user.role !== role && !(role === "VENDOR_ADMIN" && user.role === "FULFILLMENT_STAFF")) {
    return <Navigate to={user.role === "SUPER_ADMIN" ? "/admin/super" : "/admin/vendor"} replace />;
  }
  return <AdminLayout role={role} />;
}

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return <Navigate to={user ? (user.role === "SUPER_ADMIN" ? "/admin/super" : "/admin/vendor") : "/login"} replace />;
}

function VendorAdminOnly({ children }: { children: JSX.Element }) {
  const { user } = useAuth();
  return user?.role === "VENDOR_ADMIN" ? children : <Navigate to="/admin/vendor/orders" replace />;
}

export default function App() {
  return <Routes>
    <Route path="/" element={<HomeRedirect />} />
    <Route path="/login" element={<AuthPage mode="login" />} />
    <Route path="/register" element={<AuthPage mode="register" />} />
    <Route path="/admin/super" element={<ProtectedLayout role="SUPER_ADMIN" />}>
      <Route index element={<Dashboard isSuperAdmin />} />
      <Route path="vendors" element={<VendorsPage />} />
      <Route path="orders" element={<OrdersPage isSuperAdmin />} />
    </Route>
    <Route path="/admin/vendor" element={<ProtectedLayout role="VENDOR_ADMIN" />}>
      <Route index element={<Dashboard isSuperAdmin={false} />} />
      <Route path="products" element={<VendorAdminOnly><ProductsPage /></VendorAdminOnly>} />
      <Route path="orders" element={<OrdersPage />} />
    </Route>
    <Route path="*" element={<HomeRedirect />} />
  </Routes>;
}
