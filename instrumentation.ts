// Auto-sync scheduler: pulls ERP data on an interval while the server runs.
// Controlled by ERP_SYNC_INTERVAL_MIN (0 / unset = disabled, button-only).

declare global {
  // survives dev hot-reloads so we never stack intervals
  var __erpSyncTimer: ReturnType<typeof setInterval> | undefined;
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const intervalMin = Number(process.env.ERP_SYNC_INTERVAL_MIN ?? 0);
  if (!intervalMin || Number.isNaN(intervalMin)) return;
  if (globalThis.__erpSyncTimer) return;

  const { runErpSync } = await import("./lib/erp/sync");
  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    const started = Date.now();
    try {
      const r = await runErpSync();
      console.log(
        `[erp-sync] ok in ${Date.now() - started}ms — jobs ${r.erpJobs} (new ${r.jobsInserted}, upd ${r.jobsUpdated}, arch ${r.jobsArchived}), vessels ${r.vesselsUpserted}, containers ${r.containersUpserted}${r.warnings.length ? `, warnings ${r.warnings.length}` : ""}`
      );
    } catch (err) {
      console.error("[erp-sync] failed:", err instanceof Error ? err.message : err);
    } finally {
      running = false;
    }
  };

  globalThis.__erpSyncTimer = setInterval(tick, intervalMin * 60_000);
  setTimeout(tick, 20_000); // first pass shortly after boot
  console.log(`[erp-sync] auto-sync enabled, every ${intervalMin} min`);
}
