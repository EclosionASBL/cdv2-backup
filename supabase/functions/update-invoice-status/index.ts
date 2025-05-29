import { createClient } from 'npm:@supabase/supabase-js@2.39.7';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface UpdateInvoiceRequest {
  invoice_number: string;
  status: 'paid' | 'cancelled';
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
    const { invoice_number, status, api_key } = await req.json() as UpdateInvoiceRequest;

    // Validate required parameters
    if (!invoice_number || !status || !api_key) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate API key
    const expectedApiKey = Deno.env.get("UPDATE_INVOICE_API_KEY");
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
    if (!['paid', 'cancelled'].includes(status)) {
      return new Response(
        JSON.stringify({ error: "Invalid status. Must be one of: paid, cancelled" }),
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

    // Update invoice status
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .update({ 
        status: status,
        ...(status === 'paid' ? { paid_at: new Date().toISOString() } : {})
      })
      .eq('invoice_number', invoice_number)
      .select('registration_ids')
      .single();

    if (invoiceError) {
      console.error("Error updating invoice status:", invoiceError);
      return new Response(
        JSON.stringify({ error: "Failed to update invoice status" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Update registration status
    if (invoice && invoice.registration_ids && invoice.registration_ids.length > 0) {
      const { error: registrationError } = await supabase
        .from('registrations')
        .update({ 
          payment_status: status,
          ...(status === 'paid' ? { due_date: null } : {})
        })
        .in('id', invoice.registration_ids);

      if (registrationError) {
        console.error("Error updating registration status:", registrationError);
        return new Response(
          JSON.stringify({ error: "Failed to update registration status" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: `Invoice status updated to ${status}` }),
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