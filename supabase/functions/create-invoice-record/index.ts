import { createClient } from 'npm:@supabase/supabase-js@2.39.7';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
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

interface CreateInvoiceRequest {
  items: CartItem[];
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
    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the request data
    const { items } = await req.json() as CreateInvoiceRequest;

    if (!items || items.length === 0) {
      return new Response(
        JSON.stringify({ error: "Le panier est vide" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

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

    // Generate invoice number (format: INV-YYYYMMDD-XXXX)
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    const randomPart = Math.floor(1000 + Math.random() * 9000); // 4-digit random number
    const invoiceNumber = `INV-${dateStr}-${randomPart}`;

    // Generate structured communication (format: +++123/4567/89012+++)
    const generateStructuredCommunication = (): string => {
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
    };

    const communication = generateStructuredCommunication();

    // Calculate due date (20 days from now)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 20);

    // Calculate total amount
    const totalAmount = items.reduce((sum, item) => sum + (item.price / 100), 0);

    // Create registrations in Supabase
    const registrationIds: string[] = [];
    
    for (const item of items) {
      const { data: registration, error: regError } = await supabase
        .from('registrations')
        .insert({
          user_id: user.id,
          kid_id: item.kid_id,
          activity_id: item.activity_id,
          payment_status: 'pending',
          amount_paid: item.price / 100, // Convert from cents to euros
          price_type: item.price_type,
          reduced_declaration: item.reduced_declaration,
          due_date: dueDate.toISOString()
        })
        .select('id')
        .single();

      if (regError) {
        console.error('Error creating registration:', regError);
        throw new Error(`Erreur lors de la création de l'inscription: ${regError.message}`);
      }

      registrationIds.push(registration.id);
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
      console.error('Error creating invoice:', invoiceError);
      throw new Error(`Erreur lors de la création de la facture: ${invoiceError.message}`);
    }

    // Update registrations with invoice_id
    const { error: updateError } = await supabase
      .from('registrations')
      .update({ invoice_id: invoice.id })
      .in('id', registrationIds);

    if (updateError) {
      console.error('Error updating registrations with invoice_id:', updateError);
      // Continue anyway, as this is not critical
    }

    // TODO: Generate PDF and store in Supabase Storage
    // This would be implemented in a future version

    return new Response(
      JSON.stringify({
        success: true,
        invoiceId: invoice.id,
        invoiceNumber: invoiceNumber,
        amount: totalAmount,
        communication: communication,
        dueDate: dueDate.toISOString()
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error('Error creating invoice record:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Une erreur inattendue est survenue'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});