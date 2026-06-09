"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface JobSearchResult {
  id: string;
  order_no: string;
  consignee_name: string;
}

export interface AiDraftResult {
  to: string;
  cc: string;
  subject: string;
  body: string;
}

export interface AiDraftInput {
  job_id: string;
  instruction: string;
}

// ─── Job Search (for @ mention dropdown) ─────────────────────────────────────

export function useJobSearch(query: string) {
  return useQuery<JobSearchResult[]>({
    queryKey: ["airops", "job-search", query],
    enabled: query.length >= 0, // always run, even with empty query
    queryFn: async () => {
      const sb = createClient();
      const trimmed = query.trim();

      // Build base query — select only what we need
      let q = sb
        .from("airops_jobs")
        .select("id, data")
        .order("column_order")
        .limit(20);

      if (trimmed.length > 0) {
        // Filter by order_no or consignee_name using ilike on JSONB text extraction
        q = q.or(
          `data->>order_no.ilike.%${trimmed}%,data->>consignee_name.ilike.%${trimmed}%`
        );
      }

      const { data, error } = await q;
      if (error) throw error;

      return (data ?? []).map((row) => ({
        id: row.id as string,
        order_no: (row.data?.order_no as string | undefined) ?? "(no order no)",
        consignee_name: (row.data?.consignee_name as string | undefined) ?? "",
      }));
    },
    staleTime: 15_000,
  });
}

// ─── AI Draft mutation ────────────────────────────────────────────────────────

export function useAiDraft() {
  return useMutation<AiDraftResult, Error, AiDraftInput>({
    mutationFn: async ({ job_id, instruction }: AiDraftInput) => {
      const res = await fetch("/api/airops/ai-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id, instruction }),
      });
      const data = await res.json().catch(() => ({ error: `Server error ${res.status}` }));
      if (!res.ok) {
        throw new Error(data.error ?? `Request failed with status ${res.status}`);
      }
      return data as AiDraftResult;
    },
  });
}
