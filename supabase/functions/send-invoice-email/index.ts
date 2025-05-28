import { createClient } from 'npm:@supabase/supabase-js@2.39.7';
import { Resend } from 'npm:resend@2.1.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface SendInvoiceEmailRequest {
  invoice_number: string;
  parent_email: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    console.log('Starting send-invoice-email function');
    
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
      requestData = await req.json() as SendInvoiceEmailRequest;
      console.log('Request data:', JSON.stringify(requestData));
    } catch (parseError) {
      console.error('Error parsing request JSON:', parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { invoice_number, parent_email } = requestData;

    if (!invoice_number || !parent_email) {
      console.error('Missing required parameters:', { invoice_number, parent_email });
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Check environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const apiKey = Deno.env.get('UPDATE_INVOICE_API_KEY');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    if (!supabaseUrl || !supabaseKey || !apiKey) {
      console.error('Missing environment variables:', { 
        hasSupabaseUrl: !!supabaseUrl, 
        hasSupabaseKey: !!supabaseKey, 
        hasApiKey: !!apiKey,
        hasResendApiKey: !!resendApiKey
      });
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!resendApiKey) {
      console.error('Missing RESEND_API_KEY environment variable');
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log('Environment variables validated');
    console.log('Initializing Resend with API key length:', resendApiKey.length);
    
    const resend = new Resend(resendApiKey);
    const supabase = createClient(supabaseUrl, supabaseKey);

    // First verify the invoice exists
    console.log('Verifying invoice exists:', invoice_number);
    const { data: invoiceData, error: invoiceError } = await supabase
      .from('invoices')
      .select('*')
      .eq('invoice_number', invoice_number)
      .single();

    if (invoiceError || !invoiceData) {
      console.error("Error fetching invoice:", invoiceError);
      return new Response(
        JSON.stringify({ error: "Invoice not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log('Invoice found, generating PDF for invoice:', invoice_number);
    
    // Generate PDF
    let pdfRes;
    try {
      pdfRes = await fetch(`${supabaseUrl}/functions/v1/generate-invoice-pdf`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': authHeader // Pass along the original authorization header
        },
        body: JSON.stringify({ 
          invoice_number, 
          api_key: apiKey 
        }),
      });
      console.log('PDF generation response status:', pdfRes.status);
    } catch (fetchError) {
      console.error('Network error calling generate-invoice-pdf:', fetchError);
      throw new Error(`Failed to connect to PDF generation service: ${fetchError.message}`);
    }

    let pdfData;
    try {
      pdfData = await pdfRes.json();
      console.log('PDF response data:', JSON.stringify(pdfData));
    } catch (jsonError) {
      console.error('Error parsing PDF response JSON:', jsonError);
      throw new Error('Invalid response from PDF generation service');
    }

    if (!pdfRes.ok) {
      console.error('PDF generation failed:', pdfData);
      throw new Error(pdfData.error || `Failed to generate invoice PDF: ${pdfRes.status}`);
    }

    const pdfUrl = pdfData.pdf_url as string;
    if (!pdfUrl) {
      console.error('PDF URL is missing in response:', pdfData);
      throw new Error('PDF URL is missing in response');
    }

    console.log('PDF generated successfully:', pdfUrl);

    // Store PDF URL in invoices table
    try {
      const { error: updateError } = await supabase
        .from('invoices')
        .update({ pdf_url: pdfUrl })
        .eq('invoice_number', invoice_number);
        
      if (updateError) {
        console.error('Error updating invoice with PDF URL:', updateError);
      } else {
        console.log('Invoice updated with PDF URL');
      }
    } catch (dbError) {
      console.error('Database error updating invoice:', dbError);
    }

    console.log('Sending email to:', parent_email);
    console.log('Email will include PDF URL:', pdfUrl);
    
    // Send email with PDF link
    try {
      console.log('Preparing to send email with Resend');
      const emailResult = await resend.emails.send({
        from: 'no-reply@eclosion.be',
        to: parent_email,
        subject: 'Votre facture',
        html: `Bonjour,<br/><br/>Veuillez trouver votre facture ici : <a href="${pdfUrl}">télécharger</a>.<br/><br/>Merci !<br/>L'équipe Éclosion`,
        attachments: [
          {
            filename: `${invoice_number}.pdf`,
            path: pdfUrl,
          },
        ],
      });
      
      console.log('Email sent successfully:', JSON.stringify(emailResult));
    } catch (emailError: any) {
      console.error('Error sending email with Resend:', emailError);
      console.error('Error details:', JSON.stringify(emailError));
      
      // Log additional details about the error
      if (emailError.response) {
        console.error('Error response:', JSON.stringify(emailError.response));
      }
      
      if (emailError.message) {
        console.error('Error message:', emailError.message);
      }
      
      if (emailError.code) {
        console.error('Error code:', emailError.code);
      }
      
      throw new Error(`Failed to send email: ${emailError.message || 'Unknown email error'}`);
    }

    return new Response(
      JSON.stringify({ success: true, pdf_url: pdfUrl }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: any) {
    console.error('Error in send-invoice-email function:', error);
    console.error('Error stack:', error.stack);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});