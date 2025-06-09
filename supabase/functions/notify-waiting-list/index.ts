import { createClient } from 'npm:@supabase/supabase-js@2.39.7';
import { SMTPClient } from 'npm:emailjs@3.2.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

Deno.serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { waitingListId } = await req.json();

    if (!waitingListId) {
      throw new Error("Missing waitingListId parameter");
    }

    // Check SMTP configuration
    const smtpUser = Deno.env.get('SMTP_USER');
    const smtpPassword = Deno.env.get('SMTP_PASSWORD');
    const smtpHost = Deno.env.get('SMTP_HOST') || 'smtp.gmail.com';
    const smtpPort = parseInt(Deno.env.get('SMTP_PORT') || '465');
    const smtpSender = Deno.env.get('SMTP_SENDER') || 'stage-notif@eclosion.be';
    
    // Get the frontend URL from environment variable, with fallback
    const frontendUrl = Deno.env.get('FRONTEND_URL') || 'https://app.eclosion.be';

    if (!smtpUser || !smtpPassword) {
      console.error("SMTP configuration is not set");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Email notification service is not configured. The waiting list status has been updated, but no email was sent." 
        }),
        {
          status: 200, // Still return 200 to not break the flow
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get waiting list entry with related data
    const { data: waitingListEntry, error: waitingListError } = await supabase
      .from('waiting_list')
      .select(`
        *,
        kid:kid_id(prenom, nom),
        parent:users!waiting_list_user_id_fkey(email, prenom, nom, telephone),
        session:activity_id(
          stage:stage_id(title),
          start_date,
          end_date,
          center:center_id(name)
        )
      `)
      .eq('id', waitingListId)
      .single();

    if (waitingListError) {
      console.error("Error fetching waiting list entry:", waitingListError);
      throw new Error("Error fetching waiting list entry: " + waitingListError.message);
    }
    
    if (!waitingListEntry) {
      return new Response(
        JSON.stringify({ error: "Waiting list entry not found" }),
        {
          status: 404,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    // Set notification flag for the user
    if (waitingListEntry.user_id) {
      const { error: notificationError } = await supabase
        .from('users')
        .update({ has_new_registration_notification: true })
        .eq('id', waitingListEntry.user_id);

      if (notificationError) {
        console.error('Error setting notification flag:', notificationError);
        // Continue even if notification update fails
      } else {
        console.log('Notification flag set successfully for user:', waitingListEntry.user_id);
      }
    }

    // Unwrap arrays if needed
    const kid = Array.isArray(waitingListEntry.kid) ? waitingListEntry.kid[0] : waitingListEntry.kid;
    const parent = Array.isArray(waitingListEntry.parent) ? waitingListEntry.parent[0] : waitingListEntry.parent;
    const session = Array.isArray(waitingListEntry.session) ? waitingListEntry.session[0] : waitingListEntry.session;

    // Format dates
    const startDate = new Date(session.start_date).toLocaleDateString('fr-FR');
    const endDate = new Date(session.end_date).toLocaleDateString('fr-FR');
    
    // Calculate expiration time
    const expiresAt = new Date(waitingListEntry.expires_at);
    const expirationDate = expiresAt.toLocaleDateString('fr-FR');
    const expirationTime = expiresAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

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
        to: parent.email,
        subject: "Une place est disponible pour votre enfant",
        attachment: [
          { data: `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h1 style="color: #4f46e5;">Une place est disponible !</h1>
              
              <p>Bonjour ${parent.prenom},</p>
              
              <p>Nous avons le plaisir de vous informer qu'une place est désormais disponible pour <strong>${kid.prenom}</strong> au stage suivant :</p>
              
              <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
                <h2 style="margin-top: 0; color: #1f2937;">${session.stage.title}</h2>
                <p><strong>Dates :</strong> Du ${startDate} au ${endDate}</p>
                <p><strong>Centre :</strong> ${session.center.name}</p>
              </div>
              
              <p><strong>Important :</strong> Cette place vous est réservée jusqu'au ${expirationDate} à ${expirationTime}. Passé ce délai, elle sera proposée à la personne suivante sur la liste d'attente.</p>
              
              <p>Pour confirmer l'inscription, veuillez vous connecter à votre compte et procéder au paiement.</p>
              
              <a href="${frontendUrl}/registrations" style="display: inline-block; background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 16px;">
                Confirmer l'inscription
              </a>
              
              <p style="margin-top: 32px;">Cordialement,<br>L'équipe Éclosion ASBL</p>
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
                error: "Email could not be sent, but waiting list status was updated." 
              }),
              {
                status: 200, // Still return 200 to not break the flow
                headers: {
                  ...corsHeaders,
                  "Content-Type": "application/json",
                },
              }
            ));
          } else {
            console.log('Email sent successfully via SMTP:', result);
            resolve(new Response(
              JSON.stringify({ success: true }),
              {
                status: 200,
                headers: {
                  ...corsHeaders,
                  "Content-Type": "application/json",
                },
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
          error: "Email could not be sent, but waiting list status was updated." 
        }),
        {
          status: 200, // Still return 200 to not break the flow
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }
  } catch (error) {
    console.error("Error sending notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});