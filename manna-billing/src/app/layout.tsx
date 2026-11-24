import "./globals.css";
import type { Metadata, Viewport } from "next";
import TitleBar from "@/components/TitleBar";
import RegisterSW from "@/components/RegisterSW";

export const metadata: Metadata = { title: "Manna Billing", manifest: "/manifest.webmanifest" };
export const viewport: Viewport = { themeColor: "#1f3a5f", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <RegisterSW />
        <div className="win">
          <TitleBar />
          {children}
        </div>
      </body>
    </html>
  );
}
