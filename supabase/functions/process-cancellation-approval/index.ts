import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
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
    const { data: result, error: functionError } = await supabaseAdmin.rpc(
      'process_cancellation_approval',
      {
        p_request_id: requestId,
        p_refund_type: refundType,
        p_admin_notes: adminNotes
      }
    );

    if (functionError) {
      console.error('Error calling process_cancellation_approval function:', functionError);
      return new Response(
        JSON.stringify({ error: functionError.message || 'Error processing cancellation' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Generate PDF for credit note if one was created
    if (result && result.credit_note_id) {
      try {
        console.log('Generating PDF for credit note:', result.credit_note_id);
        
        const pdfRes = await fetch(`${supabaseUrl}/functions/v1/generate-credit-note-pdf`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`
          },
          body: JSON.stringify({
            credit_note_id: result.credit_note_id,
            api_key: Deno.env.get('UPDATE_INVOICE_API_KEY')
          })
        });
        
        if (!pdfRes.ok) {
          console.error('Error generating credit note PDF:', await pdfRes.text());
          // Continue despite PDF generation error
        } else {
          const pdfData = await pdfRes.json();
          console.log('PDF generation successful:', pdfData);
          
          // Update credit note with PDF URL
          if (pdfData.pdf_url) {
            const { error: updateError } = await supabaseAdmin
              .from('credit_notes')
              .update({ pdf_url: pdfData.pdf_url })
              .eq('id', result.credit_note_id);
              
            if (updateError) {
              console.error('Error updating credit note with PDF URL:', updateError);
            } else {
              console.log('Credit note updated with PDF URL');
              
              // Update cancellation request with credit note URL
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
        try {
          console.log('Sending credit note email');
          
          const emailRes = await fetch(`${supabaseUrl}/functions/v1/send-credit-note-email`, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`
            },
            body: JSON.stringify({
              credit_note_id: result.credit_note_id
            })
          });
          
          if (!emailRes.ok) {
            console.error('Error sending credit note email:', await emailRes.text());
          } else {
            console.log('Credit note email sent successfully');
          }
        } catch (emailError) {
          console.error('Error calling send-credit-note-email function:', emailError);
        }
      } catch (pdfError) {
        console.error('Error generating credit note PDF:', pdfError);
        // Continue despite PDF generation error
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Cancellation request processed successfully',
        result 
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