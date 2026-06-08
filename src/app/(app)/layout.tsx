import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";
import BottomNav from "@/components/BottomNav";
import TopBar from "@/components/TopBar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const userRole = profile?.role ?? "lecteur";

  return (
    <div className="min-h-screen bg-[#F7F7F7]">
      {/* Sidebar — desktop uniquement */}
      <Sidebar userEmail={user.email ?? ""} userRole={userRole} />

      {/* TopBar — mobile uniquement */}
      <div className="lg:hidden">
        <TopBar userEmail={user.email ?? ""} />
      </div>

      {/* Contenu principal */}
      <main className="lg:pl-56 lg:pt-0 pt-14 pb-20 lg:pb-0 min-h-screen">
        {children}
      </main>

      {/* Bottom nav — mobile uniquement */}
      <div className="lg:hidden">
        <BottomNav userRole={userRole} />
      </div>
    </div>
  );
}
