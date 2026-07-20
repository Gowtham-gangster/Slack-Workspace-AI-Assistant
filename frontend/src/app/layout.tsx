import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "../components/Providers";
import { AuthProvider } from "../components/AuthContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Slack AI Workspace Assistant",
  description: "Turn Workspace Noise Into Actionable Intelligence. AI-powered Slack Workspace Assistant for searching conversations, summarizing channels, finding decisions, tracking action items, and improving workplace productivity.",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/slack-app-icon.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Slack AI",
  },
  openGraph: {
    title: "Slack AI Workspace Assistant",
    description: "Turn Workspace Noise Into Actionable Intelligence.",
    url: "https://slackai.app",
    siteName: "Slack AI Workspace Assistant",
    images: [
      {
        url: "/slack-app-icon.png",
        width: 512,
        height: 512,
        alt: "Slack AI Workspace Assistant Logo",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Slack AI Workspace Assistant",
    description: "Turn Workspace Noise Into Actionable Intelligence.",
    images: ["/slack-app-icon.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full dark`}
      style={{ colorScheme: 'dark' }}
      suppressHydrationWarning
    >
      <body className="h-full bg-background text-foreground antialiased selection:bg-primary/35" suppressHydrationWarning>
        <Providers>
          <AuthProvider>
            {children}
          </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}
