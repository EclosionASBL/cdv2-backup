import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

function validateBelgianNRN(nrn: string): boolean {
  if (!/^\d{11}$/.test(nrn)) return false;
  const body = parseInt(nrn.slice(0, 9), 10);
  const check = parseInt(nrn.slice(9), 10);
  const oldRule = (97 - (body % 97)) === check;                       // births < 2000
  const newRule = (97 - ((2_000_000_000 + body) % 97)) === check;    // births ≥ 2000
  return oldRule || newRule;
}

serve(async (req) => {
  try {
    // Create a Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all kids with national numbers
    const { data: kids, error: fetchError } = await supabase
      .from('kids')
      .select('id, n_national')
      .not('n_national', 'is', null);

    if (fetchError) throw fetchError;

    // Update validation status for each kid
    for (const kid of kids) {
      if (kid.n_national) {
        const isValid = validateBelgianNRN(kid.n_national);
        
        const { error: updateError } = await supabase
          .from('kids')
          .update({ is_national_number_valid: isValid })
          .eq('id', kid.id);

        if (updateError) throw updateError;
      }
    }

    return new Response(
      JSON.stringify({ message: "National number validation updated successfully" }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});