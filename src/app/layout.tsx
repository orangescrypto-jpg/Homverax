import type { Metadata, Viewport } from "next";
import { Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { Toaster } from "@/components/ui/sonner";
import ChatbotWidget from "@/components/features/ChatbotWidget";
import WhatsAppChat from "@/components/features/WhatsAppChat";
import PWAInstallBanner from "@/components/PWAInstallBanner";
import PWARegistrar from "@/components/shared/PWARegistrar";
import MaintenanceGate from "@/components/shared/MaintenanceGate";
import { APP_NAME, APP_DESCRIPTION, APP_URL } from "@/lib/constants";

// Self-hosted at build time — no runtime request to Google Fonts, no
// render-blocking @import, only the declared weights are shipped.
const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1a2e" },
  ],
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: `${APP_NAME} — Nigeria's Trusted Property & Services Marketplace`,
    template: `%s | ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  keywords: [
    "Nigeria real estate", "property listings Nigeria", "houses for rent Lagos",
    "apartments Abuja", "buy land Nigeria", "verified agents Nigeria",
    "escrow Nigeria", "HomveraX", "marketplace Nigeria",
    "shortlet Lagos", "building materials Nigeria", "artisans Nigeria",
    "solar equipment Nigeria", "home services Nigeria", "escrow marketplace Nigeria",
  ],
  authors: [{ name: "HomveraX", url: APP_URL }],
  creator: "HomveraX",
  publisher: "HomveraX",
  openGraph: {
    type: "website",
    locale: "en_NG",
    url: APP_URL,
    siteName: APP_NAME,
    title: `${APP_NAME} — Nigeria's Trusted Property & Services Marketplace`,
    description: APP_DESCRIPTION,
    images: [
      {
        url: `${APP_URL}/og-image.svg`,
        width: 1200,
        height: 630,
        alt: `${APP_NAME} — Find, Buy, Rent & Transact Safely`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${APP_NAME} — Nigeria's Trusted Property Marketplace`,
    description: APP_DESCRIPTION,
    images: [`${APP_URL}/og-image.svg`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: APP_URL,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-NG" suppressHydrationWarning className={`${inter.variable} ${playfairDisplay.variable}`}>
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body>
        <ThemeProvider>
          <AuthProvider>
            <PWARegistrar />
            {/*
              ✅ MaintenanceGate wraps all children.
              If admin sets maintenanceMode = true in Firestore, all non-admin
              visitors see the maintenance page instead of the site.
            */}
            <MaintenanceGate>
              {children}
            </MaintenanceGate>
            {/*
              ✅ ChatbotWidget reads enableAiChatbot flag from platformSettings.
              Admin turns it on/off from /admin/settings.
            */}
            <ChatbotWidget />
            {/*
              ✅ WhatsAppChat reads enableLiveChat flag + whatsApp config from
              platformSettings. Admin turns it on/off from /admin/settings.
            */}
            <WhatsAppChat />
            {/* ✅ PWA install banner — shown after 3s, gated by enablePWA flag */}
            <PWAInstallBanner />
            <Toaster richColors position="top-right" />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
