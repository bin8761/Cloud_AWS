import type { ReactNode } from "react";

type AppShellProps = {
  sidebar: ReactNode;
  topbar: ReactNode;
  children: ReactNode;
  className?: string;
};

export function AppShell({
  sidebar,
  topbar,
  children,
  className = "",
}: AppShellProps): JSX.Element {
  return (
    <div className={["min-h-screen max-w-full overflow-x-hidden bg-[var(--app-bg)] text-[var(--app-fg)]", className].join(" ")}>
      <aside
        className={[
          "hidden bg-[var(--app-surface)] p-4 xl:block",
          "xl:fixed xl:inset-y-0 xl:left-0 xl:z-20 xl:w-[260px] xl:border-b-0 xl:border-r xl:overflow-y-auto xl:px-5 xl:py-6",
        ].join(" ")}
        aria-label="Sidebar"
      >
        {sidebar}
      </aside>

      <div className="min-w-0 overflow-x-hidden xl:pl-[260px]">
        <header
          className="border-b border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2.5 sm:px-4 sm:py-3 md:px-6"
          aria-label="Topbar"
        >
          {topbar}
        </header>

        <main className="overflow-x-hidden px-3 py-3.5 sm:px-4 sm:py-4 md:px-6 md:py-6 xl:px-8">
          <div className="mx-auto w-full max-w-[1600px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
