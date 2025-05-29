import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: 'sb-kids-camp-auth',
    storage: localStorage
  },
  global: {
    headers: {
      'X-Client-Info': 'kids-activities-registration'
    }
  },
  db: {
    schema: 'public'
  },
  queries: {
    retryEnabled: true,
    retryInterval: 1000,
    retryLimit: 3
  }
});

// Listen for auth state changes
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
    // Clear any stored auth data
    localStorage.removeItem('sb-kids-camp-auth');
    
    // If not already on the login page, redirect with session expired message
    if (window.location.pathname !== '/login') {
      window.location.href = '/login?message=session_expired';
    }
  }
  
  // Handle password recovery
  if (event === 'PASSWORD_RECOVERY') {
    // Check if we're already on the reset-password page
    if (!window.location.pathname.startsWith('/reset-password')) {
      // Only redirect if we're not already on the reset-password page
      // This preserves the hash parameters in the URL which contain the recovery token
      window.location.href = '/reset-password?recovery=true';
    }
    // If we're already on the reset-password page, do nothing
    // This allows the ResetPasswordPage component to handle the recovery flow
  }
});