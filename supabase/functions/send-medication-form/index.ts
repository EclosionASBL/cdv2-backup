import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { Resend } from "npm:resend@2.1.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { kidId, parentEmail, kidName } = await req.json();

    if (!kidId || !parentEmail || !kidName) {
      throw new Error("Missing required parameters");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Initialize Resend
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

    // Get the PDF URL from storage
    const { data: { publicUrl } } = supabase.storage
      .from('public')
      .getPublicUrl('medication_authorisation.pdf');

    // Send email
    await resend.emails.send({
      from: "no-reply@eclosion.be",
      to: parentEmail,
      subject: "Formulaire d'autorisation de médication",
      html: `
        Bonjour,<br/><br/>
        
        Vous avez indiqué que ${kidName} nécessite une médication pendant le stage.<br/>
        Veuillez télécharger le formulaire ci-joint (ou cliquer sur le lien) et remettre une copie signée à notre équipe le premier jour.<br/><br/>
        
        <a href="${publicUrl}">Télécharger le formulaire</a><br/><br/>
        
        Merci !<br/>
        L'équipe Éclosion
      `,
      attachments: [
        {
          filename: "formulaire_medication.pdf",
          path: publicUrl
        }
      ]
    });

    // Update medication_form_sent status
    const { error: updateError } = await supabase
      .from('kid_health')
      .update({ medication_form_sent: true })
      .eq('kid_id', kidId);

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
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