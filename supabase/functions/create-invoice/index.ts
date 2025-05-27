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
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Configuration Supabase manquante');
    }

    // Use service role key to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { items } = await req.json();

    if (!items?.length) {
      throw new Error('Le panier est vide');
    }

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('En-tête d\'autorisation manquant');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError) {
      throw new Error('Erreur d\'authentification: ' + authError.message);
    }

    if (!user) {
      throw new Error('Utilisateur non authentifié');
    }

    // Generate invoice number
    const invoiceNumber = generateInvoiceNumber();
    
    // Generate structured communication
    const communication = generateStructuredCommunication();
    
    // Calculate due date (20 days from now)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 20);

    // Calculate total amount
    const totalAmount = items.reduce((sum: number, item: CartItem) => sum + item.price, 0);

    // Array to collect registration IDs
    const registrationIds: string[] = [];

    // Create registrations with pending status
    for (const item of items) {
      const { data, error: regError } = await supabase
        .from('registrations')
        .insert({
          user_id: user.id,
          kid_id: item.kid_id,
          activity_id: item.activity_id,
          price_type: item.price_type,
          reduced_declaration: item.reduced_declaration,
          amount_paid: item.price,
          payment_status: 'pending',
          due_date: dueDate.toISOString(),
          reminder_sent: false
        })
        .select('id');

      if (regError) {
        throw new Error('Error creating registration: ' + regError.message);
      }

      if (data && data.length > 0) {
        registrationIds.push(data[0].id);
      }
    }

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
      throw new Error('Error creating invoice: ' + invoiceError.message);
    }

    // Update registrations with invoice_id
    const { error: updateError } = await supabase
      .from('registrations')
      .update({
        invoice_id: invoice.invoice_number
      })
      .in('id', registrationIds);

    if (updateError) {
      console.error('Error updating registrations with invoice_id:', updateError);
      // Continue anyway, as this is not critical
    }

    // Generate PDF invoice (this would be implemented in a separate function)
    // For now, we'll just return the invoice data
    
    return new Response(
      JSON.stringify({ 
        url: '/invoice-confirmation',
        paymentType: 'invoice',
        invoiceUrl: null // Will be implemented later
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error creating invoice:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Une erreur inattendue est survenue'
      }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// Helper function to generate a unique invoice number
function generateInvoiceNumber(): string {
  const prefix = 'INV';
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}-${timestamp}-${random}`;
}

// Helper function to generate a structured communication code for bank transfers
function generateStructuredCommunication(): string {
  // Generate 10 random digits
  const digits = Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join('');
  
  // Calculate check digit (modulo 97, or 97 if result is 0)
  const base = parseInt(digits, 10);
  let checkDigits = 97 - (base % 97);
  if (checkDigits === 0) checkDigits = 97;
  
  // Format with leading zero for check digits if needed
  const formattedCheckDigits = checkDigits < 10 ? `0${checkDigits}` : `${checkDigits}`;
  
  // Format as +++xxx/xxxx/xxxxx+++
  return `+++${digits.slice(0, 3)}/${digits.slice(3, 7)}/${digits.slice(7, 10)}${formattedCheckDigits}+++`;
}