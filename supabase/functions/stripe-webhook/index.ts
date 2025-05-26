import { createClient } from 'npm:@supabase/supabase-js@2.39.7';
import Stripe from 'npm:stripe@17.7.0';

const stripe = Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

Deno.serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    // Get the signature from the header
    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      return new Response(JSON.stringify({ error: 'No signature found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Récupérer le corps BRUT en bytes
    const bodyUint8 = new Uint8Array(await req.arrayBuffer());

    // Vérifier async
    const event = await stripe.webhooks.constructEventAsync(
      bodyUint8,
      signature,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!
    );

    // Process the event
    console.log(`Processing webhook event: ${event.type}`);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      
      // Check if this is a payment for registrations
      if (session.metadata?.registration_ids) {
        const registrationIds = session.metadata.registration_ids.split(',');
        
        // Update registrations to paid status
        const { error } = await supabase
          .from('registrations')
          .update({
            payment_status: 'paid',
            payment_intent_id: session.payment_intent
          })
          .in('id', registrationIds);
        
        if (error) {
          console.error('Error updating registrations:', error);
          throw error;
        }
        
        console.log(`Updated ${registrationIds.length} registrations to paid status`);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});