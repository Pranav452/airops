import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/airops/Sidebar";
import AiropsComposeLauncher from "@/components/airops/AiropsComposeLauncher";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const team = (user.user_metadata?.team ?? "") as string;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar userEmail={user.email ?? ""} team={team} />
      <main className="flex-1 overflow-hidden flex flex-col">{children}</main>
      <AiropsComposeLauncher />
    </div>
  );
}
