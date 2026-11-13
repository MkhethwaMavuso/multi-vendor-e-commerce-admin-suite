import { BarChart3, Boxes, LogOut, PackageCheck, Store, type LucideIcon } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { Role } from "../types";

interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
}

export function AdminLayout({ role }: { role: Role }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const superAdmin = role === "SUPER_ADMIN";
  const fulfillmentOnly = user?.role === "FULFILLMENT_STAFF";
  const items: NavItem[] = superAdmin
    ? [{ label: "Overview", to: "/admin/super", icon: BarChart3 }, { label: "Vendors", to: "/admin/super/vendors", icon: Store }, { label: "Orders", to: "/admin/super/orders", icon: PackageCheck }]
    : [
        { label: "Overview", to: "/admin/vendor", icon: BarChart3 },
        ...(!fulfillmentOnly ? [{ label: "Products", to: "/admin/vendor/products", icon: Boxes }] : []),
        { label: "Orders", to: "/admin/vendor/orders", icon: PackageCheck }
      ];

  async function handleLogout() {
    try {
      await logout();
    } finally {
      navigate("/login", { replace: true });
    }
  }

  return <div className="min-h-screen bg-canvas text-ink md:flex">
    <aside className="flex w-full flex-col border-b border-line bg-white p-5 md:fixed md:inset-y-0 md:w-64 md:border-b-0 md:border-r">
      <div className="mb-8 flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-brand text-lg font-black text-white">V</div><div><div className="font-bold">VendorHub</div><div className="text-xs text-muted">{superAdmin ? "Platform console" : "Store workspace"}</div></div></div>
      <nav className="flex gap-2 overflow-auto md:flex-col">
        {items.map(({ label, to, icon: Icon }) => <NavLink key={to} to={to} end={to.endsWith("/super") || to.endsWith("/vendor")} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${isActive ? "bg-emerald-50 text-brand" : "text-muted hover:bg-canvas hover:text-ink"}`}><Icon size={18} />{label}</NavLink>)}
      </nav>
      <div className="mt-7 flex items-center gap-3 border-t border-line pt-5 md:mt-auto">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-100 text-sm font-bold text-brand">{user?.name.slice(0, 1).toUpperCase()}</div>
        <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{user?.name}</div><div className="truncate text-xs text-muted">{user?.role.replace(/_/g, " ").toLowerCase()}</div></div>
        <button aria-label="Sign out" onClick={() => void handleLogout()} className="rounded-lg p-2 text-muted hover:bg-canvas hover:text-ink"><LogOut size={17} /></button>
      </div>
    </aside>
    <main className="min-w-0 flex-1 p-5 md:ml-64 md:p-9"><Outlet /></main>
  </div>;
}
