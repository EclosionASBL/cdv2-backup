import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
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

    // Get the cancellation request details using admin client
    const { data: cancellationRequest, error: requestError } = await supabaseAdmin
      .from('cancellation_requests')
      .select(`
        *,
        registration:registrations!cancellation_requests_registration_id_fkey(
          id,
          user_id,
          kid_id,
          activity_id,
          amount_paid,
          payment_status,
          invoice_id
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

    // Get invoice details if available
    let invoiceId = null;
    let invoiceNumber = null;
    
    if (cancellationRequest.registration.invoice_id) {
      try {
        const { data: invoice, error: invoiceError } = await supabaseAdmin
          .from('invoices')
          .select('id, invoice_number, registration_ids')
          .eq('invoice_number', cancellationRequest.registration.invoice_id)
          .single();
          
        if (!invoiceError && invoice) {
          invoiceId = invoice.id;
          invoiceNumber = invoice.invoice_number;
          console.log('Found invoice:', invoiceId, invoiceNumber);
        } else {
          console.error('Error fetching invoice:', invoiceError);
        }
      } catch (invoiceError) {
        console.error('Error fetching invoice details:', invoiceError);
      }
    }

    // Calculate refund amount based on refund type
    let refundAmount = 0;
    if (refundType === 'full') {
      refundAmount = cancellationRequest.registration.amount_paid;
    } else if (refundType === 'partial') {
      // For partial refunds, refund 50% of the amount
      refundAmount = cancellationRequest.registration.amount_paid * 0.5;
    }

    // Generate credit note number using the database function
    let creditNoteNumber = null;
    let creditNoteId = null;
    
    if (refundType === 'full' || refundType === 'partial') {
      try {
        // Get current year for the sequence
        const currentYear = new Date().getFullYear();
        
        // Call the database function to get the next credit note number
        const { data: sequenceData, error: sequenceError } = await supabaseAdmin.rpc(
          'get_next_credit_note_sequence',
          { p_year: currentYear }
        );
        
        if (sequenceError) {
          console.error('Error generating credit note number:', sequenceError);
          throw new Error('Failed to generate credit note number');
        }
        
        // The function now returns the complete formatted number, no need to add "NC-" prefix
        creditNoteNumber = sequenceData;
        console.log('Generated credit note number:', creditNoteNumber);
        
        // Check if there are other registrations in the same invoice
        let shouldCreateConsolidatedCreditNote = false;
        let allRegistrationIds: string[] = [];
        
        if (invoiceId) {
          const { data: invoice, error: invoiceError } = await supabaseAdmin
            .from('invoices')
            .select('registration_ids')
            .eq('id', invoiceId)
            .single();
            
          if (!invoiceError && invoice && invoice.registration_ids && invoice.registration_ids.length > 1) {
            // There are multiple registrations in this invoice
            allRegistrationIds = invoice.registration_ids;
            shouldCreateConsolidatedCreditNote = true;
          }
        }
        
        if (shouldCreateConsolidatedCreditNote) {
          // Create a consolidated credit note for all registrations in the invoice
          const { data: creditNote, error: creditNoteError } = await supabaseAdmin
            .from('credit_notes')
            .insert({
              user_id: cancellationRequest.registration.user_id,
              registration_id: cancellationRequest.registration_id,
              cancellation_request_id: null, // No specific cancellation request for consolidated note
              credit_note_number: creditNoteNumber,
              amount: refundAmount, // Start with the amount for this registration
              status: 'issued',
              invoice_id: invoiceId,
              invoice_number: invoiceNumber
            })
            .select('id')
            .single();
            
          if (creditNoteError) {
            console.error('Error creating credit note record:', creditNoteError);
            throw new Error('Failed to create credit note record');
          }
          
          creditNoteId = creditNote.id;
          console.log('Created consolidated credit note with ID:', creditNoteId);
          
          // Update the cancellation request with the credit note number
          const { error: updateRequestError } = await supabaseAdmin
            .from('cancellation_requests')
            .update({
              status: 'approved',
              admin_notes: adminNotes,
              refund_type: refundType,
              credit_note_id: creditNoteNumber
            })
            .eq('id', requestId);
            
          if (updateRequestError) {
            console.error('Error updating cancellation request:', updateRequestError);
            // Continue despite this error
          }
        } else {
          // Create credit note record for just this registration
          const { data: creditNote, error: creditNoteError } = await supabaseAdmin
            .from('credit_notes')
            .insert({
              user_id: cancellationRequest.registration.user_id,
              registration_id: cancellationRequest.registration_id,
              cancellation_request_id: cancellationRequest.id,
              credit_note_number: creditNoteNumber,
              amount: refundAmount,
              status: 'issued',
              invoice_id: invoiceId,
              invoice_number: invoiceNumber
            })
            .select('id')
            .single();
            
          if (creditNoteError) {
            console.error('Error creating credit note record:', creditNoteError);
            throw new Error('Failed to create credit note record');
          }
          
          creditNoteId = creditNote.id;
          console.log('Created credit note with ID:', creditNoteId);
          
          // Update the cancellation request with the credit note ID
          const { error: updateRequestError } = await supabaseAdmin
            .from('cancellation_requests')
            .update({
              status: 'approved',
              admin_notes: adminNotes,
              refund_type: refundType,
              credit_note_id: creditNoteNumber
            })
            .eq('id', requestId);
            
          if (updateRequestError) {
            console.error('Error updating cancellation request:', updateRequestError);
            // Continue despite this error
          }
        }
      } catch (creditNoteError: any) {
        console.error('Error handling credit note creation:', creditNoteError);
        // Continue with the process even if credit note creation fails
      }
    } else {
      // Just update the cancellation request status
      const { error: updateRequestError } = await supabaseAdmin
        .from('cancellation_requests')
        .update({
          status: 'approved',
          admin_notes: adminNotes,
          refund_type: refundType
        })
        .eq('id', requestId);
        
      if (updateRequestError) {
        console.error('Error updating cancellation request:', updateRequestError);
        return new Response(
          JSON.stringify({ error: 'Failed to update cancellation request' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
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
        .eq('id', cancellationRequest.activity_id)
        .single();
      
      if (sessionError) {
        console.error('Error fetching session:', sessionError);
      } else if (sessionData && sessionData.current_registrations > 0) {
        // Decrement the count
        const { error: updateSessionError } = await supabaseAdmin
          .from('sessions')
          .update({ current_registrations: sessionData.current_registrations - 1 })
          .eq('id', cancellationRequest.activity_id);
        
        if (updateSessionError) {
          console.error('Error updating session registration count:', updateSessionError);
        }
      }
    } catch (sessionError) {
      console.error('Error updating session registration count:', sessionError);
      // Continue despite this error
    }

    // Check if all registrations for this invoice are now cancelled
    if (invoiceId) {
      try {
        // Get all registrations for this invoice
        const { data: allRegistrations, error: regError } = await supabaseAdmin
          .from('registrations')
          .select('id, cancellation_status')
          .in('id', invoiceId);
          
        if (!regError && allRegistrations) {
          // Check if all registrations are cancelled
          const allCancelled = allRegistrations.every(reg => 
            reg.cancellation_status.startsWith('cancelled_')
          );
          
          // If all registrations are cancelled, mark the invoice as cancelled
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
      } catch (invoiceError) {
        console.error('Error checking invoice registrations:', invoiceError);
      }
    }

    // Generate PDF for the credit note if it was created
    if (creditNoteId && (refundType === 'full' || refundType === 'partial')) {
      try {
        console.log('Generating PDF for credit note:', creditNoteId);
        
        const pdfResponse = await fetch(`${supabaseUrl}/functions/v1/generate-credit-note-pdf`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            credit_note_id: creditNoteId,
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
        
        // Send email with credit note
        console.log('Sending credit note email for:', creditNoteId);
        
        const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-credit-note-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            credit_note_id: creditNoteId
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

    console.log('Cancellation request processed successfully:', requestId);
    console.log('Generated credit note ID:', creditNoteId);
    console.log('Generated credit note number:', creditNoteNumber);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Cancellation request approved successfully',
        creditNoteNumber: creditNoteNumber,
        creditNoteId: creditNoteId
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