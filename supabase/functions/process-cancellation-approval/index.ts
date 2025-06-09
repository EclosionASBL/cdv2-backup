import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

    // Get the cancellation request details using admin client
    const { data: cancellationRequest, error: requestError } = await supabaseAdmin
      .from('cancellation_requests')
      .select(`
        *,
        registration:registrations!cancellation_requests_registration_id_fkey(
          user_id,
          kid_id,
          activity_id,
          amount_paid,
          payment_status
        )
      `)
      .eq('id', requestId)
      .single();

    if (requestError) {
      console.error('Error fetching cancellation request:', requestError);
      return new Response(
        JSON.stringify({ error: 'Cancellation request not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!cancellationRequest.registration) {
      console.error('Registration not found for cancellation request:', requestId);
      return new Response(
        JSON.stringify({ error: 'Associated registration not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Generate credit note reference for tracking purposes
    let creditNoteId = null;
    if (refundType === 'full' || refundType === 'partial') {
      try {
        // Generate a simple credit note number using timestamp and random suffix
        const currentYear = new Date().getFullYear();
        const yearSuffix = currentYear.toString().slice(-2);
        const timestamp = Date.now().toString().slice(-6); // Last 6 digits of timestamp
        const randomSuffix = Math.floor(Math.random() * 100).toString().padStart(2, '0');
        
        creditNoteId = `NC-${yearSuffix}${timestamp}${randomSuffix}`;
        
        console.log('Generated credit note ID:', creditNoteId);
      } catch (creditNoteError: any) {
        console.error('Error generating credit note reference:', creditNoteError);
        // Continue without credit note
      }
    }

    // Update the cancellation request using admin client
    const { error: updateRequestError } = await supabaseAdmin
      .from('cancellation_requests')
      .update({
        status: 'approved',
        admin_notes: adminNotes,
        refund_type: refundType,
        credit_note_id: creditNoteId
      })
      .eq('id', requestId);

    if (updateRequestError) {
      console.error('Error updating cancellation request:', updateRequestError);
      return new Response(
        JSON.stringify({ error: 'Failed to update cancellation request' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Update the registration status using admin client
    const cancellationStatus = refundType === 'full' 
      ? 'cancelled_full_refund' 
      : refundType === 'partial' 
        ? 'cancelled_partial_refund' 
        : 'cancelled_no_refund';

    const { error: updateRegistrationError } = await supabaseAdmin
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

    // Update the session's current_registrations count using admin client
    try {
      // Get the current count
      const { data: sessionData, error: sessionError } = await supabaseAdmin
        .from('sessions')
        .select('current_registrations')
        .eq('id', cancellationRequest.registration.activity_id)
        .single();
      
      if (sessionError) {
        console.error('Error fetching session:', sessionError);
      } else if (sessionData && sessionData.current_registrations > 0) {
        // Decrement the count
        const { error: updateSessionError } = await supabaseAdmin
          .from('sessions')
          .update({ current_registrations: sessionData.current_registrations - 1 })
          .eq('id', cancellationRequest.registration.activity_id);
        
        if (updateSessionError) {
          console.error('Error updating session registration count:', updateSessionError);
        }
      }
    } catch (sessionError) {
      console.error('Error updating session registration count:', sessionError);
      // Continue despite this error
    }

    console.log('Cancellation request processed successfully:', requestId);

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