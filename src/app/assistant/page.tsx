import type { Metadata } from "next";
import { readPublishedListings } from "@/features/catalogue/database";
import type { Listing } from "@/features/catalogue/types";
import { AssistantChat } from "@/features/assistant/chat-panel";
import "./assistant.css";

export const metadata: Metadata = { title: "AI travel assistant" };
export const dynamic = "force-dynamic";

export default async function AssistantPage() {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  let destinations: Listing[] = [], unavailable = false;
  try { destinations = (await readPublishedListings()).filter((listing) => listing.category === "destinations"); }
  catch { unavailable = true; }
  return <section className="frame assistant-page">
    <header className="assistant-heading">
      <p className="assistant-eyebrow">Local travel help · Chitral, Pakistan</p>
      <h1>Where would you <em>like to go?</em></h1>
      <p>Describe what you want to do, find places to stay, or ask for a trip draft. I’ll ask a follow-up when I need more details.</p>
    </header>
    {unavailable && <p className="assistant-error" role="status">The published place list is unavailable right now. Try refreshing the page.</p>}
    <AssistantChat destinations={destinations} today={today} />
  </section>;
}
