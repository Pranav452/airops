import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { job_id, to, cc, subject, emailBody, sendNow } = body as {
    job_id?: string;
    to: string;
    cc?: string;
    subject: string;
    emailBody: string;
    sendNow?: boolean;
  };

  if (!to?.trim() || !subject?.trim() || !emailBody?.trim()) {
    return NextResponse.json({ error: "to, subject, and body are required" }, { status: 400 });
  }

  const { data, error } = await adminClient
    .from("airops_email_drafts")
    .insert({
      job_id: job_id ?? null,
      to: to.trim(),
      cc: cc?.trim() ?? null,
      subject: subject.trim(),
      body: emailBody.trim(),
      sent: sendNow === true,
      sent_at: sendNow === true ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, draft: data });
}
