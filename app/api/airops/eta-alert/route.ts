import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { transporter } from "@/lib/email/mailer";

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { job_id, old_eta, new_eta } = body as {
    job_id: string;
    old_eta: string | null;
    new_eta: string;
  };

  if (!job_id || !new_eta) {
    return NextResponse.json({ error: "job_id and new_eta are required" }, { status: 400 });
  }

  // Fetch full job
  const { data: job, error: jobErr } = await adminClient
    .from("airops_jobs")
    .select("*")
    .eq("id", job_id)
    .single();

  if (jobErr || !job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const d = job.data ?? {};
  const consigneeEmail = d.consignee_email?.trim();

  if (!consigneeEmail) {
    return NextResponse.json(
      { success: false, message: "No consignee email on file — alert not sent." },
      { status: 200 }
    );
  }

  const orderNo = d.order_no ?? job_id.slice(0, 8).toUpperCase();
  const consigneeName = d.consignee_name ?? "Consignee";
  const vesselName = d.vessel_name ?? "—";
  const containers = (d.container_numbers ?? []).join(", ") || "—";
  const pol = d.pol ?? "—";

  const fmtDate = (s: string | null) => {
    if (!s) return "—";
    return new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  };

  const subject = `ETA Change Notice — ${orderNo} — ${vesselName}`;
  const text = `Dear ${consigneeName},

We wish to inform you that the Estimated Time of Arrival (ETA) for your shipment has been updated.

Order No     : ${orderNo}
Vessel       : ${vesselName}
POL          : ${pol}
Container(s) : ${containers}

Previous ETA : ${fmtDate(old_eta)}
Revised ETA  : ${fmtDate(new_eta)}

Please plan accordingly. Should you have any questions, do not hesitate to contact us.

Regards,
MP Cargo Operations
mpcargolille@gmail.com`;

  let smtpError: string | null = null;
  try {
    await transporter.sendMail({
      from: `MP Cargo Ops <${process.env.GMAIL_USER}>`,
      to: consigneeEmail,
      subject,
      text,
    });
  } catch (err: unknown) {
    smtpError = err instanceof Error ? err.message : String(err);
  }

  // Log in email_drafts table
  await adminClient.from("airops_email_drafts").insert({
    job_id,
    to: consigneeEmail,
    subject,
    body: text,
    sent: smtpError === null,
    sent_at: smtpError === null ? new Date().toISOString() : null,
  });

  if (smtpError) {
    return NextResponse.json({ success: false, smtpError }, { status: 207 });
  }

  return NextResponse.json({ success: true, to: consigneeEmail });
}
