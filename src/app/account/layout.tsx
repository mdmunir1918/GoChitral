import type { ReactNode } from "react";
import "./account.css";

export const dynamic = "force-dynamic";
export default function AccountLayout({ children }: { children: ReactNode }) {
  return <section className="frame account-page">{children}</section>;
}
