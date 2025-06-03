import { createClient } from 'npm:@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface CartItem {
  id: string;
  activity_id: string;
  kid_id: string;
  kidName: string;
  activityName: string;
  activityCategory: string;
  dateRange: string;
  price_type: 'normal' | 'reduced' | 'local' | 'local_reduced';
  reduced_declaration: boolean;
  price: number;
  imageUrl?: string;
}

// Helper function to generate a unique invoice number with format CDV-TAG-YY00001
async function generateInvoiceNumber(supabase: any, centerTag: string): Promise<string> {
  const today = new Date();
  const currentYear = today.getFullYear();
  const yearSuffix = currentYear.toString().slice(-2); // Get last two digits of the year

  // Call the database function to get the next sequence number
  // Note: We still pass the tag parameter for the function signature,
  // but the function now only uses the year for sequencing
  const { data, error } = await supabase.rpc('get_next_invoice_sequence', {
    p_tag: centerTag,
    p_year: currentYear
  });

  if (error) {
    console.error('Error getting next invoice sequence:', error);
    // Fallback to a timestamp-based number if the RPC fails
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `CDV-${centerTag}-${yearSuffix}${random}`; // Fallback format
  }

  // Format the sequence number with leading zeros
  const sequenceNumber = data.toString().padStart(5, '0');

  return `CDV-${centerTag}-${yearSuffix}${sequenceNumber}`;
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
    console.log('Starting create-invoice function');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Configuration Supabase manquante. Veuillez contacter le support.');
    }

    // Use service role key to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const requestData = await req.json().catch(() => null);
    if (!requestData || !requestData.items) {
      throw new Error('Données de requête invalides. Le panier est requis.');
    }

    const { items } = requestData;

    if (!Array.isArray(items) || items.length === 0) {
      throw new Error('Le panier est vide. Veuillez ajouter des articles avant de continuer.');
    }

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('En-tête d\'autorisation manquant. Veuillez vous reconnecter.');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError) {
      throw new Error(`Erreur d'authentification: ${authError.message}`);
    }

    if (!user) {
      throw new Error('Utilisateur non authentifié. Veuillez vous reconnecter.');
    }

    console.log('User authenticated:', user.id);

    // Get the tag from the first item's activity's center
    const firstItem = items[0];
    if (!firstItem || !firstItem.activity_id) {
      throw new Error('Informations sur l\'activité manquantes pour générer le numéro de facture.');
    }

    const { data: sessionData, error: sessionError } = await supabase
      .from('sessions')
      .select('center:centers!center_id(tag)')
      .eq('id', firstItem.activity_id)
      .single();

    if (sessionError || !sessionData?.center?.tag) {
      console.error('Error fetching center tag:', sessionError);
      throw new Error('Impossible de récupérer le tag du centre pour la facturation.');
    }
    
    const centerTag = sessionData.center.tag;
    console.log('Center tag for invoice:', centerTag);

    // Generate invoice number with format CDV-TAG-YY00001
    const invoiceNumber = await generateInvoiceNumber(supabase, centerTag);
    
    // Use the invoice number as the communication
    const communication = invoiceNumber;
    
    // Calculate due date (20 days from now)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 20);

    // Calculate total amount based on cart items (prices are sent in cents)
    const totalAmount = items.reduce(
      (sum: number, item: CartItem) => sum + item.price / 100,
      0
    );

    console.log('Invoice details:', { invoiceNumber, totalAmount, dueDate: dueDate.toISOString() });

    // Array to collect registration IDs
    const registrationIds: string[] = [];

    // Create registrations with pending status
    for (const item of items) {
      // Convert price to proper format (should be in euros, not cents)
      const priceInEuros = item.price / 100;
      
      const { data, error: regError } = await supabase
        .from('registrations')
        .insert({
          user_id: user.id,
          kid_id: item.kid_id,
          activity_id: item.activity_id,
          price_type: item.price_type,
          reduced_declaration: item.reduced_declaration,
          amount_paid: priceInEuros,
          payment_status: 'pending',
          due_date: dueDate.toISOString(),
          reminder_sent: false
        })
        .select('id');

      if (regError) {
        throw new Error(`Erreur lors de la création de l'inscription: ${regError.message}`);
      }

      if (!data || data.length === 0) {
        throw new Error('Erreur lors de la création de l\'inscription: aucun ID retourné');
      }

      registrationIds.push(data[0].id);
    }

    console.log('Created registrations:', registrationIds);

    // Create invoice record
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        user_id: user.id,
        invoice_number: invoiceNumber,
        amount: totalAmount,
        status: 'pending',
        due_date: dueDate.toISOString(),
        communication: communication,
        registration_ids: registrationIds
      })
      .select()
      .single();

    if (invoiceError) {
      throw new Error(`Erreur lors de la création de la facture: ${invoiceError.message}`);
    }

    if (!invoice) {
      throw new Error('Erreur lors de la création de la facture: aucune facture créée');
    }

    console.log('Invoice created:', invoice.invoice_number);

    // Update registrations with invoice_id
    const { error: updateError } = await supabase
      .from('registrations')
      .update({
        invoice_id: invoice.invoice_number
      })
      .in('id', registrationIds);

    if (updateError) {
      console.error('Erreur lors de la mise à jour des inscriptions avec l\'ID de facture:', updateError);
      // Continue anyway, as this is not critical
    } else {
      console.log('Registrations updated with invoice ID');
    }
    
    // Generate PDF and send it by email
    let pdfUrl: string | null = null;
    try {
      console.log('Calling send-invoice-email function');
      const emailRes = await fetch(`${supabaseUrl}/functions/v1/send-invoice-email`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': authHeader // Pass the authorization token
        },
        body: JSON.stringify({
          invoice_number: invoice.invoice_number,
          parent_email: user.email
        })
      });

      console.log('Email function response status:', emailRes.status);
      
      let emailData;
      try {
        emailData = await emailRes.json();
        console.log('Email function response:', JSON.stringify(emailData));
      } catch (jsonError) {
        console.error('Error parsing email response JSON:', jsonError);
        throw new Error('Invalid response from email service');
      }

      if (emailRes.ok) {
        pdfUrl = emailData.pdf_url as string;
        console.log('Email sent successfully with PDF URL:', pdfUrl);
      } else {
        console.error('Erreur lors de l\'envoi de la facture:', emailData.error);
      }
    } catch (err) {
      console.error('Erreur lors de l\'appel à send-invoice-email:', err);
      if (err instanceof Error) {
        console.error('Error details:', err.message);
        console.error('Error stack:', err.stack);
      }
    }

    return new Response(
      JSON.stringify({
        url: '/invoice-confirmation',
        paymentType: 'invoice',
        invoiceUrl: pdfUrl,
        invoiceNumber: invoice.invoice_number,
        registrationIds: registrationIds
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error creating invoice:', error);
    
    // Ensure we always return a string message
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Une erreur inattendue est survenue lors de la création de la facture';

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});