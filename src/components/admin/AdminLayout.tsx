import { useAuth } from "@/contexts/AuthContext";
import { NavLink } from "@/components/NavLink";
import { Outlet, useLocation } from "react-router-dom";
import khLogo from "@/assets/kh-logo.png";
import {
  LayoutDashboard,
  Building2,
  Users,
  ShieldCheck,
  CalendarDays,
  FileBarChart,
  CheckCircle2,
  CalendarCheck,
  HeartHandshake,
  Settings as SettingsIcon,
  LogOut,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/reports", label: "Reports", icon: FileBarChart },
  { to: "/admin/referrals", label: "Referrals", icon: HeartHandshake },
  { to: "/admin/approvals", label: "Approvals", icon: CheckCircle2 },
  { to: "/admin/leaves", label: "Leave Requests", icon: CalendarCheck },
  { to: "/admin/centres", label: "Centres", icon: Building2 },
  { to: "/admin/activity", label: "Daily Activity", icon: CalendarDays },
  { to: "/admin/staff", label: "Staff", icon: Users },
  { to: "/admin/admins", label: "Admins", icon: ShieldCheck },
  { to: "/admin/settings", label: "Settings", icon: SettingsIcon },
];

export default function AdminLayout() {
  const { profile, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const sidebar = (
    <aside className="flex h-full w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex h-16 items-center gap-3 px-5 border-b border-sidebar-border">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white p-1 shrink-0">
          <img src={khLogo} alt="Karunya Hrudayalaya" className="h-full w-full object-contain" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold leading-tight truncate">Karunya Hrudayalaya</p>
          <p className="text-xs text-sidebar-foreground/60">Cardiac Centre · Admin</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.end}
            onClick={() => setMobileOpen(false)}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            activeClassName="bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary"
          >
            <it.icon className="h-4 w-4" />
            {it.label}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-sidebar-border text-xs text-sidebar-foreground/50">
        v1.0 · Marketing Suite
      </div>
    </aside>
  );

  const currentTitle =
    items.find((i) =>
      i.end ? location.pathname === i.to : location.pathname.startsWith(i.to)
    )?.label || "Admin";

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <div className="hidden md:block">{sidebar}</div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0">{sidebar}</div>
        </div>
      )}

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b bg-card px-4 md:px-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold">{currentTitle}</h1>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-3 h-10">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                  {profile?.full_name?.[0]?.toUpperCase() || "A"}
                </div>
                <div className="hidden md:block text-left">
                  <p className="text-sm font-medium leading-tight">
                    {profile?.full_name || "Admin"}
                  </p>
                  <p className="text-xs text-muted-foreground leading-tight">
                    {profile?.employee_id}
                  </p>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>{profile?.full_name}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut}>
                <LogOut className="mr-2 h-4 w-4" /> Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Content */}
        <main className={cn("flex-1 overflow-y-auto p-4 md:p-6")}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
