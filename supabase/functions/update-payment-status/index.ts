import { createClient } from 'npm:@supabase/supabase-js@2.39.7';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface UpdatePaymentRequest {
  invoice_id: string;
  status: 'paid' | 'cancelled' | 'refunded';
  api_key: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    const { invoice_id, status, api_key } = await req.json() as UpdatePaymentRequest;

    // Validate required parameters
    if (!invoice_id || !status || !api_key) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate API key
    const expectedApiKey = Deno.env.get("UPDATE_PAYMENT_API_KEY");
    if (!expectedApiKey || api_key !== expectedApiKey) {
      return new Response(
        JSON.stringify({ error: "Invalid API key" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate status
    if (!['paid', 'cancelled', 'refunded'].includes(status)) {
      return new Response(
        JSON.stringify({ error: "Invalid status. Must be one of: paid, cancelled, refunded" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Update registration status
    const { data, error } = await supabase
      .from('registrations')
      .update({ 
        payment_status: status,
        ...(status === 'paid' ? { due_date: null } : {})
      })
      .eq('invoice_id', invoice_id);

    if (error) {
      console.error("Error updating payment status:", error);
      return new Response(
        JSON.stringify({ error: "Failed to update payment status" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: `Payment status updated to ${status}` }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error processing request:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});