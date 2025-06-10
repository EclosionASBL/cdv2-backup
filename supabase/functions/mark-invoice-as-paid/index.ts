import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
};

interface MarkInvoiceAsPaidRequest {
  invoice_id: string;
  transaction_id?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    // Get the authorization header from the incoming request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const requestData = await req.json() as MarkInvoiceAsPaidRequest;
    const { invoice_id, transaction_id } = requestData;

    if (!invoice_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: invoice_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('*')
      .eq('id', invoice_id)
      .single();

    if (invoiceError) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch invoice: ${invoiceError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update the invoice status to paid
    const { error: updateInvoiceError } = await supabase
      .from('invoices')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString()
      })
      .eq('id', invoice_id);

    if (updateInvoiceError) {
      return new Response(
        JSON.stringify({ error: `Failed to update invoice: ${updateInvoiceError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update the associated registrations
    const { error: updateRegistrationsError } = await supabase
      .from('registrations')
      .update({
        payment_status: 'paid'
      })
      .eq('invoice_id', invoice.invoice_number);

    if (updateRegistrationsError) {
      return new Response(
        JSON.stringify({ error: `Failed to update registrations: ${updateRegistrationsError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If a transaction_id was provided, update its status
    if (transaction_id) {
      const { error: updateTransactionError } = await supabase
        .from('bank_transactions')
        .update({
          status: 'matched'
        })
        .eq('id', transaction_id);

      if (updateTransactionError) {
        return new Response(
          JSON.stringify({ error: `Failed to update transaction: ${updateTransactionError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message: `Invoice ${invoice.invoice_number} marked as paid`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error marking invoice as paid:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});