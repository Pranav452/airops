export const dynamic = "force-dynamic";

import { requireAdmin } from "@/lib/airops/permissions";
import { AdminPanel } from "@/components/airops/AdminPanel";

export default async function AdminPage() {
  // Redirects to /airops/board if not admin, or /login if unauthenticated.
  const currentUser = await requireAdmin();

  return <AdminPanel currentUserEmail={currentUser.email} currentUserRole={currentUser.role} />;
}
