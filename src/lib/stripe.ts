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

export const createCheckoutSession = async (items: any[], payLater: boolean = false) => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      throw new Error('No active session');
    }
    
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        items,
        payLater,
        successUrl: `${window.location.origin}/order-confirmation`,
        cancelUrl: `${window.location.origin}/cart`,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to create checkout session');
    }

    const { url, error } = await response.json();

    if (error) throw new Error(error);
    if (!url) throw new Error('No checkout URL returned');

    // Redirect to Stripe Checkout
    window.location.href = url;
    
    return { success: true };
  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    throw error;
  }
};