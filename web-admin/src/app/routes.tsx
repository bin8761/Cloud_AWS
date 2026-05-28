import { useState } from "react";
import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { NavLink } from "react-router-dom";
import { ProtectedRoute } from "@/auth/ProtectedRoute";
import { LoginPage } from "@/auth/LoginPage";
import { RegisterPage } from "@/auth/RegisterPage";
import { VerifyRegistrationPage } from "@/auth/VerifyRegistrationPage";
import { DashboardPage } from "@/dashboard/DashboardPage";
import { ComputersPage } from "@/computers/ComputersPage";
import { AppShell } from "@/ui/AppShell";
import { Button } from "@/ui/Button";
import { Drawer } from "@/ui/Drawer";
import { IconButton } from "@/ui/IconButton";
import { authStoreActions, useAuthStore } from "@/auth/auth.store";

function NotFoundPlaceholder(): JSX.Element {
  return <div className="p-6 text-sm text-[var(--app-fg)]">Page not found</div>;
}

type SidebarNavigationProps = {
  onNavigate?: () => void;
};

function SidebarNavigation({ onNavigate }: SidebarNavigationProps): JSX.Element {
  const getLinkClassName = ({ isActive }: { isActive: boolean }): string =>
    [
      "block rounded-[var(--radius-sm)] border px-3 py-2 text-sm font-medium transition-colors md:px-3.5 md:py-2.5",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--app-surface)]",
      isActive
        ? "border-[var(--app-primary)] bg-[var(--app-primary)]/10 text-[var(--app-fg)]"
        : "border-transparent text-[var(--app-muted)] hover:border-[var(--app-border)] hover:bg-[var(--app-bg)] hover:text-[var(--app-fg)]",
    ].join(" ");

  return (
    <nav aria-label="Operations dashboard navigation" className="space-y-2 md:space-y-2.5">
      <p className="px-1 text-xs font-semibold uppercase tracking-wide text-[var(--app-muted)]">Operations</p>
      <NavLink to="/dashboard" className={getLinkClassName} aria-label="Go to dashboard" onClick={onNavigate}>
        Dashboard
      </NavLink>
      <NavLink to="/computers" className={getLinkClassName} aria-label="Go to computers" onClick={onNavigate}>
        Computers
      </NavLink>
    </nav>
  );
}

type TopbarAccountContext = {
  tenantName: string;
  userDisplayName: string;
  onLogout: () => void;
  onOpenNavigation: () => void;
};

function ShellTopbarAccount({
  tenantName,
  userDisplayName,
  onLogout,
  onOpenNavigation,
}: TopbarAccountContext): JSX.Element {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 md:gap-2">
      <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
        <IconButton
          label="Open sidebar navigation"
          onClick={onOpenNavigation}
          className="xl:hidden !min-h-9 !min-w-9 px-2 text-[11px] md:!min-h-10 md:!min-w-10 md:px-2"
          aria-label="Open sidebar navigation menu"
        >
          <span aria-hidden="true" className="text-xs font-semibold leading-none">
            MENU
          </span>
        </IconButton>
        <div className="min-w-0 space-y-0.5">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-[var(--app-muted)]">Tenant</p>
          <p className="truncate text-sm font-semibold text-[var(--app-fg)]" aria-label={`Tenant name: ${tenantName}`}>
            {tenantName}
          </p>
        </div>
      </div>

      <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
        <p className="max-w-[130px] truncate text-xs text-[var(--app-fg)] sm:max-w-[220px] sm:text-sm" aria-label={`Current user: ${userDisplayName}`}>
          {userDisplayName}
        </p>
        <Button
          variant="neutral"
          size="compact"
          onClick={onLogout}
          aria-label="Log out from web admin"
          className="shrink-0 px-2.5 text-xs sm:px-3 sm:text-sm"
        >
          Logout
        </Button>
      </div>
    </div>
  );
}

function ProtectedShellLayout(): JSX.Element {
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);
  const currentUser = useAuthStore((state) => state.currentUser);
  const tenant = useAuthStore((state) => state.tenant);

  const accountContext: TopbarAccountContext = {
    tenantName: tenant?.name ?? "Unknown tenant",
    userDisplayName: currentUser?.email ?? "Unknown user",
    onLogout: () => {
      void authStoreActions.logoutUser();
    },
    onOpenNavigation: () => setIsNavigationOpen(true),
  };

  return (
    <>
      <AppShell
        sidebar={<SidebarNavigation />}
        topbar={<ShellTopbarAccount {...accountContext} />}
      >
        <Outlet />
      </AppShell>

      <Drawer
        isOpen={isNavigationOpen}
        onClose={() => setIsNavigationOpen(false)}
        title="Navigation"
        description="Operations dashboard links"
        side="left"
        widthClassName="w-full max-w-xs md:max-w-sm"
        className="xl:hidden"
        closeLabel="Close sidebar navigation"
      >
        <SidebarNavigation onNavigate={() => setIsNavigationOpen(false)} />
      </Drawer>
    </>
  );
}

export function AppRoutes(): JSX.Element {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/register/verify" element={<VerifyRegistrationPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<ProtectedShellLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/computers" element={<ComputersPage />} />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<NotFoundPlaceholder />} />
    </Routes>
  );
}


