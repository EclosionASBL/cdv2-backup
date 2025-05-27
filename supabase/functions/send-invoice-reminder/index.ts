import { createClient } from 'npm:@supabase/supabase-js@2.39.7';
import { Resend } from 'npm:resend@2.1.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface SendReminderRequest {
  invoice_id: string;
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
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "En-tête d'autorisation manquant" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Utilisateur non authentifié" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if user is admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userError) {
      return new Response(
        JSON.stringify({ error: "Erreur lors de la vérification des droits d'accès" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (userData.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: "Vous n'avez pas les droits nécessaires pour effectuer cette action" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get request data
    const { invoice_id } = await req.json() as SendReminderRequest;

    if (!invoice_id) {
      return new Response(
        JSON.stringify({ error: "ID de facture manquant" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get invoice data with user information
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        *,
        user:user_id(
          email,
          prenom,
          nom
        )
      `)
      .eq('id', invoice_id)
      .single();

    if (invoiceError) {
      return new Response(
        JSON.stringify({ error: "Facture non trouvée" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (invoice.status !== 'pending') {
      return new Response(
        JSON.stringify({ message: "Cette facture n'est pas en attente de paiement" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check if Resend API key is available
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Service d'email non configuré" 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Initialize Resend
    const resend = new Resend(resendApiKey);

    // Format dates
    const dueDate = new Date(invoice.due_date).toLocaleDateString('fr-FR');
    const createdDate = new Date(invoice.created_at).toLocaleDateString('fr-FR');

    // Send email
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: "no-reply@eclosion.be",
      to: invoice.user.email,
      subject: "Rappel de paiement - Facture " + invoice.invoice_number,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #4f46e5;">Rappel de paiement</h1>
          
          <p>Bonjour ${invoice.user.prenom},</p>
          
          <p>Nous vous rappelons que votre facture <strong>${invoice.invoice_number}</strong> d'un montant de <strong>${invoice.amount} €</strong> émise le ${createdDate} est toujours en attente de paiement.</p>
          
          <p>La date d'échéance est fixée au <strong>${dueDate}</strong>.</p>
          
          <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <h2 style="margin-top: 0; color: #1f2937;">Informations de paiement</h2>
            <p><strong>Montant :</strong> ${invoice.amount} €</p>
            <p><strong>Communication structurée :</strong> ${invoice.communication}</p>
            <p><strong>IBAN :</strong> BE12 3456 7890 1234</p>
            <p><strong>Bénéficiaire :</strong> Éclosion ASBL</p>
          </div>
          
          <p>Merci de bien vouloir effectuer le paiement dans les plus brefs délais.</p>
          
          <p style="margin-top: 32px;">Cordialement,<br>L'équipe Éclosion ASBL</p>
        </div>
      `,
    });

    if (emailError) {
      console.error("Error sending email:", emailError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Erreur lors de l'envoi de l'email de rappel" 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Update registrations to mark reminder as sent
    if (invoice.registration_ids && invoice.registration_ids.length > 0) {
      const { error: updateError } = await supabase
        .from('registrations')
        .update({ reminder_sent: true })
        .in('id', invoice.registration_ids);

      if (updateError) {
        console.error("Error updating registrations:", updateError);
        // Continue anyway as the email was sent
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Rappel envoyé avec succès",
        email: emailData
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error sending invoice reminder:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Une erreur inattendue est survenue" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});