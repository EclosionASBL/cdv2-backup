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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const requestData = await req.json() as CheckoutRequest;
    const { items, payLater, successUrl, cancelUrl } = requestData;

    if (!items?.length) {
      throw new Error('Le panier est vide');
    }

    if (!successUrl || !cancelUrl) {
      throw new Error('URLs de redirection manquantes');
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

    // Check for existing registrations to avoid duplicates
    const existingRegistrations = [];
    for (const item of items) {
      const { data: existing } = await supabase
        .from('registrations')
        .select('id, payment_status')
        .eq('user_id', user.id)
        .eq('kid_id', item.kid_id)
        .eq('activity_id', item.activity_id)
        .maybeSingle();
      
      if (existing) {
        existingRegistrations.push({
          item,
          registration: existing
        });
      }
    }

    // Filter out items that already have registrations
    const newItems = items.filter(item => {
      return !existingRegistrations.some(
        er => er.item.kid_id === item.kid_id && er.item.activity_id === item.activity_id
      );
    });

    // Create registrations for new items only
    const registrations = [];
    const registrationIds = [];
    const kidIds = [];
    const sessionIds = [];
    const priceTypes = [];
    const reducedDeclarations = [];

    // Fetch session data for all activities at once
    const activityIds = items.map(item => item.activity_id);
    const { data: sessionRows, error: sessErr } = await supabase
      .from('sessions')
      .select('id, center_id, periode, semaine')
      .in('id', activityIds);

    if (sessErr) throw sessErr;

    // Create a map for quick lookup
    const sessionMap = new Map(
      (sessionRows || []).map(s => [s.id, s])
    );

    if (newItems.length > 0) {
      const newRegistrations = newItems.map(item => {
        return {
          user_id: user.id,
          kid_id: item.kid_id,
          activity_id: item.activity_id,
          price_type: item.price_type,
          reduced_declaration: item.reduced_declaration,
          amount_paid: item.price / 100, // Convert from cents to euros for DB
          payment_status: 'pending'
        };
      });

      const { data: regs, error: regError } = await supabase
        .from('registrations')
        .insert(newRegistrations)
        .select();

      if (regError) {
        throw new Error('Erreur lors de la création des inscriptions: ' + regError.message);
      }

      if (regs) {
        registrations.push(...regs);
        registrationIds.push(...regs.map(r => r.id));
        
        // Collect metadata from items
        newItems.forEach(item => {
          kidIds.push(item.kid_id);
          sessionIds.push(item.activity_id);
          priceTypes.push(item.price_type);
          reducedDeclarations.push(item.reduced_declaration.toString());
        });
      }
    }

    // Add existing registrations to the list
    for (const er of existingRegistrations) {
      registrations.push(er.registration);
      registrationIds.push(er.registration.id);
      kidIds.push(er.item.kid_id);
      sessionIds.push(er.item.activity_id);
      priceTypes.push(er.item.price_type);
      reducedDeclarations.push(er.item.reduced_declaration.toString());
    }

    // If no registrations (new or existing), return an error
    if (registrations.length === 0) {
      throw new Error('Aucune inscription n\'a pu être créée.');
    }

    if (payLater) {
      try {
        // Create invoice
        const invoice = await stripe.invoices.create({
          customer: customerId,
          collection_method: 'send_invoice',
          days_until_due: 20,
          auto_advance: true,
          description: 'Stages Éclosion ASBL',
          metadata: {
            user_id: user.id,
            registration_ids: registrationIds.join(','),
            kid_ids: kidIds.join(','),
            session_ids: sessionIds.join(','),
            price_types: priceTypes.join(','),
            reduced_declarations: reducedDeclarations.join(',')
          }
        });

        // Add line items
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const reg = registrations[i];
          
          // Create a product first
          const product = await stripe.products.create({
            name: `${item.activityName} (${item.kidName})`,
            description: item.dateRange,
            metadata: {
              registration_id: reg?.id,
              kid_id: item.kid_id,
              session_id: item.activity_id,
              user_id: user.id,
              price_type: item.price_type,
              reduced_declaration: item.reduced_declaration.toString()
            }
          });

          // Then create the invoice item with the product
          await stripe.invoiceItems.create({
            customer: customerId,
            invoice: invoice.id,
            price_data: {
              currency: 'eur',
              unit_amount: Math.round(item.price),
              product: product.id
            }
          });

          // Update registration with invoice ID
          if (reg) {
            await supabase
              .from('registrations')
              .update({ invoice_id: invoice.id })
              .eq('id', reg.id);
          }
        }

        // Finalize and send the invoice
        await stripe.invoices.finalizeInvoice(invoice.id);
        await stripe.invoices.sendInvoice(invoice.id);

        return new Response(
          JSON.stringify({ url: invoice.hosted_invoice_url }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (stripeError: any) {
        throw new Error('Erreur lors de la création de la facture: ' + stripeError.message);
      }
    } else {
      try {
        // Create line items for Stripe checkout
        const lineItems = items.map((item, index) => {
          const reg = registrations[index];
          
          return {
            quantity: 1,
            price_data: {
              currency: 'eur',
              unit_amount: Math.round(item.price),
              product_data: {
                name: `${item.activityName} (${item.kidName})`,
                description: item.dateRange,
                images: item.imageUrl ? [item.imageUrl] : undefined,
                metadata: {
                  registration_id: reg?.id,
                  kid_id: item.kid_id,
                  session_id: item.activity_id,
                  user_id: user.id,
                  price_type: item.price_type,
                  reduced_declaration: item.reduced_declaration.toString()
                }
              }
            }
          };
        });

        // Create checkout session
        const session = await stripe.checkout.sessions.create({
          customer: customerId,
          payment_method_types: ['card'],
          line_items: lineItems,
          mode: 'payment',
          success_url: successUrl,
          cancel_url: cancelUrl,
          payment_intent_data: {
            metadata: {
              registration_ids: registrationIds.join(','),
              kid_ids: kidIds.join(','),
              user_id: user.id,
              session_ids: sessionIds.join(','),
              price_types: priceTypes.join(','),
              reduced_declarations: reducedDeclarations.join(',')
            }
          },
          metadata: {
            user_id: user.id,
            registration_ids: registrationIds.join(',')
          }
        });

        // Update registrations with payment_intent_id
        if (registrationIds.length > 0 && session.payment_intent) {
          await supabase
            .from('registrations')
            .update({ payment_intent_id: session.payment_intent.toString() })
            .in('id', registrationIds);
        }

        return new Response(
          JSON.stringify({ url: session.url }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (stripeError: any) {
        console.error('Stripe error details:', stripeError);
        throw new Error('Erreur lors de la création de la session de paiement: ' + stripeError.message);
      }
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