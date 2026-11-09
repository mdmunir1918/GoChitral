import Link from "next/link";
import { requireAccount } from "@/lib/auth/session";
import { signOut } from "./actions";

export const metadata = { title: "Your account" };
export default async function Account() {
  const { user, account } = await requireAccount();
  return <>
    <h1>Your account</h1>
    <p>Signed in as {user.email}</p>
    <p>Account type · {account.role}</p>
    <div className="account-links">
      {account.role === "manager" && <Link className="text-link" href="/manager">Hotel manager workspace</Link>}
      {account.role === "administrator" && <Link className="text-link" href="/admin">Administrator workspace</Link>}
      <Link className="text-link" href="/account/mfa">Authenticator security</Link>
      <Link className="text-link" href="/explore">Explore Chitral</Link>
    </div>
    <form action={signOut}><button type="submit">Sign out</button></form>
  </>;
}
