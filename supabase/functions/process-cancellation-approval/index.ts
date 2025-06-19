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

    // Get the cancellation request details
    const { data: cancellationRequest, error: requestError } = await supabaseAdmin
      .from('cancellation_requests')
      .select(`
        *,
        registration:registration_id(
          id,
          user_id,
          kid_id,
          activity_id,
          amount_paid,
          invoice_id,
          payment_status
        )
      `)
      .eq('id', requestId)
      .single();

    if (requestError || !cancellationRequest) {
      console.error('Error fetching cancellation request:', requestError);
      return new Response(
        JSON.stringify({ error: 'Cancellation request not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Unwrap registration if it's an array
    const registration = Array.isArray(cancellationRequest.registration) 
      ? cancellationRequest.registration[0] 
      : cancellationRequest.registration;

    if (!registration) {
      console.error('Registration not found for cancellation request');
      return new Response(
        JSON.stringify({ error: 'Registration not found for cancellation request' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Update the cancellation request status
    const { error: updateRequestError } = await supabaseAdmin
      .from('cancellation_requests')
      .update({
        status: 'approved',
        refund_type: refundType,
        admin_notes: adminNotes || null
      })
      .eq('id', requestId);

    if (updateRequestError) {
      console.error('Error updating cancellation request:', updateRequestError);
      return new Response(
        JSON.stringify({ error: 'Error updating cancellation request' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Update the registration status
    const cancellationStatus = refundType === 'full' 
      ? 'cancelled_full_refund' 
      : refundType === 'partial' 
        ? 'cancelled_partial_refund' 
        : 'cancelled_no_refund';

    const { error: updateRegistrationError } = await supabaseAdmin
      .from('registrations')
      .update({
        cancellation_status: cancellationStatus,
        payment_status: 'cancelled'
      })
      .eq('id', registration.id);

    if (updateRegistrationError) {
      console.error('Error updating registration:', updateRegistrationError);
      return new Response(
        JSON.stringify({ error: 'Error updating registration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Update session registration count
    try {
      // Get the current count
      const { data: sessionData, error: sessionError } = await supabaseAdmin
        .from('sessions')
        .select('current_registrations')
        .eq('id', registration.activity_id)
        .single();
      
      if (sessionError) {
        console.error('Error fetching session:', sessionError);
      } else if (sessionData && sessionData.current_registrations > 0) {
        // Decrement the count
        const { error: updateSessionError } = await supabaseAdmin
          .from('sessions')
          .update({ current_registrations: sessionData.current_registrations - 1 })
          .eq('id', registration.activity_id);
        
        if (updateSessionError) {
          console.error('Error updating session registration count:', updateSessionError);
        }
      }
    } catch (sessionError) {
      console.error('Error updating session registration count:', sessionError);
      // Continue despite this error
    }

    // Create credit note if refund type is full or partial
    let creditNoteId = null;
    let creditNoteNumber = null;

    if (refundType === 'full' || refundType === 'partial') {
      // Calculate credit note amount
      const creditNoteAmount = refundType === 'full' 
        ? registration.amount_paid 
        : registration.amount_paid / 2; // Default to half for partial refunds

      // Generate credit note number
      const currentYear = new Date().getFullYear();
      const { data: creditNoteNumberData, error: sequenceError } = await supabaseAdmin.rpc(
        'get_next_credit_note_sequence',
        { p_year: currentYear }
      );
      
      if (sequenceError) {
        console.error('Error generating credit note number:', sequenceError);
        return new Response(
          JSON.stringify({ error: 'Failed to generate credit note number' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      
      creditNoteNumber = creditNoteNumberData;

      // Create credit note
      const { data: creditNote, error: creditNoteError } = await supabaseAdmin
        .from('credit_notes')
        .insert({
          user_id: registration.user_id,
          registration_id: registration.id,
          cancellation_request_id: requestId,
          credit_note_number: creditNoteNumber,
          amount: creditNoteAmount,
          status: 'issued',
          invoice_id: null,
          invoice_number: registration.invoice_id
        })
        .select()
        .single();

      if (creditNoteError) {
        console.error('Error creating credit note:', creditNoteError);
        return new Response(
          JSON.stringify({ error: 'Failed to create credit note' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      creditNoteId = creditNote.id;

      // Update the cancellation request with the credit note ID
      const { error: updateCreditNoteIdError } = await supabaseAdmin
        .from('cancellation_requests')
        .update({
          credit_note_id: creditNoteNumber
        })
        .eq('id', requestId);

      if (updateCreditNoteIdError) {
        console.error('Error updating cancellation request with credit note ID:', updateCreditNoteIdError);
        // Continue despite this error
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Cancellation request approved',
        cancellation_status: cancellationStatus,
        credit_note_id: creditNoteId,
        credit_note_number: creditNoteNumber
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