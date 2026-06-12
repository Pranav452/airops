"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type {
  AiropsStatus,
  AiropsJob,
  AiropsVessel,
  AiropsContainer,
  AiropsComment,
  AiropsFilters,
  AiropsJobData,
} from "@/lib/types/airops";

// ─── Statuses ────────────────────────────────────────────────────────────────

export function useAiropsStatuses() {
  return useQuery<AiropsStatus[]>({
    queryKey: ["airops", "statuses"],
    queryFn: async () => {
      const sb = createClient();
      const { data, error } = await sb
        .from("airops_statuses")
        .select("*")
        .order("display_order");
      if (error) throw error;
      return data;
    },
    staleTime: 60_000,
  });
}

// ─── Jobs ─────────────────────────────────────────────────────────────────────

export function useAiropsJobs(filters?: AiropsFilters) {
  return useQuery<AiropsJob[]>({
    queryKey: ["airops", "jobs", filters],
    queryFn: async () => {
      const sb = createClient();
      let q = sb
        .from("airops_jobs")
        .select(
          `*, status:airops_statuses(*), container:airops_containers(*, vessel:airops_vessels(*))`
        )
        // hide jobs archived by the ERP sync (sailed out of the sync window)
        .or("data->>archived.is.null,data->>archived.neq.true")
        .order("column_order")
        .limit(5000);

      if (filters?.search) {
        q = q.ilike("data->>order_no", `%${filters.search}%`);
      }
      if (filters?.vessel_id) {
        q = q.eq("container.vessel_id", filters.vessel_id);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data as AiropsJob[];
    },
    staleTime: 30_000,
  });
}

export function useAiropsJob(id: string | null) {
  return useQuery<AiropsJob>({
    queryKey: ["airops", "job", id],
    enabled: !!id,
    queryFn: async () => {
      const sb = createClient();
      const { data, error } = await sb
        .from("airops_jobs")
        .select(
          `*, status:airops_statuses(*), container:airops_containers(*, vessel:airops_vessels(*))`
        )
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as AiropsJob;
    },
    staleTime: 10_000,
  });
}

// ─── Vessels ──────────────────────────────────────────────────────────────────

export function useAiropsVessels() {
  return useQuery<AiropsVessel[]>({
    queryKey: ["airops", "vessels"],
    queryFn: async () => {
      const sb = createClient();
      const { data, error } = await sb
        .from("airops_vessels")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });
}

export function useCreateVessel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vessel: Partial<AiropsVessel>) => {
      const sb = createClient();
      const { data, error } = await sb
        .from("airops_vessels")
        .insert(vessel)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["airops", "vessels"] });
    },
  });
}

export function useUpdateVessel() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<AiropsVessel> }) => {
      const sb = createClient();
      const { data, error } = await sb
        .from("airops_vessels")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["airops", "vessels"] });
    },
  });
}

// ─── Containers ───────────────────────────────────────────────────────────────

export function useAiropsContainers() {
  return useQuery<AiropsContainer[]>({
    queryKey: ["airops", "containers"],
    queryFn: async () => {
      const sb = createClient();
      const { data, error } = await sb
        .from("airops_containers")
        .select("*, vessel:airops_vessels(*), jobs:airops_jobs(id, data)")
        .order("created_at");
      if (error) throw error;
      return data as AiropsContainer[];
    },
    staleTime: 30_000,
  });
}

export function useCreateContainer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (container: Partial<AiropsContainer>) => {
      const sb = createClient();
      const { data, error } = await sb
        .from("airops_containers")
        .insert(container)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["airops", "containers"] });
    },
  });
}

export function useUpdateContainer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<AiropsContainer>;
    }) => {
      const sb = createClient();
      const { data, error } = await sb
        .from("airops_containers")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["airops", "containers"] });
      qc.invalidateQueries({ queryKey: ["airops", "jobs"] });
    },
  });
}

// ─── Job mutations ────────────────────────────────────────────────────────────

export function useUpdateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: {
        status_id?: string | null;
        column_order?: number;
        container_id?: string | null;
        console_no?: string | null;
        cross_verified?: boolean;
        canvas_x?: number;
        canvas_y?: number;
        data?: Partial<AiropsJobData>;
      };
    }) => {
      const sb = createClient();
      // If updating nested data, merge with existing
      if (updates.data) {
        const { data: existing } = await sb
          .from("airops_jobs")
          .select("data")
          .eq("id", id)
          .single();
        const merged = { ...(existing?.data ?? {}), ...updates.data };
        const { data, error } = await sb
          .from("airops_jobs")
          .update({ ...updates, data: merged, updated_at: new Date().toISOString() })
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await sb
        .from("airops_jobs")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["airops", "jobs"] });
      qc.invalidateQueries({ queryKey: ["airops", "job", variables.id] });
    },
  });
}

export function useCreateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (job: {
      status_id?: string;
      data: AiropsJobData;
      column_order?: number;
    }) => {
      const sb = createClient();
      const { data, error } = await sb
        .from("airops_jobs")
        .insert(job)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["airops", "jobs"] });
    },
  });
}

// ─── Comments ─────────────────────────────────────────────────────────────────

export function useAiropsComments(jobId: string | null) {
  return useQuery<AiropsComment[]>({
    queryKey: ["airops", "comments", jobId],
    enabled: !!jobId,
    queryFn: async () => {
      const sb = createClient();
      const { data, error } = await sb
        .from("airops_comments")
        .select("*")
        .eq("job_id", jobId!)
        .order("created_at");
      if (error) throw error;
      return data;
    },
    staleTime: 10_000,
  });
}

export function useAddAiropsComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ jobId, content }: { jobId: string; content: string }) => {
      const sb = createClient();
      const {
        data: { user },
      } = await sb.auth.getUser();
      const { data, error } = await sb
        .from("airops_comments")
        .insert({ job_id: jobId, content, author_id: user?.id ?? null })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, { jobId }) => {
      qc.invalidateQueries({ queryKey: ["airops", "comments", jobId] });
    },
  });
}
