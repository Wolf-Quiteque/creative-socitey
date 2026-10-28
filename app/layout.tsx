import type { Metadata, Viewport } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { PwaRegister } from "@/components/pwa/pwa";
import { CAPTURE_INSTALL_SCRIPT, IOS_STARTUP_IMAGES } from "@/lib/pwa";
import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Creative Society", template: "%s · Creative Society" },
  description: "Gestão das lojas Creative Society: vendas, stock, finanças e equipa.",
  applicationName: "CS Gestão",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "CS Gestão", statusBarStyle: "default", startupImage: IOS_STARTUP_IMAGES },
  formatDetection: { telephone: false, email: false, address: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbf7f2" },
    { media: "(prefers-color-scheme: dark)", color: "#1b1411" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-AO" suppressHydrationWarning className={`${fraunces.variable} ${jakarta.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: CAPTURE_INSTALL_SCRIPT }} />
      </head>
      <body>
        <PwaRegister />
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          {children}
          <Toaster
            position="top-center"
            toastOptions={{
              classNames: {
                toast: "!rounded-2xl !border-line !bg-surface !text-ink !shadow-lift !font-sans",
                description: "!text-muted",
                success: "[&_[data-icon]]:!text-success",
                error: "[&_[data-icon]]:!text-danger",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
