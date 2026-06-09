import { createClient } from "@/lib/supabase/server";
import type { AiropsUser } from "@/lib/types/airops-admin";

// The hardcoded fallback superadmin email — always treated as superadmin even
// if the DB row is missing.
const FALLBACK_SUPERADMIN = "pranavnairop090@gmail.com";

// ─── getCurrentAiropsUser ─────────────────────────────────────────────────────
// Reads Supabase auth + airops_users row. Returns null if not authenticated or
// user row doesn't exist.

export async function getCurrentAiropsUser(): Promise<AiropsUser | null> {
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user?.email) return null;

  // Fallback superadmin: synthesise a row so callers always get a valid object
  if (user.email === FALLBACK_SUPERADMIN) {
    const { data: row } = await sb
      .from("airops_users")
      .select("*")
      .eq("email", FALLBACK_SUPERADMIN)
      .single();
    if (row) return row as AiropsUser;
    // Row missing — return synthetic object
    return {
      id: user.id,
      user_id: user.id,
      email: FALLBACK_SUPERADMIN,
      full_name: null,
      team: null,
      role: "superadmin",
      status: "approved",
      approved_by: null,
      approved_at: null,
      created_at: user.created_at ?? new Date().toISOString(),
    };
  }

  const { data } = await sb
    .from("airops_users")
    .select("*")
    .eq("email", user.email)
    .single();

  return (data as AiropsUser) ?? null;
}

// ─── isAdmin ──────────────────────────────────────────────────────────────────
// Returns true if the email is a superadmin or admin (or the hardcoded fallback).

export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  if (email === FALLBACK_SUPERADMIN) return true;
  // Note: when called server-side you can also pass the AiropsUser.role directly.
  return false; // role-check is done in the async version below
}

// ─── isAdminUser ─────────────────────────────────────────────────────────────
// Async version — checks the DB row. Preferred for server guards.

export async function isAdminUser(email?: string | null): Promise<boolean> {
  if (!email) return false;
  if (email === FALLBACK_SUPERADMIN) return true;
  const sb = await createClient();
  const { data } = await sb
    .from("airops_users")
    .select("role, status")
    .eq("email", email)
    .single();
  if (!data) return false;
  return (
    data.status === "approved" &&
    (data.role === "superadmin" || data.role === "admin")
  );
}

// ─── requireAdmin (server guard) ─────────────────────────────────────────────
// Use in server components / route handlers. Throws a redirect-like Response if
// user is not admin. Callers should `import { redirect } from "next/navigation"`
// and wrap with try-catch or just call this and let Next.js handle the redirect.
// Returns the user object so callers don't need to re-fetch.

export async function requireAdmin(): Promise<AiropsUser> {
  const { redirect } = await import("next/navigation");
  const sb = await createClient();
  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user?.email) {
    redirect("/login");
  }

  // TypeScript narrowing: user.email is now string (redirect throws)
  const email = user!.email as string;
  const admin = await isAdminUser(email);
  if (!admin) {
    redirect("/airops/board");
  }

  const airopsUser = await getCurrentAiropsUser();
  // Safe: if isAdminUser passed, the user exists or is the fallback.
  return airopsUser!;
}

// ─── logAudit ─────────────────────────────────────────────────────────────────
// Write a record to airops_audit_logs. Best-effort — errors are silently swallowed
// so they never break the main operation.

export async function logAudit(params: {
  actor_email: string;
  action: string;
  target_type?: string;
  target_id?: string;
  detail?: Record<string, unknown>;
}) {
  try {
    const sb = await createClient();
    await sb.from("airops_audit_logs").insert({
      actor_email: params.actor_email,
      action: params.action,
      target_type: params.target_type ?? null,
      target_id: params.target_id ?? null,
      detail: params.detail ?? null,
    });
  } catch {
    // Audit failures must never break the main flow
  }
}
