import { readPlannerCatalogue } from "@/features/planner/database";
import { newDraft } from "@/features/planner/model";
import { Planner } from "./planner";
import "./plan.css";

export const metadata = { title: "Plan your trip" };
export const dynamic = "force-dynamic";
export default async function PlanPage({ searchParams }: PageProps<"/plan">) {
  const query = await searchParams;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  let catalogue: Awaited<ReturnType<typeof readPlannerCatalogue>> = [], unavailable = false;
  try { catalogue = await readPlannerCatalogue(); } catch { unavailable = true; }
  return <section className="frame planner-page"><p className="listing-location">Your Chitral itinerary</p><h1>Plan your <em>trip.</em></h1>
    <p>Choose your days and places, then check the estimated cost. No account needed.</p>
    {unavailable && <div role="status" className="plan-notice"><p>Places could not be loaded. Your saved draft is still on this device.</p><form action="/plan"><button type="submit">Reload choices</button></form></div>}
    <Planner initial={newDraft(today)} catalogue={catalogue} addId={typeof query.add === "string" ? query.add.slice(0, 100) : ""} />
    <noscript><p>Turn on JavaScript to edit a trip and keep a draft on this device. You can still browse places in Explore.</p></noscript>
  </section>;
}
