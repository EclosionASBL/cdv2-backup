import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { SMTPClient } from 'npm:emailjs@3.2.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface SendCreditNoteEmailRequest {
  credit_note_id: string;
  parent_email?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    console.log('Starting send-credit-note-email function');
    
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
      requestData = await req.json() as SendCreditNoteEmailRequest;
      console.log('Request data:', JSON.stringify(requestData));
    } catch (parseError) {
      console.error('Error parsing request JSON:', parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { credit_note_id, parent_email } = requestData;

    if (!credit_note_id) {
      console.error('Missing required parameters:', { credit_note_id });
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: credit_note_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Check environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    // SMTP configuration
    const smtpUser = Deno.env.get('SMTP_USER');
    const smtpPassword = Deno.env.get('SMTP_PASSWORD');
    const smtpHost = Deno.env.get('SMTP_HOST') || 'smtp.gmail.com';
    const smtpPort = parseInt(Deno.env.get('SMTP_PORT') || '465');
    const smtpSender = Deno.env.get('SMTP_SENDER') || 'stage-notif@eclosion.be';

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing environment variables:', { 
        hasSupabaseUrl: !!supabaseUrl, 
        hasSupabaseKey: !!supabaseKey
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

    // Get credit note data
    console.log('Fetching credit note data for:', credit_note_id);
    const { data: creditNote, error: creditNoteError } = await supabase
      .from('credit_notes')
      .select(`
        *,
        user:user_id(
          prenom, 
          nom, 
          email
        ),
        registration:registration_id(
          kid:kid_id(
            prenom,
            nom
          ),
          session:activity_id(
            stage:stage_id(
              title
            ),
            start_date,
            end_date
          )
        )
      `)
      .eq('id', credit_note_id)
      .single();

    if (creditNoteError) {
      console.error("Error fetching credit note:", creditNoteError);
      return new Response(
        JSON.stringify({ error: "Credit note not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Unwrap nested objects if they're arrays
    const user = Array.isArray(creditNote.user) ? creditNote.user[0] : creditNote.user;
    const registration = Array.isArray(creditNote.registration) ? creditNote.registration[0] : creditNote.registration;
    const kid = Array.isArray(registration.kid) ? registration.kid[0] : registration.kid;
    const session = Array.isArray(registration.session) ? registration.session[0] : registration.session;
    const stage = Array.isArray(session.stage) ? session.stage[0] : session.stage;

    // Format dates
    const startDate = new Date(session.start_date).toLocaleDateString('fr-BE');
    const endDate = new Date(session.end_date).toLocaleDateString('fr-BE');

    // Use provided email or fallback to user's email
    const recipientEmail = parent_email || user.email;
    if (!recipientEmail) {
      console.error("No recipient email found");
      return new Response(
        JSON.stringify({ error: "No recipient email found" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Send email with SMTP
    try {
      console.log('Preparing to send email with SMTP to:', recipientEmail);
      
      const client = new SMTPClient({
        user: smtpUser,
        password: smtpPassword,
        host: smtpHost,
        port: smtpPort,
        ssl: true,
      });

      const message = {
        from: smtpSender,
        to: recipientEmail,
        subject: `Note de crédit ${creditNote.credit_note_number} - Éclosion ASBL`,
        attachment: [
          { data: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #4f46e5;">Note de crédit</h1>
              
              <p>Bonjour ${user.prenom},</p>
              
              <p>Suite à l'annulation de l'inscription de ${kid.prenom} au stage "${stage.title}" 
              (du ${startDate} au ${endDate}), nous vous informons qu'une note de crédit a été émise.</p>
              
              <div style="margin-top: 30px; margin-bottom: 30px; padding: 20px; background-color: #f0f4ff; border-radius: 8px; border-left: 4px solid #4f46e5;">
                <h2 style="margin-top: 0; color: #4f46e5;">Détails de la note de crédit</h2>
                
                <div style="background-color: #ffffff; padding: 15px; border-radius: 8px; margin-top: 15px;">
                  <p style="margin: 5px 0;"><strong>Numéro :</strong> ${creditNote.credit_note_number}</p>
                  <p style="margin: 5px 0;"><strong>Montant :</strong> ${creditNote.amount} €</p>
                  <p style="margin: 5px 0;"><strong>Date :</strong> ${new Date(creditNote.created_at).toLocaleDateString('fr-BE')}</p>
                </div>
                
                <p style="margin-top: 15px;">
                  <a href="${creditNote.pdf_url}" style="display: inline-block; background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
                    Télécharger la note de crédit
                  </a>
                </p>
              </div>
              
              <p>Le montant sera remboursé par virement bancaire dans les 30 jours.</p>
              
              <p>Pour toute question, n'hésitez pas à nous contacter :</p>
              <ul>
                <li>Par téléphone : <strong>0470 470 503</strong></li>
                <li>Par email : <strong>info@eclosion.be</strong></li>
              </ul>
              
              <p style="margin-top: 30px;">Cordialement,</p>
              
              <p>L'équipe Éclosion ASBL</p>
            </div>
          `, alternative: true }
        ]
      };

      // Use callback-based send method instead of sendAsync
      return new Promise((resolve, reject) => {
        client.send(message, (err, result) => {
          if (err) {
            console.error('Error sending email with SMTP:', err);
            resolve(new Response(
              JSON.stringify({ 
                success: false, 
                error: "Email could not be sent, but credit note was generated." 
              }),
              {
                status: 200, // Still return 200 to not break the flow
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            ));
          } else {
            console.log('Email sent successfully via SMTP:', result);
            
            // Update credit note status to 'sent'
            supabase
              .from('credit_notes')
              .update({ status: 'sent' })
              .eq('id', credit_note_id)
              .then(({ error: updateError }) => {
                if (updateError) {
                  console.error('Error updating credit note status:', updateError);
                } else {
                  console.log('Credit note status updated to sent');
                }
              });
            
            resolve(new Response(
              JSON.stringify({ 
                success: true,
                pdf_url: creditNote.pdf_url
              }),
              {
                status: 200,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            ));
          }
        });
      });
    } catch (emailError: any) {
      console.error('Error sending email with SMTP:', emailError);
      console.error('Error details:', JSON.stringify(emailError));
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Email could not be sent, but credit note was generated.",
          pdf_url: creditNote.pdf_url
        }),
        {
          status: 200, // Still return 200 to not break the flow
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  } catch (error: any) {
    console.error('Error in send-credit-note-email function:', error);
    console.error('Error stack:', error.stack);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});