import type { ReactNode } from "react";
import "./admin.css";

export const dynamic = "force-dynamic";
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <section className="frame admin-page">{children}</section>;
}
