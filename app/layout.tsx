import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Newsreader } from "next/font/google";
import Sidebar from "@/components/Sidebar";
import "./globals.css";

const sans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const serif = Newsreader({ variable: "--font-serif", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Study copilot",
  description: "Upload a test paper, see your mistakes grouped by idea.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body>
        <div className="shell">
          <Suspense fallback={<aside className="side"><span className="brand"><span className="mark" aria-hidden="true">S</span>Study copilot</span></aside>}>
            <Sidebar />
          </Suspense>
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
