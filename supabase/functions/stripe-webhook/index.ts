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
      console.log(`Checkout session completed: ${session.id}`);
      console.log(`Payment status: ${session.payment_status}`);
      console.log(`Payment mode: ${session.mode}`);

      // Only handle immediate payments (not subscriptions or invoices)
      if (session.mode === 'payment' && session.payment_status === 'paid') {
        console.log(`Processing paid checkout session: ${session.id}`);
        
        // Get cart data from metadata if available
        const cartData = session.metadata?.cart_data;
        if (cartData) {
          console.log(`Cart data found in metadata: ${cartData}`);
          try {
            const items = JSON.parse(cartData);
            
            // Process each item in the cart
            for (const item of items) {
              console.log(`Processing item: ${JSON.stringify(item)}`);
              
              // Update registration to paid status
              const { error: regError } = await supabase
                .from('registrations')
                .update({
                  payment_status: 'paid',
                  amount_paid: item.price / 100, // Convert from cents to euros
                  payment_intent_id: session.payment_intent
                })
                .eq('kid_id', item.kid_id)
                .eq('activity_id', item.activity_id)
                .eq('user_id', item.user_id);

              if (regError) {
                console.error(`Error updating registration for kid ${item.kid_id}, activity ${item.activity_id}:`, regError);
                throw regError;
              }
              
              console.log(`Updated registration for kid ${item.kid_id}, activity ${item.activity_id} to paid status`);
            }
          } catch (parseError) {
            console.error('Error parsing cart data:', parseError);
            console.error('Raw cart data:', cartData);
          }
        } else {
          console.log('No cart data found in metadata, falling back to line items');
          
          // Retrieve the session with line items
          const expandedSession = await stripe.checkout.sessions.retrieve(
            session.id,
            {
              expand: ['line_items', 'line_items.data.price.product']
            }
          );

          // Process each line item
          for (const item of expandedSession.line_items?.data || []) {
            const product = item.price?.product;
            if (!product || typeof product === 'string') {
              console.log('Product is not expanded or is a string:', product);
              continue;
            }

            // Extract metadata from the product
            const metadata = product.metadata;
            console.log('Product metadata:', metadata);
            
            if (!metadata.kid_id || !metadata.activity_id || !metadata.user_id) {
              console.log('Missing required metadata in product');
              continue;
            }
            
            const amount = item.amount_total / 100; // Convert from cents to euros

            // Update registration to paid status
            const { error: regError } = await supabase
              .from('registrations')
              .update({
                payment_status: 'paid',
                amount_paid: amount
              })
              .eq('payment_intent_id', session.payment_intent)
              .eq('kid_id', metadata.kid_id)
              .eq('activity_id', metadata.activity_id)
              .eq('user_id', metadata.user_id);

            if (regError) {
              console.error('Error updating registration:', regError);
              throw regError;
            }
            
            console.log(`Updated registration for kid ${metadata.kid_id}, activity ${metadata.activity_id} to paid status`);
          }
        }

        console.log(`Updated registrations for session ${session.id} to paid status`);
      }
    } else if (event.type === 'invoice.paid') {
      const invoice = event.data.object;
      console.log(`Invoice paid: ${invoice.id}`);
      
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