import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Base das URLs absolutas da prévia (og:image). Sem a env, na Vercel o Next
  // usa o domínio de produção do projeto.
  metadataBase: process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL) : undefined,
  title: "Barbearia — Agenda online",
  description:
    "Seus clientes agendam sozinhos pelo link, você confirma pelo WhatsApp com um toque.",
  appleWebApp: {
    capable: true,
    title: "Barbearia",
    // "default": o iPhone escolhe a barra de status (clara ou escura) pelo
    // tema do sistema. "black-translucent" deixaria texto branco sobre o
    // cabeçalho branco do tema claro.
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  // Conteúdo até as bordas do iPhone; os cabeçalhos e a barra de baixo
  // compensam com env(safe-area-inset-*).
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: o next-themes põe a classe "dark" no <html>
    // antes do React hidratar (sem piscar branco no tema escuro).
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          {children}
          <Toaster position="top-center" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
