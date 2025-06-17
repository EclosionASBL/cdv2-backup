import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey',
};

interface CreateCreditNoteRequest {
  invoiceId: string;
  type: 'full' | 'partial';
  amount?: number;
  registrationIds: string[];
  cancelRegistrations: boolean;
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
    console.log('Starting admin-create-credit-note function');
    
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
      requestData = await req.json() as CreateCreditNoteRequest;
      console.log('Request data:', JSON.stringify(requestData));
    } catch (parseError) {
      console.error('Error parsing request JSON:', parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { invoiceId, type, amount, registrationIds, cancelRegistrations, adminNotes } = requestData;

    if (!invoiceId || !type || !registrationIds || registrationIds.length === 0) {
      console.error('Missing required parameters');
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

    // Get invoice details
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .select('*, user_id')
      .eq('invoice_number', invoiceId)
      .single();

    if (invoiceError) {
      console.error('Error fetching invoice:', invoiceError);
      return new Response(
        JSON.stringify({ error: 'Invoice not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Get registrations
    const { data: registrations, error: registrationsError } = await supabaseAdmin
      .from('registrations')
      .select('id, amount_paid, activity_id, kid_id')
      .in('id', registrationIds);

    if (registrationsError) {
      console.error('Error fetching registrations:', registrationsError);
      return new Response(
        JSON.stringify({ error: 'Error fetching registrations' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!registrations || registrations.length === 0) {
      console.error('No registrations found');
      return new Response(
        JSON.stringify({ error: 'No registrations found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Calculate total amount for selected registrations
    const totalRegistrationAmount = registrations.reduce((sum, reg) => sum + reg.amount_paid, 0);
    
    // Determine credit note amount
    let creditNoteAmount = 0;
    if (type === 'full') {
      creditNoteAmount = totalRegistrationAmount;
    } else if (type === 'partial') {
      if (!amount) {
        console.error('Amount is required for partial credit notes');
        return new Response(
          JSON.stringify({ error: 'Amount is required for partial credit notes' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      creditNoteAmount = amount;
    }

    // Generate credit note number
    const currentYear = new Date().getFullYear();
    const { data: creditNoteNumber, error: sequenceError } = await supabaseAdmin.rpc(
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

    console.log('Generated credit note number:', creditNoteNumber);

    // Create credit note
    const { data: creditNote, error: creditNoteError } = await supabaseAdmin
      .from('credit_notes')
      .insert({
        user_id: invoice.user_id,
        registration_id: registrations[0].id, // Use the first registration as the primary one
        credit_note_number: creditNoteNumber,
        amount: creditNoteAmount,
        status: 'issued',
        invoice_id: invoiceId,
        invoice_number: invoiceId
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

    // If requested, update registrations to cancelled
    if (cancelRegistrations) {
      const cancellationStatus = type === 'full' ? 'cancelled_full_refund' : 'cancelled_partial_refund';
      
      const { error: updateError } = await supabaseAdmin
        .from('registrations')
        .update({
          payment_status: 'cancelled',
          cancellation_status: cancellationStatus
        })
        .in('id', registrationIds);

      if (updateError) {
        console.error('Error updating registrations:', updateError);
        // Continue despite error
      }

      // Update invoice status if all registrations are cancelled
      if (type === 'full') {
        const { error: invoiceUpdateError } = await supabaseAdmin
          .from('invoices')
          .update({ status: 'cancelled' })
          .eq('invoice_number', invoiceId);

        if (invoiceUpdateError) {
          console.error('Error updating invoice status:', invoiceUpdateError);
          // Continue despite error
        }
      }

      // Update session registration counts
      for (const registration of registrations) {
        try {
          // Count active registrations for this activity
          const { data: countData } = await supabaseAdmin
            .from('registrations')
            .select('id', { count: 'exact' })
            .eq('activity_id', registration.activity_id)
            .in('payment_status', ['paid', 'pending']);
            
          const count = countData?.length || 0;
          
          // Update the session count
          await supabaseAdmin
            .from('sessions')
            .update({ current_registrations: count })
            .eq('id', registration.activity_id);
        } catch (countError) {
          console.error('Error updating session count:', countError);
          // Continue despite error
        }
      }
    }

    // Generate PDF for the credit note
    try {
      console.log('Generating PDF for credit note:', creditNote.id);
      
      const pdfResponse = await fetch(`${supabaseUrl}/functions/v1/generate-credit-note-pdf`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          credit_note_id: creditNote.id,
          api_key: Deno.env.get('UPDATE_INVOICE_API_KEY') || ''
        }),
      });
      
      if (!pdfResponse.ok) {
        const errorText = await pdfResponse.text();
        console.error('Error generating credit note PDF:', errorText);
        throw new Error(`Failed to generate credit note PDF: ${errorText}`);
      }
      
      const pdfData = await pdfResponse.json();
      console.log('Credit note PDF generated:', pdfData);
      
      // Update the credit note with the PDF URL
      if (pdfData.pdf_url) {
        const { error: updateError } = await supabaseAdmin
          .from('credit_notes')
          .update({ pdf_url: pdfData.pdf_url })
          .eq('id', creditNote.id);
          
        if (updateError) {
          console.error('Error updating credit note with PDF URL:', updateError);
        } else {
          console.log('Credit note updated with PDF URL');
          
          // Add the PDF URL to the result
          creditNote.pdf_url = pdfData.pdf_url;
        }
      }
      
      // Send email with credit note
      console.log('Sending credit note email for:', creditNote.id);
      
      const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-credit-note-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          credit_note_id: creditNote.id
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

    return new Response(
      JSON.stringify({ 
        success: true, 
        creditNote,
        registrationsCancelled: cancelRegistrations ? registrationIds.length : 0
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: any) {
    console.error('Error creating credit note:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});