import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface AiDraftRequest {
  job_id: string;
  instruction: string;
}

interface AiDraftResponse {
  to: string;
  cc: string;
  subject: string;
  body: string;
}

export async function POST(req: NextRequest) {
  let body: AiDraftRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { job_id, instruction } = body;
  if (!job_id?.trim() || !instruction?.trim()) {
    return NextResponse.json({ error: "job_id and instruction are required" }, { status: 400 });
  }

  // Fetch the job with container + vessel context
  const { data: job, error: jobError } = await adminClient
    .from("airops_jobs")
    .select(`*, container:airops_containers(*, vessel:airops_vessels(*))`)
    .eq("id", job_id)
    .single();

  if (jobError || !job) {
    return NextResponse.json(
      { error: jobError?.message ?? "Job not found" },
      { status: 404 }
    );
  }

  const jobData = job.data ?? {};
  const vessel = job.container?.vessel;
  const containerNumber = job.container?.container_number ?? null;

  // Build a rich context object for the model
  const shipmentContext = {
    ...jobData,
    // Supplement with vessel data if not present in jobData
    vessel_name: jobData.vessel_name ?? vessel?.name ?? null,
    etd: jobData.etd ?? vessel?.etd ?? null,
    eta: jobData.eta ?? vessel?.eta ?? null,
    pol: jobData.pol ?? vessel?.pol ?? null,
    pod: vessel?.pod ?? null,
    container_number_on_file: containerNumber,
  };

  const systemPrompt = `You are a senior operations executive at MP Cargo, a sea-freight forwarding company.
You write professional, concise, and accurate sea-freight emails on behalf of MP Cargo's operations team.
Given a shipment job's full data and an instruction, draft a complete email.
Pre-fill the "to" field with the consignee email from the job data if available.
Always respond with STRICT JSON exactly matching this schema:
{
  "to": "recipient email address or empty string",
  "cc": "cc email address or empty string",
  "subject": "email subject line",
  "body": "full email body text"
}
No markdown, no extra keys, no explanation — only the JSON object.`;

  const userPrompt = `Shipment job data:
${JSON.stringify(shipmentContext, null, 2)}

Instruction: ${instruction}

Draft the email as JSON.`;

  const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.4,
    }),
  });

  if (!openaiRes.ok) {
    const errText = await openaiRes.text().catch(() => "unknown error");
    return NextResponse.json(
      { error: `OpenAI error ${openaiRes.status}: ${errText}` },
      { status: 500 }
    );
  }

  const openaiData = await openaiRes.json();
  const rawContent = openaiData?.choices?.[0]?.message?.content;

  if (!rawContent) {
    return NextResponse.json({ error: "OpenAI returned an empty response" }, { status: 500 });
  }

  let draft: AiDraftResponse;
  try {
    draft = JSON.parse(rawContent) as AiDraftResponse;
  } catch {
    return NextResponse.json(
      { error: "Failed to parse AI response as JSON", raw: rawContent },
      { status: 500 }
    );
  }

  return NextResponse.json(draft);
}
