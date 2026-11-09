import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: { default: "GoChitral | Chitral travel guide", template: "%s | GoChitral" },
  description: "Explore Chitral’s mountain valleys with the GoChitral travel guide.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">Skip to content</a>
        <SiteHeader />
        <main id="main" tabIndex={-1}>{children}</main>
        <footer className="site-footer">
          <div className="frame footer-row">
            <span>GoChitral <span className="divider" aria-hidden="true">/</span> Travel guide</span>
            <Link href="/explore">Explore Chitral <span aria-hidden="true">↗</span></Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
