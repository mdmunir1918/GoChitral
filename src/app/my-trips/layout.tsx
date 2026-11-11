import type { ReactNode } from "react";
import "./trips.css";
export const dynamic = "force-dynamic";
export const metadata = { title: "My trips", robots: { index: false, follow: false } };
export default function Layout({ children }: { children: ReactNode }) { return <section className="frame trips-page">{children}</section>; }
