interface PageShellProps {
  readonly children: React.ReactNode;
}

export function PageShell({ children }: PageShellProps) {
  return (
    <main className="flex-1 overflow-y-auto bg-background">
      <div className="mx-auto max-w-6xl space-y-6 p-8">
        {children}
      </div>
    </main>
  );
}
