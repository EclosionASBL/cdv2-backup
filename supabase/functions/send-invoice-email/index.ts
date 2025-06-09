import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { SMTPClient } from 'npm:emailjs@3.2.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
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
      .select('*, user_id, registration_ids')
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

    // Get user data
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('prenom, nom')
      .eq('id', invoiceData.user_id)
      .single();

    if (userError) {
      console.error("Error fetching user data:", userError);
    }

    // Get registration details
    const { data: registrations, error: registrationsError } = await supabase
      .from('registrations')
      .select(`
        id,
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
      .in('id', invoiceData.registration_ids);

    if (registrationsError) {
      console.error("Error fetching registrations:", registrationsError);
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

    // Check if the response is OK before trying to parse JSON
    if (!pdfRes.ok) {
      const errorText = await pdfRes.text();
      console.error('PDF generation failed with status:', pdfRes.status);
      console.error('Error response:', errorText);
      throw new Error(`Failed to generate invoice PDF: ${pdfRes.status} - ${errorText}`);
    }

    let pdfData;
    try {
      pdfData = await pdfRes.json();
      console.log('PDF response data:', JSON.stringify(pdfData));
    } catch (jsonError) {
      console.error('Error parsing PDF response JSON:', jsonError);
      throw new Error('Invalid response from PDF generation service');
    }

    const pdfUrl = pdfData.pdf_url;
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

    // Format registrations for email
    let registrationsHtml = '';
    if (registrations && registrations.length > 0) {
      registrationsHtml = registrations.map(reg => {
        // Unwrap nested objects if they're arrays
        const kid = Array.isArray(reg.kid) ? reg.kid[0] : reg.kid;
        const session = Array.isArray(reg.session) ? reg.session[0] : reg.session;
        const stage = Array.isArray(session.stage) ? session.stage[0] : session.stage;
        const center = Array.isArray(session.center) ? session.center[0] : session.center;
        
        const startDate = new Date(session.start_date).toLocaleDateString('fr-BE');
        const endDate = new Date(session.end_date).toLocaleDateString('fr-BE');
        
        return `
          <div style="margin-bottom: 15px; padding: 15px; background-color: #f8f9fa; border-radius: 8px;">
            <h3 style="margin-top: 0; color: #4f46e5;">${stage.title}</h3>
            <p><strong>Pour :</strong> ${kid.prenom} ${kid.nom}</p>
            <p><strong>Dates :</strong> Du ${startDate} au ${endDate}</p>
            <p><strong>Centre :</strong> ${center.name}</p>
          </div>
        `;
      }).join('');
    }

    // Fetch the PDF content to attach it to the email
    console.log('Fetching PDF content from URL:', pdfUrl);
    let pdfContent;
    try {
      const pdfResponse = await fetch(pdfUrl);
      if (!pdfResponse.ok) {
        throw new Error(`Failed to fetch PDF: ${pdfResponse.status} ${pdfResponse.statusText}`);
      }
      
      // Get the PDF as an ArrayBuffer
      const pdfBuffer = await pdfResponse.arrayBuffer();
      
      // Convert to Base64
      pdfContent = btoa(
        new Uint8Array(pdfBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      
      console.log('PDF content fetched and encoded successfully');
    } catch (fetchError) {
      console.error('Error fetching PDF content:', fetchError);
      // Continue without attachment if we can't fetch the PDF
      console.log('Will send email without PDF attachment');
    }

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

      const parentName = userData?.prenom || 'Parent';
      const dueDate = new Date(invoiceData.due_date);
      const formattedDueDate = dueDate.toLocaleDateString('fr-BE');

      const emailAttachments = [
        { data: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #4f46e5;">Votre inscription est confirmée !</h1>
            
            <p>Bonjour ${parentName},</p>
            
            <div style="margin-top: 30px; margin-bottom: 30px; padding: 20px; background-color: #f0f4ff; border-radius: 8px; border-left: 4px solid #4f46e5;">
              <h2 style="margin-top: 0; color: #4f46e5;">Informations de paiement</h2>
              <p>Votre facture a été générée. Vous avez jusqu'au <strong>${formattedDueDate}</strong> pour effectuer le paiement.</p>
              
              <div style="background-color: #ffffff; padding: 15px; border-radius: 8px; margin-top: 15px;">
                <p style="margin: 5px 0;"><strong>Montant :</strong> ${invoiceData.amount} €</p>
                <p style="margin: 5px 0;"><strong>IBAN :</strong> BE64 3631 1005 7452</p>
                <p style="margin: 5px 0;"><strong>BIC :</strong> BBRUBEBB</p>
                <p style="margin: 5px 0;"><strong>Bénéficiaire :</strong> Éclosion ASBL</p>
                <p style="margin: 5px 0;"><strong>Communication :</strong> ${invoiceData.communication}</p>
              </div>
            </div>
            
            <p>Nous avons le plaisir de vous confirmer l'inscription de votre enfant aux activités suivantes :</p>
            
            ${registrationsHtml}
            
            <div style="margin-top: 30px; padding: 20px; background-color: #f8f9fa; border-radius: 8px;">
              <h2 style="margin-top: 0; color: #1f2937;">Que se passe-t-il maintenant ?</h2>
              <p>Votre enfant est bien inscrit, même si le paiement n'est pas encore effectué.</p>
              <p>Vous recevrez toutes les informations pratiques pour votre enfant une semaine avant le début des activités.</p>
              <p>Pour toute question, n'hésitez pas à nous contacter :</p>
              <ul>
                <li>Par téléphone : <strong>0470 470 503</strong></li>
                <li>Par email : <strong>info@eclosion.be</strong></li>
              </ul>
            </div>
            
            <p style="margin-top: 30px;">Merci de votre confiance !</p>
            
            <p>L'équipe Éclosion ASBL</p>
          </div>
        `, alternative: true }
      ];

      // Add PDF attachment if we have the content
      if (pdfContent) {
        emailAttachments.push({
          data: pdfContent,
          type: "application/pdf",
          name: `facture_${invoice_number}.pdf`
        });
      }

      const message = {
        from: smtpSender,
        to: parent_email,
        subject: 'Confirmation d\'inscription et facture - Éclosion ASBL',
        attachment: emailAttachments
      };

      // Use callback-based send method instead of sendAsync
      return new Promise((resolve, reject) => {
        client.send(message, (err, result) => {
          if (err) {
            console.error('Error sending email with SMTP:', err);
            reject(new Error(`Failed to send email: ${err.message || 'Unknown email error'}`));
          } else {
            console.log('Email sent successfully via SMTP:', result);
            resolve(new Response(
              JSON.stringify({ success: true, pdf_url: pdfUrl }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            ));
          }
        });
      });
    } catch (emailError: any) {
      console.error('Error sending email with SMTP:', emailError);
      console.error('Error details:', JSON.stringify(emailError));
      
      throw new Error(`Failed to send email: ${emailError.message || 'Unknown email error'}`);
    }
  } catch (error: any) {
    console.error('Error in send-invoice-email function:', error);
    console.error('Error stack:', error.stack);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});