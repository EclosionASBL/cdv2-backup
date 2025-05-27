import { createClient } from 'npm:@supabase/supabase-js@2.39.7';
import Stripe from 'npm:stripe@17.7.0';

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
    const stripeSecretKey = Deno.env.get('STRIPE_SECRET_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!stripeSecretKey) {
      throw new Error('Configuration Stripe manquante');
    }

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Configuration Supabase manquante');
    }

    const stripe = Stripe(stripeSecretKey);
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

    // Get or create customer
    let customerId: string;
    const { data: existingCustomer, error: customerError } = await supabase
      .from('stripe_customers')
      .select('customer_id')
      .eq('user_id', user.id)
      .single();

    if (customerError && customerError.code !== 'PGRST116') {
      throw new Error('Erreur lors de la récupération du client: ' + customerError.message);
    }

    if (existingCustomer?.customer_id) {
      customerId = existingCustomer.customer_id;
    } else {
      // Create a new customer in Stripe
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('prenom, nom, email, telephone, adresse, cpostal, localite')
        .eq('id', user.id)
        .single();

      if (userError) {
        throw new Error('Erreur lors de la récupération des données utilisateur: ' + userError.message);
      }

      try {
        const customer = await stripe.customers.create({
          email: user.email,
          name: userData ? `${userData.prenom} ${userData.nom}` : undefined,
          phone: userData?.telephone,
          address: userData ? {
            line1: userData.adresse,
            postal_code: userData.cpostal,
            city: userData.localite,
            country: 'BE',
          } : undefined,
          metadata: {
            user_id: user.id
          }
        });

        // Save the customer ID in our database
        const { error: insertError } = await supabase
          .from('stripe_customers')
          .insert({
            user_id: user.id,
            customer_id: customer.id
          });

        if (insertError) {
          throw new Error('Erreur lors de la sauvegarde du client: ' + insertError.message);
        }

        customerId = customer.id;
      } catch (stripeError: any) {
        throw new Error('Erreur lors de la création du client Stripe: ' + stripeError.message);
      }
    }

    // Calculate due date (20 days from now)
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 20);

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
          amount_paid: item.price / 100, // Convert from cents to euros
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

    // Create invoice with minimal metadata
    const invoice = await stripe.invoices.create({
      customer: customerId,
      collection_method: 'send_invoice',
      days_until_due: 20,
      auto_advance: true,
      description: 'Stages Éclosion ASBL',
      metadata: {
        user_id: user.id,
        registration_ids: registrationIds.join(',')
      }
    });

    // Add line items to invoice
    for (const item of items) {
      // Create a product with minimal metadata
      const product = await stripe.products.create({
        name: `${item.activityName} (${item.kidName})`,
        description: item.dateRange
      });

      // Create price with minimal metadata
      const price = await stripe.prices.create({
        product: product.id,
        currency: 'eur',
        unit_amount: Math.round(item.price) // Price should be in cents
      });

      // Create invoice item
      await stripe.invoiceItems.create({
        customer: customerId,
        invoice: invoice.id,
        price: price.id
      });
    }

    // Update registrations with invoice_id and invoice_url
    const { error: updateError } = await supabase
      .from('registrations')
      .update({
        invoice_id: invoice.id,
        invoice_url: invoice.hosted_invoice_url
      })
      .in('id', registrationIds);

    if (updateError) {
      console.error('Error updating registrations with invoice_id:', updateError);
      // Continue anyway, as this is not critical
    }

    // Finalize and send the invoice
    await stripe.invoices.finalizeInvoice(invoice.id);
    await stripe.invoices.sendInvoice(invoice.id);

    // Return the same format as create-checkout for consistency
    return new Response(
      JSON.stringify({ 
        url: '/order-confirmation',
        paymentType: 'invoice',
        invoiceUrl: invoice.hosted_invoice_url
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