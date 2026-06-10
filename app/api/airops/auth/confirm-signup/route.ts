import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Auto-confirms a freshly-signed-up user using the service-role key, so new
 * users can sign in immediately even if the Supabase project still has
 * "Confirm email" enabled. Also registers them in airops_users (pending).
 *
 * Called by the signup page right after auth.signUp().
 */
export async function POST(req: NextRequest) {
  const { userId, email, team } = (await req.json()) as {
    userId?: string;
    email?: string;
    team?: string;
  };

  if (!userId || !email) {
    return NextResponse.json({ error: "userId and email are required" }, { status: 400 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({ error: "Service role key not configured" }, { status: 500 });
  }

  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Mark the email as confirmed
  const { error: confirmErr } = await admin.auth.admin.updateUserById(userId, {
    email_confirm: true,
  });
  if (confirmErr) {
    return NextResponse.json({ error: confirmErr.message }, { status: 500 });
  }

  // 2. Register in airops_users as a pending user (admin approves later)
  await admin
    .from("airops_users")
    .upsert(
      {
        user_id: userId,
        email,
        team: team || null,
        role: "user",
        status: "pending",
      },
      { onConflict: "email" }
    );

  return NextResponse.json({ success: true });
}
