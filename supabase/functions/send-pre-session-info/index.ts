import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { SMTPClient } from 'npm:emailjs@3.2.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
};

interface SendPreSessionInfoRequest {
  session_id?: string; // Optionnel: pour tester avec une session spécifique
  days_before?: number; // Optionnel: nombre de jours avant le début de la session (défaut: 7)
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
    console.log('Starting send-pre-session-info function');
    
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
    let requestData: SendPreSessionInfoRequest = {};
    try {
      const body = await req.text();
      if (body) {
        requestData = JSON.parse(body);
      }
      console.log('Request data:', JSON.stringify(requestData));
    } catch (parseError) {
      console.error('Error parsing request JSON:', parseError);
      // Continue with empty request data
    }

    const { session_id, days_before = 7 } = requestData;

    // Check environment variables
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    // SMTP configuration
    const smtpUser = Deno.env.get('SMTP_USER');
    const smtpPassword = Deno.env.get('SMTP_PASSWORD');
    const smtpHost = Deno.env.get('SMTP_HOST') || 'smtp.gmail.com';
    const smtpPort = parseInt(Deno.env.get('SMTP_PORT') || '465');
    const smtpSender = Deno.env.get('SMTP_SENDER') || 'stage-notif@eclosion.be';
    
    // Test mode configuration
    const testMode = Deno.env.get('EMAIL_TEST_MODE') === 'true';
    const testEmailRecipient = Deno.env.get('TEST_EMAIL_RECIPIENT') || 'matteo@eclosion.be';

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
    console.log('Test mode:', testMode ? 'ENABLED' : 'DISABLED');
    if (testMode) {
      console.log('Test email recipient:', testEmailRecipient);
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Calculate the target date (sessions starting in exactly 'days_before' days)
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + days_before);
    const targetDateStr = targetDate.toISOString().split('T')[0]; // Format as YYYY-MM-DD
    
    console.log(`Looking for sessions starting on: ${targetDateStr}`);

    // Get sessions starting on the target date
    let sessionsQuery = supabase
      .from('sessions')
      .select(`
        id,
        stage_id,
        center_id,
        start_date,
        end_date,
        capacity,
        current_registrations,
        stage:stages(title, description),
        center:centers(name, address, address2, city, postal_code, phone)
      `)
      .eq('start_date', targetDateStr)
      .eq('active', true);
    
    // If a specific session_id is provided, use that instead
    if (session_id) {
      console.log(`Filtering for specific session: ${session_id}`);
      sessionsQuery = supabase
        .from('sessions')
        .select(`
          id,
          stage_id,
          center_id,
          start_date,
          end_date,
          capacity,
          current_registrations,
          stage:stages(title, description),
          center:centers(name, address, address2, city, postal_code, phone)
        `)
        .eq('id', session_id)
        .eq('active', true);
    }
    
    const { data: sessions, error: sessionsError } = await sessionsQuery;

    if (sessionsError) {
      console.error('Error fetching sessions:', sessionsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch sessions' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    if (!sessions || sessions.length === 0) {
      console.log('No sessions found for the target date');
      return new Response(
        JSON.stringify({ message: 'No sessions found for the target date' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    console.log(`Found ${sessions.length} sessions for the target date`);

    // Create SMTP client
    const client = new SMTPClient({
      user: smtpUser,
      password: smtpPassword,
      host: smtpHost,
      port: smtpPort,
      ssl: true,
    });

    // Get the ROI document URL
    const { data: { publicUrl: roiUrl } } = supabase.storage
      .from('public')
      .getPublicUrl('roi_eclosion.pdf');

    // Process each session
    const results = [];
    for (const session of sessions) {
      console.log(`Processing session: ${session.id} - ${session.stage.title}`);
      
      // Get registrations for this session
      const { data: registrations, error: registrationsError } = await supabase
        .from('registrations')
        .select(`
          id,
          user_id,
          kid_id,
          payment_status,
          user:users!registrations_user_id_fkey(
            id,
            email,
            prenom,
            nom,
            telephone
          ),
          kid:kids(
            prenom,
            nom
          )
        `)
        .eq('activity_id', session.id)
        .in('payment_status', ['paid', 'pending'])
        .neq('cancellation_status', 'cancelled_full_refund');

      if (registrationsError) {
        console.error(`Error fetching registrations for session ${session.id}:`, registrationsError);
        results.push({
          session_id: session.id,
          success: false,
          error: `Failed to fetch registrations: ${registrationsError.message}`
        });
        continue;
      }

      if (!registrations || registrations.length === 0) {
        console.log(`No registrations found for session ${session.id}`);
        results.push({
          session_id: session.id,
          success: true,
          message: 'No registrations found for this session'
        });
        continue;
      }

      console.log(`Found ${registrations.length} registrations for session ${session.id}`);

      // Group registrations by parent (user_id)
      const registrationsByParent = registrations.reduce((acc, reg) => {
        const userId = reg.user_id;
        if (!acc[userId]) {
          acc[userId] = [];
        }
        acc[userId].push(reg);
        return acc;
      }, {} as Record<string, typeof registrations>);

      // Process each parent
      for (const [userId, userRegistrations] of Object.entries(registrationsByParent)) {
        if (userRegistrations.length === 0) continue;
        
        // Get parent info from the first registration
        const parent = userRegistrations[0].user;
        if (!parent) {
          console.error(`Parent information missing for user ${userId}`);
          continue;
        }

        // Format the email content
        const startDate = new Date(session.start_date).toLocaleDateString('fr-BE');
        const endDate = new Date(session.end_date).toLocaleDateString('fr-BE');
        
        // Unwrap nested objects if they're arrays
        const stage = Array.isArray(session.stage) ? session.stage[0] : session.stage;
        const center = Array.isArray(session.center) ? session.center[0] : session.center;
        
        // Build the list of children registered for this session
        const childrenHtml = userRegistrations.map(reg => {
          const kid = Array.isArray(reg.kid) ? reg.kid[0] : reg.kid;
          return `<li>${kid.prenom} ${kid.nom}</li>`;
        }).join('');

        // Determine the recipient email
        const recipientEmail = testMode ? testEmailRecipient : parent.email;
        
        // Create the email subject
        const emailSubject = `Informations importantes pour le stage "${stage.title}" du ${startDate}`;
        
        // Create the email content
        const emailHtml = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #4f46e5;">Informations importantes pour votre stage</h1>
            
            <p>Bonjour ${parent.prenom},</p>
            
            <p>Le stage "${stage.title}" auquel ${userRegistrations.length > 1 ? 'vos enfants sont inscrits' : 'votre enfant est inscrit'} commence dans une semaine, le <strong>${startDate}</strong>.</p>
            
            <div style="margin-top: 30px; margin-bottom: 30px; padding: 20px; background-color: #f0f4ff; border-radius: 8px; border-left: 4px solid #4f46e5;">
              <h2 style="margin-top: 0; color: #4f46e5;">Détails du stage</h2>
              
              <div style="background-color: #ffffff; padding: 15px; border-radius: 8px; margin-top: 15px;">
                <p style="margin: 5px 0;"><strong>Stage :</strong> ${stage.title}</p>
                <p style="margin: 5px 0;"><strong>Dates :</strong> Du ${startDate} au ${endDate}</p>
                <p style="margin: 5px 0;"><strong>Centre :</strong> ${center.name}</p>
                <p style="margin: 5px 0;"><strong>Adresse :</strong> ${center.address}</p>
                ${center.address2 ? `<p style="margin: 5px 0;"><strong>Adresse secondaire :</strong> ${center.address2}</p>` : ''}
                <p style="margin: 5px 0;"><strong>Code postal :</strong> ${center.postal_code}</p>
                <p style="margin: 5px 0;"><strong>Ville :</strong> ${center.city}</p>
                ${center.phone ? `<p style="margin: 5px 0;"><strong>Téléphone :</strong> ${center.phone}</p>` : ''}
              </div>
              
              <div style="margin-top: 15px;">
                <h3 style="color: #4f46e5;">Enfants inscrits</h3>
                <ul>
                  ${childrenHtml}
                </ul>
              </div>
            </div>
            
            <div style="margin-top: 20px;">
              <h3 style="color: #4f46e5;">Règlement d'Ordre Intérieur</h3>
              <p>Veuillez prendre connaissance du Règlement d'Ordre Intérieur en cliquant sur le lien ci-dessous :</p>
              <p><a href="${roiUrl}" style="color: #4f46e5; text-decoration: underline;">Télécharger le ROI</a></p>
            </div>
            
            <div style="margin-top: 20px;">
              <h3 style="color: #4f46e5;">Informations pratiques</h3>
              <ul>
                <li>Horaire d'accueil : 8h00 - 9h00</li>
                <li>Horaire de fin de journée : 16h00 - 17h30</li>
                <li>Prévoir une tenue adaptée aux activités et à la météo</li>
                <li>Apporter une gourde d'eau et une collation pour la journée</li>
                <li>Prévoir un repas de midi (pas de possibilité de réchauffer sur place)</li>
              </ul>
            </div>
            
            <p style="margin-top: 30px;">Pour toute question, n'hésitez pas à nous contacter :</p>
            <ul>
              <li>Par téléphone : <strong>0470 470 503</strong></li>
              <li>Par email : <strong>info@eclosion.be</strong></li>
            </ul>
            
            <p style="margin-top: 30px;">Nous sommes impatients d'accueillir ${userRegistrations.length > 1 ? 'vos enfants' : 'votre enfant'} pour cette semaine de stage !</p>
            
            <p>Cordialement,</p>
            
            <p>L'équipe Éclosion ASBL</p>
          </div>
        `;

        try {
          console.log(`Sending email to ${testMode ? 'TEST RECIPIENT: ' + testEmailRecipient : parent.email} for session ${session.id}`);
          
          // Log the email to the database
          const { data: logEntry, error: logError } = await supabase
            .from('email_send_logs')
            .insert({
              recipient_email: recipientEmail,
              subject: emailSubject,
              status: testMode ? 'test_skipped' : 'pending',
              session_id: session.id
            })
            .select()
            .single();
            
          if (logError) {
            console.error('Error logging email:', logError);
          }
          
          // If in test mode, don't actually send the email
          if (testMode) {
            console.log('TEST MODE: Email would be sent with the following details:');
            console.log(`- To: ${recipientEmail}`);
            console.log(`- Subject: ${emailSubject}`);
            console.log('- Content: [HTML email content]');
            
            // Update log status
            if (logEntry) {
              await supabase
                .from('email_send_logs')
                .update({ status: 'test_skipped' })
                .eq('id', logEntry.id);
            }
            
            continue;
          }

          // Send the actual email
          const message = {
            from: smtpSender,
            to: recipientEmail,
            subject: emailSubject,
            attachment: [
              { data: emailHtml, alternative: true }
            ]
          };

          // Send email
          await new Promise<void>((resolve, reject) => {
            client.send(message, (err, result) => {
              if (err) {
                console.error(`Error sending email to ${recipientEmail}:`, err);
                
                // Update log status to failed
                if (logEntry) {
                  supabase
                    .from('email_send_logs')
                    .update({ 
                      status: 'failed',
                      error_message: err.message || JSON.stringify(err)
                    })
                    .eq('id', logEntry.id)
                    .then(() => {
                      console.log('Email log updated with failure status');
                    })
                    .catch(logUpdateError => {
                      console.error('Error updating email log:', logUpdateError);
                    });
                }
                
                reject(err);
              } else {
                console.log(`Email sent successfully to ${recipientEmail}`);
                
                // Update log status to success
                if (logEntry) {
                  supabase
                    .from('email_send_logs')
                    .update({ status: 'success' })
                    .eq('id', logEntry.id)
                    .then(() => {
                      console.log('Email log updated with success status');
                    })
                    .catch(logUpdateError => {
                      console.error('Error updating email log:', logUpdateError);
                    });
                }
                
                resolve();
              }
            });
          });

          results.push({
            session_id: session.id,
            user_id: userId,
            email: parent.email,
            success: true
          });
        } catch (emailError: any) {
          console.error(`Error sending email to ${parent.email}:`, emailError);
          
          results.push({
            session_id: session.id,
            user_id: userId,
            email: parent.email,
            success: false,
            error: emailError.message || 'Unknown error'
          });
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        test_mode: testMode,
        sessions_processed: sessions.length,
        results
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error: any) {
    console.error('Error in send-pre-session-info function:', error);
    console.error('Error stack:', error.stack);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});