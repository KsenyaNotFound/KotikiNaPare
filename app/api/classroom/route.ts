import { env } from "cloudflare:workers";
import { classroom } from "../../../lib/classroom.mjs";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return classroom(request, env.DB);
}

export const POST = GET;
