"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function setFocus(arretId: string, isFocus: boolean) {
  const supabase = await createClient();
  await supabase.from("arrets").update({ is_focus: isFocus }).eq("id", arretId);
  revalidatePath("/arrets");
  revalidatePath("/dashboard");
}
