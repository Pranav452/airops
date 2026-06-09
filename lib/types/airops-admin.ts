// ─── Role + status unions ─────────────────────────────────────────────────────

export type AiropsRole = "superadmin" | "admin" | "user";
export type AiropsUserStatus = "pending" | "approved" | "rejected";

// ─── airops_users ─────────────────────────────────────────────────────────────

export interface AiropsUser {
  id: string;
  user_id: string | null;
  email: string;
  full_name: string | null;
  team: string | null;
  role: AiropsRole;
  status: AiropsUserStatus;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

// ─── airops_column_assignments ────────────────────────────────────────────────

export interface AiropsColumnAssignment {
  id: string;
  /** null = board-wide */
  status_id: string | null;
  user_email: string;
  can_edit: boolean;
  can_move: boolean;
  can_assign: boolean;
  created_at: string;
}

// ─── airops_column_required_fields ───────────────────────────────────────────

export interface AiropsColumnRequiredField {
  id: string;
  status_id: string;
  field_key: string;
  created_at: string;
}

// ─── airops_auto_progression ──────────────────────────────────────────────────

export interface AiropsAutoProgression {
  id: string;
  trigger_field: string;
  target_status_id: string;
  description: string | null;
  created_at: string;
}

// ─── airops_audit_logs ────────────────────────────────────────────────────────

export interface AiropsAuditLog {
  id: string;
  actor_email: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  detail: Record<string, unknown> | null;
  created_at: string;
}

// ─── Candidate field keys for required-fields & auto-progression ──────────────

export const CANDIDATE_FIELD_KEYS: { key: string; label: string }[] = [
  { key: "order_no",             label: "Order No" },
  { key: "consignee_name",       label: "Consignee Name" },
  { key: "consignee_email",      label: "Consignee Email" },
  { key: "booking_no",           label: "Booking No" },
  { key: "vessel_name",          label: "Vessel Name" },
  { key: "etd",                  label: "ETD" },
  { key: "eta",                  label: "ETA" },
  { key: "pol",                  label: "POL" },
  { key: "mbl_number",           label: "MBL Number" },
  { key: "hbl_number",           label: "HBL Number" },
  { key: "invoice_number",       label: "Invoice Number" },
  { key: "volume",               label: "Volume (CBM)" },
  { key: "gross_weight",         label: "Gross Weight" },
  { key: "container_numbers",    label: "Container Numbers" },
  { key: "booking_released",     label: "Booking Released" },
  { key: "container_lifted",     label: "Container Lifted" },
  { key: "clearance",            label: "Clearance" },
  { key: "gate_in_done",         label: "Gate In Done" },
  { key: "bl_released",          label: "BL Released" },
  { key: "billing_done",         label: "Billing Done" },
  { key: "si_filing_done",       label: "SI Filing Done" },
  { key: "edocs_uploaded",       label: "E-Docs Uploaded" },
  { key: "odt_sent",             label: "ODT Sent" },
  { key: "arrival_notice_sent",  label: "Arrival Notice Sent" },
  { key: "t1_no",                label: "T1 Number" },
  { key: "rdv_date",             label: "RDV Date" },
  { key: "bl_date",              label: "BL Date" },
];
