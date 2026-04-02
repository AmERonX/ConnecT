import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async () => {
  try {
    const staleUpdated = await updateStaleMatches();
    const newDiscovered = await discoverNewMatches();

    return new Response(
      JSON.stringify({ stale_updated: staleUpdated, new_discovered: newDiscovered }),
      { status: 200 },
    );
  } catch (err) {
    console.error("Match worker error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});

async function updateStaleMatches(): Promise<number> {
  const { data, error } = await supabase.rpc("update_stale_matches", { batch_limit: 50 });
  if (error) {
    console.error("Update stale matches error:", error);
    return 0;
  }
  return data ?? 0;
}

async function discoverNewMatches(): Promise<number> {
  const { data, error } = await supabase.rpc("discover_new_matches");
  if (error) {
    console.error("Discover new matches error:", error);
    return 0;
  }
  return data ?? 0;
}
