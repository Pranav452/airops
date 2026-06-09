import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { transporter } from "@/lib/email/mailer";

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

  let smtpError: string | null = null;

  // Attempt SMTP send when sendNow is true
  if (sendNow === true) {
    try {
      await transporter.sendMail({
        from: process.env.GMAIL_USER,
        to: to.trim(),
        ...(cc?.trim() ? { cc: cc.trim() } : {}),
        subject: subject.trim(),
        text: emailBody.trim(),
      });
    } catch (err: unknown) {
      smtpError = err instanceof Error ? err.message : String(err);
    }
  }

  // Always save to DB as audit trail; mark sent=false if SMTP failed
  const actualSent = sendNow === true && smtpError === null;

  const { data, error } = await adminClient
    .from("airops_email_drafts")
    .insert({
      job_id: job_id ?? null,
      to: to.trim(),
      cc: cc?.trim() ?? null,
      subject: subject.trim(),
      body: emailBody.trim(),
      sent: actualSent,
      sent_at: actualSent ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (smtpError) {
    return NextResponse.json(
      { success: false, draft: data, smtpError, message: "Draft saved but email could not be sent." },
      { status: 207 }
    );
  }

  return NextResponse.json({ success: true, draft: data });
}
