import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { UIProvider } from "@/providers/UIProvider";
import LayoutContent from "@/components/LayoutContent";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-ui",
});

const jetbrainsMono = JetBrains_Mono({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "QuickWash Smart Hub — IoT Car Wash Dashboard",
  description: "Real-time IoT monitoring dashboard for smart car wash facilities. Track sensors, cameras, revenue, and machine status.",
};

// Mobile chrome tint + correct scaling on every device.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#081420",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}>
      <body className="antialiased" suppressHydrationWarning>
        <UIProvider>
          <LayoutContent>{children}</LayoutContent>
        </UIProvider>
      </body>
    </html>
  );
}
