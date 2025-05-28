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
    const { invoice_number, parent_email } = await req.json() as SendInvoiceEmailRequest;

    if (!invoice_number || !parent_email) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const apiKey = Deno.env.get('UPDATE_INVOICE_API_KEY') ?? '';
    const resend = new Resend(Deno.env.get('RESEND_API_KEY'));
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Generate PDF
    const pdfRes = await fetch(`${supabaseUrl}/functions/v1/generate-invoice-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoice_number, api_key: apiKey }),
    });

    const pdfData = await pdfRes.json();
    if (!pdfRes.ok) {
      throw new Error(pdfData.error || 'Failed to generate invoice PDF');
    }

    const pdfUrl = pdfData.pdf_url as string;

    // Store PDF URL in invoices table
    await supabase
      .from('invoices')
      .update({ pdf_url: pdfUrl })
      .eq('invoice_number', invoice_number);

    // Send email with PDF link
    await resend.emails.send({
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

    return new Response(
      JSON.stringify({ success: true, pdf_url: pdfUrl }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    console.error('Error sending invoice email:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});