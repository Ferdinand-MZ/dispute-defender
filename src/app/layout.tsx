import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SandboxBanner } from "@/components/sandbox-banner";
import { Sidebar } from "@/components/sidebar";
import { Header } from "@/components/header";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "DisputeDefender — PayPal Dispute Copilot",
  description: "Evidence-grounded AI copilot for PayPal merchants responding to customer disputes",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen flex flex-col bg-background text-foreground">
          <SandboxBanner />
          <div className="flex flex-1 min-h-0">
            <Sidebar />
            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
              <Header />
              <main className="flex-1 overflow-y-auto p-8">{children}</main>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
