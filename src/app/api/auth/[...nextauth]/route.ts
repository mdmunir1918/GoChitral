import { handlers } from "@/auth";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const response = await handlers.GET(request);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function POST(request: NextRequest) {
  const response = await handlers.POST(request);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
