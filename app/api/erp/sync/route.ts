import { NextRequest, NextResponse } from "next/server";
import { runErpSync } from "@/lib/erp/sync";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 300;

// POST /api/erp/sync          — incremental sync from ERP MSSQL
// POST /api/erp/sync?wipe=1   — wipe seed/demo rows first, then sync
// Allowed for: logged-in dashboard users (session cookie), or callers
// providing x-sync-secret matching ERP_SYNC_SECRET (cron/scripts).
export async function POST(req: NextRequest) {
  const secret = process.env.ERP_SYNC_SECRET;
  const provided =
    req.headers.get("x-sync-secret") ?? req.nextUrl.searchParams.get("secret");
  let authorized = !!secret && provided === secret;
  if (!authorized) {
    const sb = await createClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    authorized = !!user;
  }
  if (!authorized) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const wipe = req.nextUrl.searchParams.get("wipe") === "1";
  const started = Date.now();
  try {
    const result = await runErpSync({ wipe });
    return NextResponse.json({ ok: true, ms: Date.now() - started, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, ms: Date.now() - started, error: message },
      { status: 500 }
    );
  }
}
