import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
};

interface CreateConsolidatedCreditNoteRequest {
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
    console.log('Starting create-consolidated-credit-note function');
    
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
      requestData = await req.json() as CreateConsolidatedCreditNoteRequest;
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

    // Get the invoice details
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .select(`
        *,
        user:user_id(
          id,
          email,
          prenom,
          nom
        )
      `)
      .eq('id', invoiceId)
      .single();

    if (invoiceError) {
      console.error('Error fetching invoice:', invoiceError);
      return new Response(
        JSON.stringify({ error: 'Invoice not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Get the registrations
    const { data: registrations, error: registrationsError } = await supabaseAdmin
      .from('registrations')
      .select(`
        id,
        kid_id,
        activity_id,
        amount_paid,
        payment_status,
        price_type,
        cancellation_status,
        kid:kids(
          prenom,
          nom
        ),
        session:activity_id(
          stage:stage_id(
            title
          ),
          start_date,
          end_date,
          center:center_id(
            name
          )
        )
      `)
      .in('id', type === 'full' ? invoice.registration_ids : registrationIds);

    if (registrationsError) {
      console.error('Error fetching registrations:', registrationsError);
      return new Response(
        JSON.stringify({ error: 'Error fetching registrations' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Filter out already cancelled registrations
    const validRegistrations = registrations.filter(reg => reg.cancellation_status === 'none');
    
    if (validRegistrations.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No valid registrations found for cancellation' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Determine refund type
    const refundType = type === 'full' ? 'full' : 'partial';

    // Generate a single credit note number for all registrations
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

    // Create a single credit note for all registrations
    const { data: creditNote, error: creditNoteError } = await supabaseAdmin
      .from('credit_notes')
      .insert({
        user_id: invoice.user_id,
        registration_id: validRegistrations[0].id, // Link to the first registration
        cancellation_request_id: null, // No specific cancellation request
        credit_note_number: creditNoteNumber,
        amount: amount,
        status: 'issued',
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number
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

    // Process each registration
    const results = [];
    
    for (const registration of validRegistrations) {
      try {
        // Check if a cancellation request already exists for this registration
        const { data: existingRequest, error: checkError } = await supabaseAdmin
          .from('cancellation_requests')
          .select('id, status')
          .eq('registration_id', registration.id)
          .maybeSingle();
          
        if (checkError) {
          console.error(`Error checking existing cancellation request for registration ${registration.id}:`, checkError);
          throw new Error(`Error checking existing request: ${checkError.message}`);
        }

        let cancellationRequestId;
        
        if (existingRequest) {
          // Update existing cancellation request
          console.log(`Updating existing cancellation request ${existingRequest.id} for registration ${registration.id}`);
          
          const { error: updateError } = await supabaseAdmin
            .from('cancellation_requests')
            .update({
              status: 'approved',
              refund_type: refundType,
              admin_notes: adminNotes,
              credit_note_id: creditNoteNumber,
              credit_note_url: null // Will be updated later
            })
            .eq('id', existingRequest.id);
            
          if (updateError) {
            console.error(`Error updating cancellation request ${existingRequest.id}:`, updateError);
            throw new Error(`Error updating cancellation request: ${updateError.message}`);
          }
          
          cancellationRequestId = existingRequest.id;
        } else {
          // Create new cancellation request
          console.log(`Creating new cancellation request for registration ${registration.id}`);
          
          const { data: newRequest, error: insertError } = await supabaseAdmin
            .from('cancellation_requests')
            .insert({
              user_id: invoice.user_id,
              registration_id: registration.id,
              kid_id: registration.kid_id,
              activity_id: registration.activity_id,
              status: 'approved',
              refund_type: refundType,
              admin_notes: adminNotes,
              parent_notes: 'Créé par un administrateur',
              credit_note_id: creditNoteNumber,
              credit_note_url: null // Will be updated later
            })
            .select()
            .single();
            
          if (insertError) {
            console.error(`Error creating cancellation request for registration ${registration.id}:`, insertError);
            throw new Error(`Error creating cancellation request: ${insertError.message}`);
          }
          
          cancellationRequestId = newRequest.id;
        }

        // If requested, update registration to cancelled
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
            console.error(`Error updating registration ${registration.id}:`, updateRegError);
            throw new Error(`Error updating registration: ${updateRegError.message}`);
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
          }
        }

        results.push({
          registration_id: registration.id,
          cancellation_request_id: cancellationRequestId,
          success: true
        });
      } catch (processError) {
        console.error(`Error processing registration ${registration.id}:`, processError);
        results.push({
          registration_id: registration.id,
          error: processError.message,
          success: false
        });
      }
    }

    // If all registrations are cancelled and we're cancelling registrations, update invoice status
    if (cancelRegistrations) {
      // Check if all registrations for this invoice are now cancelled
      const { data: allRegistrations, error: regError } = await supabaseAdmin
        .from('registrations')
        .select('id, cancellation_status')
        .in('id', invoice.registration_ids);
        
      if (!regError && allRegistrations) {
        // Check if all registrations are cancelled
        const allCancelled = allRegistrations.every(reg => 
          reg.cancellation_status.startsWith('cancelled_')
        );
        
        // Mark invoice as cancelled if all registrations are cancelled
        if (allCancelled) {
          const { error: updateInvoiceError } = await supabaseAdmin
            .from('invoices')
            .update({ status: 'cancelled' })
            .eq('id', invoiceId);
            
          if (updateInvoiceError) {
            console.error('Error updating invoice status:', updateInvoiceError);
          }
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
          
          // Update all cancellation requests with the PDF URL
          const { error: updateRequestsError } = await supabaseAdmin
            .from('cancellation_requests')
            .update({ credit_note_url: pdfData.pdf_url })
            .eq('credit_note_id', creditNoteNumber);
            
          if (updateRequestsError) {
            console.error('Error updating cancellation requests with credit note URL:', updateRequestsError);
          }
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
          credit_note_id: creditNote.id,
          parent_email: invoice.user.email
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
        message: 'Consolidated credit note created successfully',
        credit_note: {
          id: creditNote.id,
          credit_note_number: creditNote.credit_note_number,
          amount: creditNote.amount
        },
        results
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: any) {
    console.error('Error creating consolidated credit note:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});