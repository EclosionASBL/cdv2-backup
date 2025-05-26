import { loadStripe } from '@stripe/stripe-js';
import { supabase } from './supabase';

// Load the Stripe.js library with our publishable key
let stripePromise: Promise<any> | null = null;

export const getStripe = () => {
  if (!stripePromise) {
    stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
  }
  return stripePromise;
};

export const createCheckoutSession = async (priceId: string, mode: 'payment' | 'subscription') => {
  try {
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stripe-checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabase.auth.session()?.access_token}`,
      },
      body: JSON.stringify({
        price_id: priceId,
        success_url: `${window.location.origin}/order-confirmation`,
        cancel_url: `${window.location.origin}/cart`,
        mode,
      }),
    });

    const { sessionId, url, error } = await response.json();

    if (error) throw new Error(error);

    // Redirect to Stripe Checkout
    if (url) {
      window.location.href = url;
    } else {
      // Fallback if we get sessionId but not direct URL
      const stripe = await getStripe();
      await stripe.redirectToCheckout({ sessionId });
    }
  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    throw error;
  }
};