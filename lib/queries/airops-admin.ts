"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type {
  AiropsUser,
  AiropsRole,
  AiropsColumnAssignment,
  AiropsColumnRequiredField,
  AiropsAutoProgression,
} from "@/lib/types/airops-admin";

// ─── Hardcoded fallback (mirrors server-side constant) ────────────────────────
const FALLBACK_SUPERADMIN = "pranavnairop090@gmail.com";

// ─── useCurrentAiropsUser ─────────────────────────────────────────────────────
// Returns the current user's airops_users row (or synthetic fallback for the
// hardcoded admin).

export function useCurrentAiropsUser() {
  return useQuery<AiropsUser | null>({
    queryKey: ["airops", "current-user"],
    queryFn: async () => {
      const sb = createClient();
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user?.email) return null;

      if (user.email === FALLBACK_SUPERADMIN) {
        const { data: row } = await sb
          .from("airops_users")
          .select("*")
          .eq("email", FALLBACK_SUPERADMIN)
          .single();
        if (row) return row as AiropsUser;
        return {
          id: user.id,
          user_id: user.id,
          email: FALLBACK_SUPERADMIN,
          full_name: null,
          team: null,
          role: "superadmin" as AiropsRole,
          status: "approved" as const,
          approved_by: null,
          approved_at: null,
          created_at: new Date().toISOString(),
        };
      }

      const { data } = await sb
        .from("airops_users")
        .select("*")
        .eq("email", user.email)
        .single();
      return (data as AiropsUser) ?? null;
    },
    staleTime: 60_000,
  });
}

// ─── useIsAdmin ───────────────────────────────────────────────────────────────
// Lightweight client hook for conditional nav rendering.

export function useIsAdmin(): boolean {
  const { data: u } = useCurrentAiropsUser();
  if (!u) return false;
  if (u.email === FALLBACK_SUPERADMIN) return true;
  return u.status === "approved" && (u.role === "superadmin" || u.role === "admin");
}

// ─── Users ────────────────────────────────────────────────────────────────────

export function useAiropsUsers() {
  return useQuery<AiropsUser[]>({
    queryKey: ["airops-admin", "users"],
    queryFn: async () => {
      const sb = createClient();
      const { data, error } = await sb
        .from("airops_users")
        .select("*")
        .order("created_at");
      if (error) throw error;
      return data as AiropsUser[];
    },
    staleTime: 30_000,
  });
}

export function useApproveUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      email,
      approvedBy,
    }: {
      email: string;
      approvedBy: string;
    }) => {
      const sb = createClient();
      const { error } = await sb
        .from("airops_users")
        .update({
          status: "approved",
          approved_by: approvedBy,
          approved_at: new Date().toISOString(),
        })
        .eq("email", email);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["airops-admin", "users"] });
    },
  });
}

export function useRejectUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (email: string) => {
      const sb = createClient();
      const { error } = await sb
        .from("airops_users")
        .update({ status: "rejected" })
        .eq("email", email);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["airops-admin", "users"] });
    },
  });
}

export function useSetUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      email,
      role,
    }: {
      email: string;
      role: AiropsRole;
    }) => {
      const sb = createClient();
      const { error } = await sb
        .from("airops_users")
        .update({ role })
        .eq("email", email);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["airops-admin", "users"] });
    },
  });
}

// ─── Column Assignments ───────────────────────────────────────────────────────

export function useColumnAssignments() {
  return useQuery<AiropsColumnAssignment[]>({
    queryKey: ["airops-admin", "column-assignments"],
    queryFn: async () => {
      const sb = createClient();
      const { data, error } = await sb
        .from("airops_column_assignments")
        .select("*")
        .order("created_at");
      if (error) throw error;
      return data as AiropsColumnAssignment[];
    },
    staleTime: 30_000,
  });
}

export function useCreateColumnAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      assignment: Omit<AiropsColumnAssignment, "id" | "created_at">
    ) => {
      const sb = createClient();
      const { data, error } = await sb
        .from("airops_column_assignments")
        .insert(assignment)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["airops-admin", "column-assignments"] });
    },
  });
}

export function useDeleteColumnAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const sb = createClient();
      const { error } = await sb
        .from("airops_column_assignments")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["airops-admin", "column-assignments"] });
    },
  });
}

export function useUpdateColumnAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<
        Pick<AiropsColumnAssignment, "can_edit" | "can_move" | "can_assign">
      >;
    }) => {
      const sb = createClient();
      const { error } = await sb
        .from("airops_column_assignments")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["airops-admin", "column-assignments"] });
    },
  });
}

// ─── Required Fields ──────────────────────────────────────────────────────────

export function useRequiredFields(statusId?: string | null) {
  return useQuery<AiropsColumnRequiredField[]>({
    queryKey: ["airops-admin", "required-fields", statusId ?? "all"],
    queryFn: async () => {
      const sb = createClient();
      let q = sb
        .from("airops_column_required_fields")
        .select("*")
        .order("created_at");
      if (statusId) q = q.eq("status_id", statusId);
      const { data, error } = await q;
      if (error) throw error;
      return data as AiropsColumnRequiredField[];
    },
    staleTime: 30_000,
  });
}

export function useAllRequiredFields() {
  return useQuery<AiropsColumnRequiredField[]>({
    queryKey: ["airops-admin", "required-fields", "all"],
    queryFn: async () => {
      const sb = createClient();
      const { data, error } = await sb
        .from("airops_column_required_fields")
        .select("*")
        .order("created_at");
      if (error) throw error;
      return data as AiropsColumnRequiredField[];
    },
    staleTime: 30_000,
  });
}

export function useSetRequiredFields() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      statusId,
      fieldKeys,
    }: {
      statusId: string;
      fieldKeys: string[];
    }) => {
      const sb = createClient();
      // Delete existing for this status
      const { error: delErr } = await sb
        .from("airops_column_required_fields")
        .delete()
        .eq("status_id", statusId);
      if (delErr) throw delErr;
      // Insert new set (if any)
      if (fieldKeys.length > 0) {
        const { error: insErr } = await sb
          .from("airops_column_required_fields")
          .insert(fieldKeys.map((field_key) => ({ status_id: statusId, field_key })));
        if (insErr) throw insErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["airops-admin", "required-fields"] });
    },
  });
}

// ─── Auto-Progression ─────────────────────────────────────────────────────────

export function useAutoProgressionRules() {
  return useQuery<AiropsAutoProgression[]>({
    queryKey: ["airops-admin", "auto-progression"],
    queryFn: async () => {
      const sb = createClient();
      const { data, error } = await sb
        .from("airops_auto_progression")
        .select("*")
        .order("created_at");
      if (error) throw error;
      return data as AiropsAutoProgression[];
    },
    staleTime: 30_000,
  });
}

export function useCreateAutoProgressionRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      rule: Pick<AiropsAutoProgression, "trigger_field" | "target_status_id" | "description">
    ) => {
      const sb = createClient();
      const { data, error } = await sb
        .from("airops_auto_progression")
        .insert(rule)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["airops-admin", "auto-progression"] });
    },
  });
}

export function useDeleteAutoProgressionRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const sb = createClient();
      const { error } = await sb
        .from("airops_auto_progression")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["airops-admin", "auto-progression"] });
    },
  });
}

// ─── Audit log (client-side writer for board actions) ─────────────────────────

export async function writeAuditLog(params: {
  actor_email: string;
  action: string;
  target_type?: string;
  target_id?: string;
  detail?: Record<string, unknown>;
}) {
  try {
    const sb = createClient();
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
