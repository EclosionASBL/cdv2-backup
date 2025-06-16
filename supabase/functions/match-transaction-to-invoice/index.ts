import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
};

interface MatchTransactionRequest {
  transaction_id: string;
  invoice_id?: string;
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
    const requestData = await req.json() as MatchTransactionRequest;
    const { transaction_id, invoice_id } = requestData;

    if (!transaction_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: transaction_id' }),
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

    // Get the transaction
    const { data: transaction, error: transactionError } = await supabase
      .from('bank_transactions')
      .select('*')
      .eq('id', transaction_id)
      .single();

    if (transactionError) {
      return new Response(
        JSON.stringify({ error: `Failed to fetch transaction: ${transactionError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If invoice_id is provided, we need to determine if it's a UUID or an invoice number
    let targetInvoiceId = null;
    let invoiceData = null;

    if (invoice_id) {
      // Check if the provided invoice_id is a valid UUID
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const isUuid = uuidPattern.test(invoice_id);

      if (isUuid) {
        // If it's a UUID, use it directly
        targetInvoiceId = invoice_id;
        
        // Get the invoice data
        const { data: invoice, error: invoiceError } = await supabase
          .from('invoices')
          .select('*')
          .eq('id', targetInvoiceId)
          .single();

        if (invoiceError) {
          return new Response(
            JSON.stringify({ error: `Failed to fetch invoice by ID: ${invoiceError.message}` }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        invoiceData = invoice;
      } else {
        // If it's not a UUID, assume it's an invoice number and look up the corresponding UUID
        const { data: invoice, error: invoiceError } = await supabase
          .from('invoices')
          .select('*')
          .eq('invoice_number', invoice_id)
          .single();

        if (invoiceError) {
          return new Response(
            JSON.stringify({ error: `Failed to fetch invoice by number: ${invoiceError.message}` }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        if (!invoice) {
          return new Response(
            JSON.stringify({ error: `Invoice with number ${invoice_id} not found` }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        targetInvoiceId = invoice.id;
        invoiceData = invoice;
      }
    } else {
      // If no invoice_id is provided, try to find a matching invoice by extracted_invoice_number or communication
      const { data: matchingInvoices, error: matchError } = await supabase
        .from('invoices')
        .select('*')
        .or(`invoice_number.eq.${transaction.extracted_invoice_number},communication.eq.${transaction.communication}`)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (matchError) {
        return new Response(
          JSON.stringify({ error: `Failed to find matching invoices: ${matchError.message}` }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!matchingInvoices || matchingInvoices.length === 0) {
        return new Response(
          JSON.stringify({ error: 'No matching invoice found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Use the first matching invoice
      invoiceData = matchingInvoices[0];
      targetInvoiceId = invoiceData.id;
    }

    // Determine match status based on amount comparison
    let matchStatus;
    if (transaction.amount === invoiceData.amount) {
      matchStatus = 'matched';
    } else if (transaction.amount > invoiceData.amount) {
      matchStatus = 'overpaid';
    } else {
      matchStatus = 'partially_matched';
    }

    // Update the transaction with the match information
    const { error: updateError } = await supabase
      .from('bank_transactions')
      .update({
        status: matchStatus,
        invoice_id: targetInvoiceId
      })
      .eq('id', transaction_id);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: `Failed to update transaction: ${updateError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Return success response with match details
    return new Response(
      JSON.stringify({
        success: true,
        transaction_id,
        invoice_id: targetInvoiceId,
        match_status: matchStatus,
        message: `Transaction successfully matched to invoice ${invoiceData.invoice_number} with status: ${matchStatus}`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error matching transaction to invoice:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});