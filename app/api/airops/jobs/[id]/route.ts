import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data, error } = await adminClient
    .from("airops_jobs")
    .select("*, status:airops_statuses(*), container:airops_containers(*, vessel:airops_vessels(*))")
    .eq("id", id)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  // If body.data contains partial data fields, merge with existing
  if (body.data) {
    const { data: existing } = await adminClient
      .from("airops_jobs")
      .select("data")
      .eq("id", id)
      .single();
    body.data = { ...(existing?.data ?? {}), ...body.data };
  }

  const { data, error } = await adminClient
    .from("airops_jobs")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
