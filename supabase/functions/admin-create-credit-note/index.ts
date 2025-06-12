import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
};

interface CreateCreditNoteRequest {
  invoiceId: string;
  type: 'full' | 'partial' | 'custom';
  registrationIds: string[];
  amount: number;
  cancelRegistrations: boolean;
  adminNotes: string;
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

    const { invoiceId, type, registrationIds, amount, cancelRegistrations, adminNotes } = requestData;

    if (!invoiceId || !type || amount <= 0 || (type !== 'full' && registrationIds.length === 0)) {
      console.error('Missing required parameters:', { invoiceId, type, registrationIds, amount });
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Initialize Supabase client
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

    // Check if user is admin
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

    // Get the invoice details with a simple query first
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .select('*')
      .eq('id', invoiceId)
      .single();

    if (invoiceError) {
      console.error('Error fetching invoice:', invoiceError);
      return new Response(
        JSON.stringify({ error: 'Invoice not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Get the user details separately
    const { data: user_data, error: userDataError } = await supabaseAdmin
      .from('users')
      .select('id, email, prenom, nom')
      .eq('id', invoice.user_id)
      .single();

    if (userDataError) {
      console.error('Error fetching user data:', userDataError);
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Get the registrations separately using the registration_ids array
    let registrations = [];
    if (invoice.registration_ids && invoice.registration_ids.length > 0) {
      const { data: registrationsData, error: registrationsError } = await supabaseAdmin
        .from('registrations')
        .select(`
          id,
          kid_id,
          activity_id,
          amount_paid,
          payment_status,
          price_type,
          cancellation_status
        `)
        .in('id', invoice.registration_ids);

      if (registrationsError) {
        console.error('Error fetching registrations:', registrationsError);
        return new Response(
          JSON.stringify({ error: 'Error fetching registrations' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }

      registrations = registrationsData || [];

      // Get additional details for each registration
      for (let i = 0; i < registrations.length; i++) {
        const reg = registrations[i];
        
        // Get kid details
        const { data: kidData } = await supabaseAdmin
          .from('kids')
          .select('prenom, nom')
          .eq('id', reg.kid_id)
          .single();

        // Get session details
        const { data: sessionData } = await supabaseAdmin
          .from('sessions')
          .select(`
            start_date,
            end_date,
            stage:stage_id(title),
            center:center_id(name)
          `)
          .eq('id', reg.activity_id)
          .single();

        registrations[i] = {
          ...reg,
          kid: kidData || { prenom: '', nom: '' },
          session: sessionData || { start_date: null, end_date: null, stage: { title: '' }, center: { name: '' } }
        };
      }
    }

    // Reconstruct the invoice object with the fetched data
    const invoiceWithDetails = {
      ...invoice,
      user: user_data,
      registrations: registrations
    };

    // Process based on credit note type
    let creditNoteAmount = 0;
    let registrationsToProcess: string[] = [];
    let refundType: 'full' | 'partial' = 'full';

    if (type === 'full') {
      // Full refund - use all registrations and full invoice amount
      creditNoteAmount = invoiceWithDetails.amount;
      registrationsToProcess = invoiceWithDetails.registrations.map(reg => reg.id);
      refundType = 'full';
    } else if (type === 'partial') {
      // Partial refund - use selected registrations and sum their amounts
      registrationsToProcess = registrationIds;
      
      // Calculate the sum of selected registration amounts
      const selectedRegistrations = invoiceWithDetails.registrations.filter(reg => 
        registrationIds.includes(reg.id)
      );
      
      creditNoteAmount = selectedRegistrations.reduce(
        (sum, reg) => sum + reg.amount_paid, 
        0
      );
      
      refundType = 'partial';
    } else if (type === 'custom') {
      // Custom amount - use the provided amount and selected registration
      creditNoteAmount = amount;
      registrationsToProcess = registrationIds;
      refundType = 'partial';
    }

    // Generate a credit note number
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

    // Create cancellation requests and credit notes for each registration
    const results = [];
    
    for (const regId of registrationsToProcess) {
      const registration = invoiceWithDetails.registrations.find(r => r.id === regId);
      
      if (!registration) {
        console.warn(`Registration ${regId} not found in invoice ${invoiceWithDetails.id}`);
        continue;
      }
      
      // Skip already cancelled registrations
      if (registration.cancellation_status !== 'none') {
        console.warn(`Registration ${regId} is already cancelled (status: ${registration.cancellation_status})`);
        continue;
      }
      
      try {
        // 1. Create cancellation request
        const { data: cancellationRequest, error: cancellationError } = await supabaseAdmin
          .from('cancellation_requests')
          .insert({
            user_id: invoiceWithDetails.user_id,
            registration_id: registration.id,
            kid_id: registration.kid_id,
            activity_id: registration.activity_id,
            status: 'approved',
            refund_type: refundType,
            admin_notes: adminNotes,
            parent_notes: 'Créé par un administrateur'
          })
          .select()
          .single();
          
        if (cancellationError) {
          console.error(`Error creating cancellation request for registration ${regId}:`, cancellationError);
          continue;
        }
        
        // 2. Calculate individual credit note amount for this registration
        let regCreditAmount = 0;
        
        if (type === 'full' || type === 'partial') {
          // For full or partial refunds, use the registration amount
          regCreditAmount = registration.amount_paid;
        } else if (type === 'custom' && registrationsToProcess.length === 1) {
          // For custom amount with a single registration, use the custom amount
          regCreditAmount = creditNoteAmount;
        } else if (type === 'custom' && registrationsToProcess.length > 1) {
          // For custom amount with multiple registrations, distribute proportionally
          const totalRegAmount = registrationsToProcess.reduce((sum, id) => {
            const reg = invoiceWithDetails.registrations.find(r => r.id === id);
            return sum + (reg ? reg.amount_paid : 0);
          }, 0);
          
          const proportion = registration.amount_paid / totalRegAmount;
          regCreditAmount = creditNoteAmount * proportion;
        }
        
        // 3. Create credit note
        const { data: creditNote, error: creditNoteError } = await supabaseAdmin
          .from('credit_notes')
          .insert({
            user_id: invoiceWithDetails.user_id,
            registration_id: registration.id,
            cancellation_request_id: cancellationRequest.id,
            credit_note_number: creditNoteNumber,
            amount: regCreditAmount,
            status: 'issued',
            invoice_id: invoiceWithDetails.invoice_number,
            invoice_number: invoiceWithDetails.invoice_number
          })
          .select()
          .single();
          
        if (creditNoteError) {
          console.error(`Error creating credit note for registration ${regId}:`, creditNoteError);
          continue;
        }
        
        // 4. Update registration status if requested
        if (cancelRegistrations) {
          const cancellationStatus = refundType === 'full' 
            ? 'cancelled_full_refund' 
            : 'cancelled_partial_refund';
            
          const { error: updateRegError } = await supabaseAdmin
            .from('registrations')
            .update({
              payment_status: 'cancelled',
              cancellation_status: cancellationStatus
            })
            .eq('id', registration.id);
            
          if (updateRegError) {
            console.error(`Error updating registration ${regId}:`, updateRegError);
          } else {
            // 5. Update session registration count
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
            }
          }
        }
        
        // 6. Generate PDF for the credit note
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
          
          // 7. Send email with credit note
          console.log('Sending credit note email for:', creditNote.id);
          
          const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-credit-note-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              credit_note_id: creditNote.id,
              parent_email: invoiceWithDetails.user.email
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
        
        results.push({
          registration_id: registration.id,
          credit_note_id: creditNote.id,
          success: true
        });
        
      } catch (processError) {
        console.error(`Error processing registration ${regId}:`, processError);
        results.push({
          registration_id: regId,
          error: processError.message,
          success: false
        });
      }
    }

    // Check if all registrations were cancelled and update invoice status if needed
    if (cancelRegistrations && type === 'full') {
      const { error: updateInvoiceError } = await supabaseAdmin
        .from('invoices')
        .update({ status: 'cancelled' })
        .eq('id', invoiceId);
        
      if (updateInvoiceError) {
        console.error('Error updating invoice status:', updateInvoiceError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Credit note(s) created successfully',
        results,
        creditNoteNumber
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