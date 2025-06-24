import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
};

interface ProcessCancellationRequest {
  requestId: string;
  refundType: 'full' | 'partial' | 'none';
  adminNotes?: string;
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
    console.log('Starting process-cancellation-approval function');
    
    // Get the authorization header from the incoming request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing Authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    let requestData;
    try {
      requestData = await req.json() as ProcessCancellationRequest;
      console.log('Request data:', JSON.stringify(requestData));
    } catch (parseError) {
      console.error('Error parsing request JSON:', parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { requestId, refundType, adminNotes } = requestData;

    if (!requestId || !refundType) {
      console.error('Missing required parameters:', { requestId, refundType });
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase environment variables');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Create admin client with service role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Create client for user authentication
    const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') || '');

    // Verify the user is authenticated and is an admin
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Authorization failed' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Check if user is admin using admin client
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userError) {
      console.error('Error fetching user role:', userError);
      return new Response(
        JSON.stringify({ error: 'Error verifying admin status' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (userData.role !== 'admin') {
      console.error('User is not an admin:', user.id);
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Call the database function to process the cancellation
    console.log('Calling process_cancellation_approval RPC with:', { requestId, refundType, adminNotes });
    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc(
      'process_cancellation_approval',
      {
        p_request_id: requestId,
        p_refund_type: refundType,
        p_admin_notes: adminNotes
      }
    );

    if (rpcError) {
      console.error('Error calling process_cancellation_approval RPC:', rpcError);
      return new Response(
        JSON.stringify({ error: rpcError.message || 'Failed to process cancellation approval' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Check if the RPC result indicates success
    if (!rpcResult || !rpcResult.success) {
      console.error('RPC returned unsuccessful result:', rpcResult);
      return new Response(
        JSON.stringify({ 
          error: rpcResult?.error_message || 'Unknown error processing cancellation' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log('RPC result:', rpcResult);

    // Generate PDF for the credit note if one was created
    if (rpcResult.credit_note_id) {
      try {
        console.log('Generating PDF for credit note:', rpcResult.credit_note_id);
        
        const pdfResponse = await fetch(`${supabaseUrl}/functions/v1/generate-credit-note-pdf`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            credit_note_id: rpcResult.credit_note_id,
            api_key: Deno.env.get('UPDATE_INVOICE_API_KEY') || ''
          }),
        });
        
        if (!pdfResponse.ok) {
          const errorText = await pdfResponse.text();
          console.error('Error generating credit note PDF:', errorText);
          // Continue despite PDF generation error
        } else {
          const pdfData = await pdfResponse.json();
          console.log('Credit note PDF generated:', pdfData);
          
          // Update the credit note with the PDF URL
          if (pdfData.pdf_url) {
            const { error: updateError } = await supabaseAdmin
              .from('credit_notes')
              .update({ pdf_url: pdfData.pdf_url })
              .eq('id', rpcResult.credit_note_id);
              
            if (updateError) {
              console.error('Error updating credit note with PDF URL:', updateError);
            } else {
              console.log('Credit note updated with PDF URL');
              
              // Add the PDF URL to the result
              rpcResult.pdf_url = pdfData.pdf_url;
              
              // Update the cancellation request with the credit note URL
              const { error: updateRequestError } = await supabaseAdmin
                .from('cancellation_requests')
                .update({ credit_note_url: pdfData.pdf_url })
                .eq('id', requestId);
                
              if (updateRequestError) {
                console.error('Error updating cancellation request with credit note URL:', updateRequestError);
              }
            }
          }
        }
        
        // Send email with credit note
        console.log('Sending credit note email for:', rpcResult.credit_note_id);
        
        const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-credit-note-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            credit_note_id: rpcResult.credit_note_id
          }),
        });
        
        if (!emailResponse.ok) {
          const errorText = await emailResponse.text();
          console.error('Error sending credit note email:', errorText);
          // Continue despite email error
        } else {
          console.log('Credit note email sent successfully');
        }
        
      } catch (pdfError) {
        console.error('Error in PDF generation or email sending:', pdfError);
        // Continue despite PDF/email errors
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        result: rpcResult
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: any) {
    console.error('Error processing cancellation approval:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});