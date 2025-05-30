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

    // Generate invoice number with new format CDV-YYMMDD-00001
    const invoiceNumber = await generateInvoiceNumber(supabase);
    
    // Get kid information for the first item to generate structured communication
    const firstItem = items[0];
    if (!firstItem || !firstItem.kid_id) {
      throw new Error('Informations sur l\'enfant manquantes pour générer la communication structurée.');
    }
    
    // Generate structured communication based on kid's birth date and invoice number
    const communication = await generateStructuredCommunication(supabase, firstItem.kid_id, invoiceNumber);
    
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

// Helper function to generate a unique invoice number with format CDV-YYMMDD-00001
async function generateInvoiceNumber(supabase: any): Promise<string> {
  const today = new Date();
  const dateFormat = `${today.getFullYear().toString().slice(-2)}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}`;
  
  // Call the database function to get the next sequence number
  const { data, error } = await supabase.rpc('get_next_invoice_sequence', {
    p_date: today.toISOString().split('T')[0]
  });
  
  if (error) {
    console.error('Error getting next invoice sequence:', error);
    throw new Error('Failed to generate invoice number');
  }
  
  // Format the sequence number with leading zeros
  const sequenceNumber = data.toString().padStart(5, '0');
  
  return `CDV-${dateFormat}-${sequenceNumber}`;
}

// Helper function to generate a structured communication code based on kid's birth date and invoice number
async function generateStructuredCommunication(supabase: any, kidId: string, invoiceNumber: string): Promise<string> {
  // Get kid's birth date
  const { data: kid, error: kidError } = await supabase
    .from('kids')
    .select('date_naissance')
    .eq('id', kidId)
    .single();
  
  if (kidError || !kid) {
    console.error('Error fetching kid data:', kidError);
    throw new Error('Failed to fetch kid data for structured communication');
  }
  
  // Extract year, month, and day from birth date
  const birthDate = new Date(kid.date_naissance);
  const birthYear = birthDate.getFullYear().toString().slice(-2);
  const birthMonth = (birthDate.getMonth() + 1).toString().padStart(2, '0');
  const birthDay = birthDate.getDate().toString().padStart(2, '0');
  
  // Extract invoice sequence from invoice number (last 5 digits)
  const invoiceSequence = invoiceNumber.split('-')[2];
  
  // Format as +++0YY-MMDD-IIIII+++
  const structuredComm = `+++0${birthYear}-${birthMonth}${birthDay}-${invoiceSequence}+++`;
  
  return structuredComm;
}