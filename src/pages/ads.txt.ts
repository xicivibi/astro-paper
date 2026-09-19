import type { APIRoute } from "astro";
import { adsTxt, monetization } from "@/config/monetization";

export const GET: APIRoute = () =>
  new Response(adsTxt(monetization), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
