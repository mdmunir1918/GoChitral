import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GoChitral",
  description: "A local guide and trip planner for Chitral.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
