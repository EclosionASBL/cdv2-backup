import { createClient } from 'npm:@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface ProcessCancellationRequest {
  cancellationRequestId: string;
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

    const { cancellationRequestId, refundType, adminNotes } = requestData;

    if (!cancellationRequestId || !refundType) {
      console.error('Missing required parameters:', { cancellationRequestId, refundType });
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase environment variables');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify the user is an admin
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Authorization failed' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!user) {
      console.error('No user found in auth context');
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Check if user is admin
    const { data: userData, error: userError } = await supabase
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
    const { data: cancellationRequest, error: requestError } = await supabase
      .from('cancellation_requests')
      .select(`
        *,
        registration:registration_id(
          user_id,
          kid_id,
          activity_id,
          amount_paid,
          payment_status
        )
      `)
      .eq('id', cancellationRequestId)
      .single();

    if (requestError) {
      console.error('Error fetching cancellation request:', requestError);
      return new Response(
        JSON.stringify({ error: 'Cancellation request not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Update the cancellation request
    const { error: updateRequestError } = await supabase
      .from('cancellation_requests')
      .update({
        status: 'approved',
        admin_notes: adminNotes,
        refund_type: refundType
      })
      .eq('id', cancellationRequestId);

    if (updateRequestError) {
      console.error('Error updating cancellation request:', updateRequestError);
      return new Response(
        JSON.stringify({ error: 'Failed to update cancellation request' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Update the registration status
    const cancellationStatus = refundType === 'full' 
      ? 'cancelled_full_refund' 
      : refundType === 'partial' 
        ? 'cancelled_partial_refund' 
        : 'cancelled_no_refund';

    const { error: updateRegistrationError } = await supabase
      .from('registrations')
      .update({
        payment_status: 'cancelled',
        cancellation_status: cancellationStatus
      })
      .eq('id', cancellationRequest.registration_id);

    if (updateRegistrationError) {
      console.error('Error updating registration:', updateRegistrationError);
      return new Response(
        JSON.stringify({ error: 'Failed to update registration' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Generate credit note reference for tracking purposes
    let creditNoteId = null;
    if (refundType === 'full' || refundType === 'partial') {
      try {
        // Generate a unique credit note number
        const currentYear = new Date().getFullYear();
        const yearSuffix = currentYear.toString().slice(-2);
        
        // Get the next sequence number
        const { data: sequenceData, error: sequenceError } = await supabase.rpc(
          'get_next_credit_note_sequence',
          { p_year: currentYear }
        );
        
        if (sequenceError) {
          console.error('Error getting next credit note sequence:', sequenceError);
          // Continue without credit note if sequence fails
        } else {
          // Format the sequence number with leading zeros
          const sequenceNumber = sequenceData.toString().padStart(5, '0');
          const creditNoteNumber = `NC-${yearSuffix}${sequenceNumber}`;
          creditNoteId = creditNoteNumber;
          
          // Update the cancellation request with the credit note reference
          await supabase
            .from('cancellation_requests')
            .update({
              credit_note_id: creditNoteNumber
            })
            .eq('id', cancellationRequestId);
        }
      } catch (creditNoteError: any) {
        console.error('Error processing credit note reference:', creditNoteError);
        // Continue without credit note
      }
    }

    // Update the session's current_registrations count
    try {
      // Get the current count
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select('current_registrations')
        .eq('id', cancellationRequest.registration.activity_id)
        .single();
      
      if (sessionError) {
        console.error('Error fetching session:', sessionError);
      } else if (sessionData && sessionData.current_registrations > 0) {
        // Decrement the count
        await supabase
          .from('sessions')
          .update({ current_registrations: sessionData.current_registrations - 1 })
          .eq('id', cancellationRequest.registration.activity_id);
      }
    } catch (sessionError) {
      console.error('Error updating session registration count:', sessionError);
      // Continue despite this error
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Cancellation request approved successfully',
        creditNoteId
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