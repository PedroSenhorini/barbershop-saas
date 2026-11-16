export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-muted/30">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background shadow-sm">
        {children}
      </div>
    </div>
  );
}
