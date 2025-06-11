import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
};

interface UnsubscribeRequest {
  email: string;
  token?: string; // Optional security token for public unsubscribe links
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
    // Parse request body
    const { email, token } = await req.json() as UnsubscribeRequest;

    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if the user is authenticated
    let isAuthorized = false;
    const authHeader = req.headers.get('Authorization');
    
    if (authHeader) {
      const authToken = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(authToken);
      
      if (!authError && user) {
        // User is authenticated, check if they're trying to unsubscribe their own email
        const { data: userData } = await supabase
          .from('users')
          .select('email')
          .eq('id', user.id)
          .single();
          
        if (userData && userData.email === email) {
          isAuthorized = true;
        } else {
          // Check if user is admin
          const { data: roleData } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single();
            
          if (roleData && roleData.role === 'admin') {
            isAuthorized = true;
          }
        }
      }
    }
    
    // If not authorized through authentication, check token
    // This would be a token sent in unsubscribe links in emails
    if (!isAuthorized && token) {
      // TODO: Implement token validation logic
      // For now, we'll use a simple environment variable for demo purposes
      const validToken = Deno.env.get('UNSUBSCRIBE_TOKEN');
      if (token === validToken) {
        isAuthorized = true;
      }
    }
    
    // For public unsubscribe requests without authentication or token,
    // we'll allow them for now, but in production you might want to
    // implement additional security measures
    if (!isAuthorized && !authHeader && !token) {
      isAuthorized = true; // Allow public unsubscribe for now
    }

    if (!isAuthorized) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Update newsletter_subscribers
    const { data, error } = await supabase
      .from('newsletter_subscribers')
      .update({
        active: false,
        unsubscribed_at: new Date().toISOString()
      })
      .eq('email', email)
      .select();

    if (error) {
      console.error('Error unsubscribing from newsletter:', error);
      return new Response(
        JSON.stringify({ error: "Failed to unsubscribe from newsletter" }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // If no rows were updated, the email wasn't subscribed
    if (data && data.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: "Cette adresse email n'est pas inscrite à notre newsletter" 
        }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // TODO: Add Mailchimp integration here
    // This would involve calling the Mailchimp API to remove the subscriber
    // from your Mailchimp audience

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Vous avez été désinscrit de notre newsletter" 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Error in unsubscribe-newsletter function:', error);
    
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});