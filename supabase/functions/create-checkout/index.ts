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

interface CheckoutRequest {
  items: CartItem[];
  payLater: boolean;
  successUrl: string;
  cancelUrl: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
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

    const requestData = await req.json() as CheckoutRequest;
    const { items, payLater, successUrl, cancelUrl } = requestData;

    if (!items?.length) {
      throw new Error('Le panier est vide');
    }

    if (!successUrl || !cancelUrl) {
      throw new Error('URLs de redirection manquantes');
    }

    // This function is for immediate payments only
    if (payLater === true) {
      throw new Error('Cette fonction est uniquement pour les paiements immédiats. Utilisez create-invoice pour les paiements différés.');
    }

    // Validate items
    for (const item of items) {
      if (!item.price || item.price <= 0) {
        throw new Error(`Prix invalide pour l'article: ${item.activityName}`);
      }
      if (!item.kid_id) {
        throw new Error(`ID enfant manquant pour l'article: ${item.activityName}`);
      }
      if (!item.activity_id) {
        throw new Error(`ID activité manquant pour l'article: ${item.activityName}`);
      }
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

    try {
      // Create line items for Stripe checkout with metadata
      const lineItems = await Promise.all(items.map(async (item) => {
        // Create a product with metadata
        const product = await stripe.products.create({
          name: `${item.activityName} (${item.kidName})`,
          description: item.dateRange,
          images: item.imageUrl ? [item.imageUrl] : undefined,
          metadata: {
            kid_id: item.kid_id,
            activity_id: item.activity_id,
            user_id: user.id,
            price_type: item.price_type,
            reduced_declaration: item.reduced_declaration.toString()
          }
        });

        // Create price with metadata
        const price = await stripe.prices.create({
          product: product.id,
          currency: 'eur',
          unit_amount: Math.round(item.price), // Price should be in cents
          metadata: {
            kid_id: item.kid_id,
            activity_id: item.activity_id,
            user_id: user.id,
            price_type: item.price_type,
            reduced_declaration: item.reduced_declaration.toString()
          }
        });

        return {
          price: price.id,
          quantity: 1
        };
      }));

      // Create checkout session with metadata
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: lineItems,
        mode: 'payment',
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          user_id: user.id,
          cart_items: JSON.stringify(items.map(item => ({
            kid_id: item.kid_id,
            activity_id: item.activity_id,
            price_type: item.price_type,
            reduced_declaration: item.reduced_declaration,
            price: item.price / 100 // Convert back to euros for our database
          })))
        }
      });

      // Create pending registrations with checkout_session_id
      for (const item of items) {
        const { error: regError } = await supabase
          .from('registrations')
          .insert({
            user_id: user.id,
            kid_id: item.kid_id,
            activity_id: item.activity_id,
            price_type: item.price_type,
            reduced_declaration: item.reduced_declaration,
            amount_paid: item.price / 100, // Convert from cents to euros
            payment_status: 'pending',
            checkout_session_id: session.id // ✅ New tracking key
          });

        if (regError) {
          throw new Error('Error creating registration: ' + regError.message);
        }
      }

      return new Response(
        JSON.stringify({ url: session.url }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (stripeError: any) {
      console.error('Stripe error details:', stripeError);
      throw new Error('Erreur lors de la création de la session de paiement: ' + stripeError.message);
    }
  } catch (error) {
    console.error('Error creating checkout session:', error);
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