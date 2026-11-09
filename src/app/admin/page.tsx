import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import "../account/account.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Administrator workspace" };
export default async function Admin() {
  const identity = await requireRole("administrator", "/admin");
  return <section className="frame account-page"><h1>{identity ? "Administrator workspace" : "Access denied"}</h1>
    <p>{identity ? "Your administrator access is verified." : "This workspace requires an administrator account."}</p>
    <Link className="text-link" href="/account">Your account</Link>
  </section>;
}
