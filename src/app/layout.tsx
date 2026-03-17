import type { Metadata } from "next";
import { Lato } from "next/font/google";
import "./globals.css";
import SidebarWrapper from "@/components/SidebarWrapper";

const lato = Lato({ subsets: ["latin"], weight: ["100", "300", "400", "700", "900"] });

export const metadata: Metadata = {
  title: "AI CRM",
  description: "Multichannel CRM powered by Local AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning className={`${lato.className} bg-neutral-900 text-neutral-100 flex h-screen overflow-hidden`}>
        <SidebarWrapper />
        <main className="flex-1 overflow-y-auto w-full">
          {children}
        </main>
      </body>
    </html>
  );
}
