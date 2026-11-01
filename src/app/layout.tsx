import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SandboxBanner } from "@/components/sandbox-banner";
import { Sidebar } from "@/components/sidebar";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "DisputeDefender — PayPal Dispute Copilot",
  description: "Evidence-grounded AI copilot for PayPal merchants responding to customer disputes",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#001c64",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <div className="flex min-h-dvh flex-col lg:flex-row">
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <SandboxBanner />
            <main className="mx-auto w-full max-w-[1320px] flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
