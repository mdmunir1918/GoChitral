import { fixtures } from "@/data/catalogue-fixtures";
import { categoryLabels, type Category, type Listing } from "./types";

const published = fixtures.filter((item) => item.status === "published");
const destinations = published.filter((item) => item.category === "destinations");
const visible = published.filter((item) => item.category === "destinations" ||
  destinations.some((destination) => destination.id === item.destinationId));
const locations = [...new Set(visible.map((item) => item.location))].sort();
const pageSize = 3;

type Params = Record<string, string | string[] | undefined>;
type Filters = { q: string; category: Category | ""; location: string; sort: "guide" | "az" | "za" };

function first(value: Params[string]) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export function pageUrl(filters: Filters, page: number) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.category) params.set("category", filters.category);
  if (filters.location) params.set("location", filters.location);
  if (filters.sort !== "guide") params.set("sort", filters.sort);
  if (page > 1) params.set("page", String(page));
  return params.size ? `/explore?${params}` : "/explore";
}

// Routes read public catalogue data only through this adapter.
export const catalogue = {
  async search(params: Params) {
    const category = first(params.category);
    const location = first(params.location);
    const sort = first(params.sort);
    const filters: Filters = {
      q: first(params.q).trim().slice(0, 100),
      category: Object.hasOwn(categoryLabels, category) ? category as Category : "",
      location: locations.includes(location) ? location : "",
      sort: sort === "az" || sort === "za" ? sort : "guide",
    };
    const query = filters.q.toLowerCase();
    const matches = visible.filter((item) =>
      (!filters.category || item.category === filters.category) &&
      (!filters.location || item.location === filters.location) &&
      [item.title, item.location, item.summary].join(" ").toLowerCase().includes(query)
    );
    if (filters.sort !== "guide") {
      const direction = filters.sort === "az" ? 1 : -1;
      matches.sort((a, b) => direction * a.title.localeCompare(b.title, "en") || a.id.localeCompare(b.id));
    }
    const pages = Math.max(1, Math.ceil(matches.length / pageSize));
    const rawPage = first(params.page);
    const page = /^\d+$/.test(rawPage) ? Math.min(pages, Math.max(1, Number(rawPage))) : 1;
    return { filters, locations, total: matches.length, pages, page,
      items: matches.slice((page - 1) * pageSize, page * pageSize) };
  },

  async detail(category: string, slug: string) {
    const item = visible.find((record) => record.category === category && record.slug === slug);
    if (!item) return null;
    const destinationId = item.destinationId ?? item.id;
    const related = visible.filter((other) => other.id !== item.id &&
      (other.id === destinationId || other.destinationId === destinationId));
    return { item, related };
  },

  async paths() {
    return visible.map(({ category, slug }: Listing) => ({ category, slug }));
  },
};
