import type { ReactNode } from "react";
import "./manager.css";
export const dynamic = "force-dynamic";
export default function ManagerLayout({ children }: { children: ReactNode }) { return <section className="frame manager-page">{children}</section>; }
