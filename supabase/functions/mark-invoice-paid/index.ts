import { createClient } from 'npm:@supabase/supabase-js@2.39.7';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface MarkInvoicePaidRequest {
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
    const { invoice_id } = await req.json() as MarkInvoicePaidRequest;

    if (!invoice_id) {
      return new Response(
        JSON.stringify({ error: "ID de facture manquant" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get invoice data
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('registration_ids, status')
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

    if (invoice.status === 'paid') {
      return new Response(
        JSON.stringify({ message: "Cette facture est déjà marquée comme payée" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Update invoice status
    const now = new Date().toISOString();
    const { error: updateInvoiceError } = await supabase
      .from('invoices')
      .update({
        status: 'paid',
        paid_at: now
      })
      .eq('id', invoice_id);

    if (updateInvoiceError) {
      return new Response(
        JSON.stringify({ error: "Erreur lors de la mise à jour de la facture" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Update registrations
    if (invoice.registration_ids && invoice.registration_ids.length > 0) {
      const { error: updateRegError } = await supabase
        .from('registrations')
        .update({
          payment_status: 'paid',
          due_date: null,
          reminder_sent: false
        })
        .in('id', invoice.registration_ids);

      if (updateRegError) {
        return new Response(
          JSON.stringify({ error: "Erreur lors de la mise à jour des inscriptions" }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Facture marquée comme payée avec succès",
        invoice_id: invoice_id
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error marking invoice as paid:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Une erreur inattendue est survenue" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});