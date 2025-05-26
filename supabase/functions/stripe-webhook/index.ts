import { createClient } from 'npm:@supabase/supabase-js@2.39.7';
import Stripe from 'npm:stripe@17.7.0';

const stripe = Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')! // Using service role key to bypass RLS
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

    // Get raw body bytes
    const bodyUint8 = new Uint8Array(await req.arrayBuffer());

    // Verify webhook signature
    const event = await stripe.webhooks.constructEventAsync(
      bodyUint8,
      signature,
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!
    );

    console.log(`Processing webhook event: ${event.type}`);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;

      // Only handle immediate payments (not subscriptions or invoices)
      if (session.mode === 'payment' && session.payment_status === 'paid') {
        // Extract metadata from the session
        const metadata = session.metadata;
        const cartItems = JSON.parse(metadata.cart_items || '[]');
        const userId = metadata.user_id;

        // Process each cart item
        for (const item of cartItems) {
          // Create or update registration
          const { error: regError } = await supabase
            .from('registrations')
            .update({
              payment_status: 'paid'
            })
            .eq('payment_intent_id', session.payment_intent)
            .eq('user_id', userId)
            .eq('kid_id', item.kid_id)
            .eq('activity_id', item.activity_id);

          if (regError) {
            console.error('Error updating registration:', regError);
            throw regError;
          }
        }

        console.log(`Updated registrations for session ${session.id} to paid status`);
      }
    } else if (event.type === 'invoice.paid') {
      const invoice = event.data.object;
      
      // Update registrations to paid status
      const { error: updateError } = await supabase
        .from('registrations')
        .update({
          payment_status: 'paid',
          // Clear due date and reminder flag since it's now paid
          due_date: null,
          reminder_sent: false
        })
        .eq('invoice_id', invoice.id);

      if (updateError) {
        console.error('Error updating registrations:', updateError);
        throw updateError;
      }

      console.log(`Updated registrations for invoice ${invoice.id} to paid status`);
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