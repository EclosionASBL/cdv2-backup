import { createClient } from 'npm:@supabase/supabase-js@2.39.7';
import { SMTPClient } from 'npm:emailjs@3.2.0';

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
    
    // SMTP configuration
    const smtpUser = Deno.env.get('SMTP_USER');
    const smtpPassword = Deno.env.get('SMTP_PASSWORD');
    const smtpHost = Deno.env.get('SMTP_HOST') || 'smtp.gmail.com';
    const smtpPort = parseInt(Deno.env.get('SMTP_PORT') || '465');
    const smtpSender = Deno.env.get('SMTP_SENDER') || 'stage-notif@eclosion.be';

    if (!supabaseUrl || !supabaseKey || !apiKey) {
      console.error('Missing environment variables:', { 
        hasSupabaseUrl: !!supabaseUrl, 
        hasSupabaseKey: !!supabaseKey, 
        hasApiKey: !!apiKey
      });
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!smtpUser || !smtpPassword) {
      console.error('Missing SMTP configuration');
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log('Environment variables validated');
    
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
    
    // Send email with SMTP
    try {
      console.log('Preparing to send email with SMTP');
      
      const client = new SMTPClient({
        user: smtpUser,
        password: smtpPassword,
        host: smtpHost,
        port: smtpPort,
        ssl: true,
      });

      const message = {
        from: smtpSender,
        to: parent_email,
        subject: 'Votre facture',
        attachment: [
          { data: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #4f46e5;">Votre facture est prête</h1>
              
              <p>Bonjour,</p>
              
              <p>Veuillez trouver votre facture en pièce jointe. Vous pouvez également la télécharger en cliquant sur le lien ci-dessous :</p>
              
              <p><a href="${pdfUrl}" style="display: inline-block; background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 16px;">Télécharger la facture</a></p>
              
              <p>Merci de votre confiance !</p>
              
              <p>L'équipe Éclosion</p>
            </div>
          `, alternative: true },
          { path: pdfUrl, type: 'application/pdf', name: `${invoice_number}.pdf` }
        ]
      };

      await client.sendAsync(message);
      console.log('Email sent successfully via SMTP');
    } catch (emailError: any) {
      console.error('Error sending email with SMTP:', emailError);
      console.error('Error details:', JSON.stringify(emailError));
      
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