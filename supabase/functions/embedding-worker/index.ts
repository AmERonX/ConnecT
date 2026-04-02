import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const COHERE_API_KEY = Deno.env.get("COHERE_API_KEY")!;

const EMBEDDING_MODEL = "embed-english-v3.0";
const BATCH_SIZE = 10;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async () => {
  try {
    const { data: staleIdeas, error: fetchErr } = await supabase.rpc("claim_stale_ideas", {
      batch_limit: BATCH_SIZE,
    });

    if (fetchErr || !staleIdeas?.length) {
      return new Response(JSON.stringify({ processed: 0 }), { status: 200 });
    }

    for (const idea of staleIdeas) {
      try {
        const embedding = await generateEmbedding(idea.canonical_text);

        const { error: writeErr } = await supabase.rpc("process_embedding", {
          p_idea_id: idea.id,
          p_embedding: embedding,
          p_model_version: EMBEDDING_MODEL,
        });

        if (writeErr) {
          console.error(`Failed for idea ${idea.id}:`, writeErr);
        }
      } catch (err) {
        console.error(`Embedding generation failed for idea ${idea.id}:`, err);
      }
    }

    return new Response(JSON.stringify({ processed: staleIdeas.length }), { status: 200 });
  } catch (err) {
    console.error("Embedding worker error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});

async function generateEmbedding(text: string): Promise<number[]> {
  const body = {
    texts: [text],
    model: EMBEDDING_MODEL,
    input_type: "search_document",
    embedding_types: ["float"],
  };

  const first = await fetch("https://api.cohere.com/v2/embed", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${COHERE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!first.ok) {
    const retry = await fetch("https://api.cohere.com/v2/embed", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${COHERE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!retry.ok) {
      throw new Error(`Cohere API failed after retry: ${retry.status}`);
    }

    const retryData = await retry.json();
    return retryData.embeddings.float[0];
  }

  const data = await first.json();
  return data.embeddings.float[0];
}
