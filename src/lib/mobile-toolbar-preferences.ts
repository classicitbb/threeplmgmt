import { supabase } from "@/integrations/supabase/client";

const db = supabase.from.bind(supabase) as (table: string) => any;
const TABLE = "user_mobile_toolbar_preferences";

function isMissingPreferenceTable(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const value = error as { code?: string; message?: string };
  return (value.code === "PGRST205" || value.code === "42P01") && (value.message ?? "").includes(TABLE);
}

export async function loadMobileToolbarPreferences(userId: string): Promise<unknown | undefined> {
  const { data, error } = await db(TABLE)
    .select("module_keys")
    .eq("user_id", userId)
    .maybeSingle();
  if (isMissingPreferenceTable(error)) return undefined;
  if (error) throw error;
  return data?.module_keys;
}

export async function saveMobileToolbarPreferences(userId: string, moduleKeys: string[]) {
  const { error } = await db(TABLE).upsert(
    {
      user_id: userId,
      module_keys: moduleKeys,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (isMissingPreferenceTable(error)) return;
  if (error) throw error;
}
