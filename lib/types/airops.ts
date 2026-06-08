export interface AiropsStatus {
  id: string;
  name: string;
  color_hex: string;
  display_order: number;
}

export interface AiropsVessel {
  id: string;
  name: string;
  etd: string | null;
  eta: string | null;
  pol: string | null;
  pod: string | null;
  port_cutoff: string | null;
  si_cutoff: string | null;
  docs_cutoff: string | null;
  vgm_cutoff: string | null;
  cargo_handover_cutoff: string | null;
  canvas_x: number;
  canvas_y: number;
  created_at: string;
}

export interface AiropsContainer {
  id: string;
  vessel_id: string | null;
  container_number: string | null;
  container_type: string | null;
  seal_no: string | null;
  max_volume: number | null;
  canvas_x: number;
  canvas_y: number;
  created_at: string;
  vessel?: AiropsVessel;
  jobs?: AiropsJob[];
}

export interface AiropsJobData {
  // Booking Info
  order_no?: string;
  consignee_name?: string;
  shipper_name?: string;
  quantity_pcs?: number;
  volume?: number;
  no_of_cartons?: number;
  cargo_handover_date?: string;
  gross_weight?: number;
  net_weight?: number;
  pkgs_cases?: string;
  // Carrier / Vessel
  booking_no?: string;
  vessel_name?: string;
  etd?: string;
  eta?: string;
  current_etd?: string;
  do_etd?: string;
  // Container
  container_numbers?: string[];
  container_type?: string;
  seal_nos?: string[];
  mbl_number?: string;
  hbl_number?: string;
  sb_number?: string;
  erp_exp_number?: string;
  // Stuffing checklist
  si_filing_tick?: boolean;
  vgm_tick?: boolean;
  form_13_tick?: boolean;
  // Documentation
  transporter?: string;
  leo_date?: string;
  gate_details?: string;
  gate_in_date?: string;
  edocs_uploaded?: boolean;
  bl_date?: string;
  pol?: string;
  // Billing
  invoice_number?: string;
  // Post-departure
  container_release_info?: string;
  rdv_date?: string;
  odt_sent?: boolean;
  instructions_douane?: string;
  facture_no?: string;
  arrival_notice_sent?: boolean;
  cpu_scr?: string;
  ata?: string;
  t1_ima?: string;
  hawb_no?: string;
  // Milestone ticks
  booking_released?: boolean;
  container_lifted?: boolean;
  clearance?: boolean;
  si_filing_done?: boolean;
  gate_in_done?: boolean;
  bl_released?: boolean;
  billing_done?: boolean;
}

export interface AiropsJob {
  id: string;
  status_id: string | null;
  container_id: string | null;
  console_no: string | null;
  cross_verified: boolean;
  column_order: number;
  canvas_x: number;
  canvas_y: number;
  assigned_to: string | null;
  data: AiropsJobData;
  created_at: string;
  updated_at: string;
  status?: AiropsStatus;
  container?: AiropsContainer;
  assignee?: { id: string; email: string; full_name?: string };
}

export interface AiropsComment {
  id: string;
  job_id: string;
  author_id: string | null;
  content: string;
  created_at: string;
  author?: { id: string; email: string; full_name?: string };
}

// Filters used on board
export interface AiropsFilters {
  pol?: string;
  vessel_id?: string;
  search?: string;
}
