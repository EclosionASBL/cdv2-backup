import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Supabase client with service role key to bypass RLS
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Missing Supabase environment variables');
  console.error('Make sure VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your .env file');
  process.exit(1);
}

console.log('Supabase URL:', supabaseUrl);
console.log('Service Key available:', !!supabaseServiceKey);

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function updateRegistrations() {
  console.log('Starting registration status update process...');
  
  try {
    // Step 1: Find all paid invoices
    console.log('Fetching paid invoices...');
    const { data: paidInvoices, error: invoicesError } = await supabase
      .from('invoices')
      .select('id, invoice_number, status')
      .eq('status', 'paid');
    
    if (invoicesError) {
      console.error('Error fetching paid invoices:', invoicesError);
      throw new Error(`Error fetching paid invoices: ${invoicesError.message}`);
    }
    
    console.log(`Found ${paidInvoices.length} paid invoices`);
    
    // Step 2: For each paid invoice, find pending registrations
    let totalUpdated = 0;
    let totalProcessed = 0;
    
    for (const invoice of paidInvoices) {
      console.log(`Processing invoice ${invoice.invoice_number}...`);
      
      // Find pending registrations for this invoice
      const { data: pendingRegistrations, error: regError } = await supabase
        .from('registrations')
        .select('id')
        .eq('invoice_id', invoice.invoice_number)
        .eq('payment_status', 'pending');
      
      if (regError) {
        console.error(`Error fetching registrations for invoice ${invoice.invoice_number}:`, regError);
        continue;
      }
      
      if (!pendingRegistrations) {
        console.log(`No data returned for pending registrations query for invoice ${invoice.invoice_number}`);
        continue;
      }
      
      totalProcessed += pendingRegistrations.length;
      
      if (pendingRegistrations.length === 0) {
        console.log(`No pending registrations found for invoice ${invoice.invoice_number}`);
        continue;
      }
      
      console.log(`Found ${pendingRegistrations.length} pending registrations for invoice ${invoice.invoice_number}`);
      
      // Log the exact query we're about to execute
      console.log(`Attempting to update registrations for invoice_id: '${invoice.invoice_number}' with payment_status: 'pending' to 'paid'`);
      
      try {
        // Update registrations to paid status
        const { data: updateResult, error: updateError } = await supabase
          .from('registrations')
          .update({ payment_status: 'paid' })
          .eq('invoice_id', invoice.invoice_number)
          .eq('payment_status', 'pending');
        
        if (updateError) {
          console.error(`Error updating registrations for invoice ${invoice.invoice_number}:`, updateError);
          console.error('Full error object:', JSON.stringify(updateError, null, 2));
          continue;
        }
        
        console.log(`Update result:`, updateResult);
        console.log(`Updated ${pendingRegistrations.length} registrations to paid status for invoice ${invoice.invoice_number}`);
        totalUpdated += pendingRegistrations.length;
      } catch (updateException) {
        console.error(`Exception during update for invoice ${invoice.invoice_number}:`, updateException);
        continue;
      }
      
      // Call the update_invoice_payment_status function to ensure everything is consistent
      try {
        console.log(`Calling RPC update_invoice_payment_status for invoice ${invoice.invoice_number}`);
        const { data: rpcData, error: rpcError } = await supabase.rpc(
          'update_invoice_payment_status',
          { p_invoice_number: invoice.invoice_number }
        );
        
        if (rpcError) {
          console.error(`Error calling update_invoice_payment_status for invoice ${invoice.invoice_number}:`, rpcError);
        } else {
          console.log(`Successfully called update_invoice_payment_status for invoice ${invoice.invoice_number}`, rpcData);
        }
      } catch (rpcError) {
        console.error(`Exception calling update_invoice_payment_status for invoice ${invoice.invoice_number}:`, rpcError);
      }
    }
    
    console.log('\n=== Summary ===');
    console.log(`Total invoices processed: ${paidInvoices.length}`);
    console.log(`Total registrations processed: ${totalProcessed}`);
    console.log(`Total registrations updated: ${totalUpdated}`);
    console.log('Update process completed successfully!');
    
  } catch (error) {
    console.error('Error in update process:', error);
    process.exit(1);
  }
}

// Run the update function
updateRegistrations()
  .then(() => {
    console.log('Script execution completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });