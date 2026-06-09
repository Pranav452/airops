# AirOps Sea Freight — Build Progress

> Last updated: 2026-06-09
> Project ref: `kudgliahgprkattnlzzt`

---

## ✅ COMPLETED

### Database (Supabase)
| Table | Status | Notes |
|---|---|---|
| `airops_statuses` | ✅ Live | 27 pipeline columns seeded |
| `airops_vessels` | ✅ Live | All cutoff fields included |
| `airops_containers` | ✅ Live | Linked to vessels |
| `airops_jobs` | ✅ Live | JSONB `data` column, RLS enabled |
| `airops_comments` | ✅ Live | Per-job threaded comments |
| `airops_email_drafts` | ✅ Live | Stuffing finalisation emails |
| Storage: `job-documents` | ✅ Live | 20MB limit, anon upload allowed |

### Auth & Login
- [x] Email/password login (`/login`)
- [x] Sign up with **team selection** — POL Team (Export · Origin) / France Team (Import · Destination)
- [x] Team badge shown in sidebar after login
- [x] Board auto-filters to logged-in user's team on load
- [x] Supabase MCP connected — direct DB access without dashboard

### Board View (`/airops/board`)
- [x] Kanban board with 27 pipeline columns (drag & drop)
- [x] **Board / Sheets toggle** in header (inline, no separate page)
- [x] Search by order no
- [x] Vessel filter chips (All + per vessel)
- [x] Team view toggle (All / POL Team / France Team)
- [x] POL Team sees columns 1–15, France Team sees columns 16–27
- [x] Cutoff warning strip on cards (amber = within 48h, red = overdue)
- [x] Job count display

### Sheets View (inside Board)
- [x] Flat table: Order No, Status, Consignee, Shipper, Job Type, Vessel, ETD, ETA, Container No, Vol, Gross Wt, Console No, Verified, Created
- [x] Click any column header to sort asc/desc
- [x] Row click opens detail panel
- [x] Selected row highlighted in indigo
- [x] Same search/vessel/team filters apply

### Detail Panel (slide-in)
- [x] **CSD Approve / Reject buttons** — visible when job is in "Consignee Approval"; Approve → moves to Container Planning, Reject → back to Booking Request
- [x] **Stuffing Finalisation** — "🔒 Finalise & Email Consignee" button appears when status = "Stuffing Finalisation"; opens email compose modal
- [x] **Cutoff Banner** — shows all vessel cutoffs with status chips (Overdue/Today/Tomorrow/OK)
- [x] Cross-verified toggle
- [x] Console No assignment
- [x] Comments (threaded, real-time)

#### Booking Info section
- [x] Order No, Consignee, Shipper
- [x] **Job Type dropdown** (CC – Custom Clearance / FF – Freight Forwarding / X Works – Ex-Works)
- [x] Qty, Volume, Cartons, Cargo Handover Date, Gross/Net Weight, Pkgs/Cases

#### Carrier & Vessel section
- [x] Booking No, Vessel Name, ETD, ETA, Current ETD, DO ETD

#### Container section
- [x] Container Numbers (multi), Seal Nos (multi), Container Type
- [x] MBL No, HBL No, SB No, ERP Exp No
- [x] SI Filing tick, VGM tick, Form 13 tick

#### Documentation section
- [x] Transporter, LEO Date, Gate In Date, BL Date, Gate Details, POL
- [x] E-Docs Uploaded toggle

#### Billing section
- [x] Invoice Number, Console No (assign/edit)

#### Post-Departure Tracking section
- [x] RDV Date, ATA, CPU/SCR, HAWB No
- [x] **T1 No + T1 Date** (split — previously single field)
- [x] **Facture (Client Inv.) + Shipping Line Inv.** (split)
- [x] **Instructions Douane** — AMR Ref + Douane Date (split)
- [x] **ODT Sent toggle + ODT Date**
- [x] **Arrival Notice Sent toggle + Notice Date**
- [x] Container Release Info

#### Milestone Ticks section
- [x] Booking Released, Container Lifted, Clearance, SI Filing Done, Gate In Done, BL Released, Billing Done

### Booking Form (`/booking` — public, no login)
- [x] All shipper fields (Order No, Consignee, Shipper, Qty, Volume, Cartons, Cargo Handover, Gross/Net Weight, Pkgs/Cases)
- [x] **Job Type required dropdown** (CC / FF / X Works)
- [x] **Invoice & Packing List upload** — drag & drop or click, multiple files, 20MB limit, uploads to `job-documents` Supabase Storage bucket
- [x] File list preview with remove button
- [x] Submits to Supabase as anon user (no login required)

### Stuffing Email Modal
- [x] Pre-fills subject: `Stuffing Plan — {order_no} — {vessel_name}`
- [x] Pre-fills body with full cargo summary (consignee, shipper, containers, weights, dates)
- [x] Quick recipient chips
- [x] Save Draft / Send Now — saves to `airops_email_drafts` table

### Export Page (`/airops/export`)
- [x] 39 toggleable columns
- [x] All / Default / None column presets
- [x] Filters: search, status, vessel, date range
- [x] Row checkboxes for selective export
- [x] Excel download (`.xlsx`) client-side via `xlsx` package
- [x] Filename: `AirOps_Export_{date}.xlsx`

### Canvas & Dockyard
- [x] Canvas view (vessel planning drag canvas)
- [x] Dockyard view (container stuffing planner)

### Sidebar Navigation
- [x] Board, Canvas, Dockyard, Export
- [x] Team badge (POL / France)
- [x] User email + sign out

### Infrastructure
- [x] Supabase MCP server connected (`kudgliahgprkattnlzzt`)
- [x] Supabase agent skills installed
- [x] Storage bucket `job-documents` live
- [x] RLS enabled on all tables
- [x] `updated_at` auto-trigger on `airops_jobs`
- [x] Anon insert allowed on jobs (shipper booking form)

---

## ❌ TODO / PENDING

### High Priority
| # | Feature | Notes |
|---|---|---|
| 1 | **User roles** (Admin / Superadmin / Normal user) | CSD approve/reject currently visible to everyone; needs France Team role gate |
| 2 | **France Team reminder bell** (navbar) | Like ticket-management ReminderBell — ping France Team when jobs hit Consignee Approval |
| 3 | **Email SMTP send** | Currently saves drafts to DB only; needs nodemailer/Resend config to actually send |
| 4 | **Document viewer in detail panel** | Files uploaded by shipper land in storage but ops team has no UI to view/download them |
| 5 | **Stuffing Finalisation lock** | "Finalise" should lock the stuffing plan (read-only containers) after email sent |

### Medium Priority
| # | Feature | Notes |
|---|---|---|
| 6 | **POD filter** in sidebar/board | `pod` field exists on vessel; just needs a filter chip like POL |
| 7 | **Cutoff reminder notifications** | Cutoffs show on cards/panel but no push/email reminder when deadline approaches |
| 8 | **ETA tracker page** | Auto-update ETA using container no + shipping line tracker API |
| 9 | **FCR handling** | Display FCR jobs in different colour on board; need to clarify what identifies a job as FCR |
| 10 | **Ops draft page** | Unclear spec — needs clarification on what this generates |
| 11 | **Multi-container console grouping** | Select multiple containers → assign single console no (partially done per job) |

### Low Priority / On Hold
| # | Feature | Notes |
|---|---|---|
| 12 | **HAWB per container** | Currently one HAWB per job; on hold until workflow is clearer |
| 13 | **T1 / IMA from API** | Auto-pull T1 no and date from external API (API not yet identified) |
| 14 | **HBL per container** | Spec says pick HBL from system per container; currently per-job |
| 15 | **Sales enquiry link** | Link to `/sales-enquiry` app from Container Release area |
| 16 | **Vessel booking drop** | Drag jobs into vessel lane in vessel planning view |

---

## ⚙️ CUSTOM CONFIG & SETUP

### Supabase Project
```
Project ref:  kudgliahgprkattnlzzt
Project URL:  (stored in .env.local)
Anon key:     (stored in .env.local)
MCP URL:      https://mcp.supabase.com/mcp?project_ref=kudgliahgprkattnlzzt&features=storage,branching,functions,development,debugging,database,account,docs
```

### Team Metadata (Supabase Auth)
Users have `user_metadata.team` set at signup:
- `"pol"` → POL Team (Export · Origin side) — sees board columns 1–15
- `"france"` → France Team (Import · Destination) — sees board columns 16–27

### Pipeline Columns (27 total)
```
1  Booking Request       → shipper submits form
2  Vessel Planning       → Nikita assigns to vessel
3  Consignee Approval    → CSD (France Team) approves/rejects
4  Container Planning    → Nikita drags orders into containers
5  Carrier Booking       
6  Stuffing Finalisation → lock + auto-email consignee
7  SI Filing
8  Booking Released      → log transporter + confirmed ETD
9  Container Lifted      → container no, SB no, ERP exp ref
10 Clearance             → LEO date + gate details
11 SI Filing Done        → MBL/HBL, POL, weights
12 Gate In               → actual gate-in date
13 Bill of Lading        → upload e-docs + BL date
14 Billing               → invoice number
15 Console               → assign console no
16 ETA                   → estimated arrival at POD
17 Container Release     → release to shipping line
18 RDV                   → delivery appointment
19 ODT                   → delivery order to transporter
20 Instructions Douane   → customs instructions to POD agent
21 FACTURE               → shipping line invoice
22 Arrival Notice        → notify consignee
23 CPU/SCR               → container pickup / confirmed
24 ATA                   → actual arrival
25 T1/IMA                → transit document
26 MBL/HBL               → BL status
27 Completed
```

### Job Type Values (stored in `data.job_type`)
```
"cc"      → CC – Custom Clearance
"ff"      → FF – Freight Forwarding
"x_works" → X Works – Ex-Works
```

### Storage Bucket
```
Bucket:     job-documents
Public:     false (signed URLs required)
Max size:   20 MB per file
Allowed:    PDF, JPEG, PNG, WEBP, XLS, XLSX, DOC, DOCX
Anon:       INSERT allowed (shipper upload)
Auth:       full CRUD
```

### Key Files
```
Booking form (public):     app/(public)/booking/page.tsx
Board + Sheets view:       components/airops/AiropsBoard.tsx
Detail panel:              components/airops/AiropsDetailPanel.tsx
Stuffing email modal:      components/airops/StuffingEmailModal.tsx
Card (with cutoff alert):  components/airops/AiropsCard.tsx
Sidebar:                   components/airops/Sidebar.tsx
Export page:               app/(app)/airops/export/page.tsx
Types:                     lib/types/airops.ts
Queries / React Query:     lib/queries/airops.ts
Zustand store:             lib/stores/airops-store.ts
DB migrations:             supabase/migrations/
```

### Dependencies (notable)
```
next              → App Router (check node_modules/next/dist/docs/ for breaking changes)
@supabase/ssr     → auth + DB client
react-query       → data fetching + cache
framer-motion     → panel animations
zustand           → global UI state (selected job, panel open)
xlsx              → client-side Excel export
```
