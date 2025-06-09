import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
};

interface ProcessCodaRequest {
  filePath: string;
  batchId?: string;
}

// Simple parser for CODA files (BC2 format)
// This is a basic implementation and may need to be enhanced for specific CODA formats
async function parseCodaFile(fileContent: Uint8Array): Promise<any[]> {
  // Convert the binary data to text
  const decoder = new TextDecoder('utf-8');
  const text = decoder.decode(fileContent);
  
  // Split the file into lines
  const lines = text.split('\n');
  
  const transactions = [];
  let currentTransaction = null;
  
  // Process each line
  for (const line of lines) {
    if (!line.trim()) continue;
    
    // Identify line type based on first character
    const recordType = line.charAt(0);
    
    switch (recordType) {
      case '0': // Header record
        // Process header information if needed
        break;
        
      case '1': // Transaction start
        if (currentTransaction) {
          transactions.push(currentTransaction);
        }
        
        // Parse transaction date (positions 48-53, format DDMMYY)
        const dateStr = line.substring(47, 53);
        const day = parseInt(dateStr.substring(0, 2));
        const month = parseInt(dateStr.substring(2, 4));
        const year = 2000 + parseInt(dateStr.substring(4, 6)); // Assuming 21st century
        
        // Parse amount (positions 32-47)
        const amountStr = line.substring(31, 47);
        const isNegative = amountStr.charAt(0) === '1';
        const amount = parseInt(amountStr.substring(1)) / 100; // Convert cents to euros
        
        currentTransaction = {
          transaction_date: `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`,
          amount: isNegative ? -amount : amount,
          currency: 'EUR',
          bank_reference: line.substring(10, 31).trim(),
          communication: '',
          account_number: '',
          account_name: '',
        };
        break;
        
      case '2': // Communication line
        if (currentTransaction) {
          // Append to communication
          currentTransaction.communication += line.substring(10).trim() + ' ';
        }
        break;
        
      case '3': // Counterparty details
        if (currentTransaction) {
          // Extract account number and name
          currentTransaction.account_number = line.substring(10, 47).trim();
          currentTransaction.account_name = line.substring(47).trim();
        }
        break;
        
      case '8': // End of transaction
        // Process any end-of-transaction data if needed
        break;
        
      case '9': // End of file
        if (currentTransaction) {
          transactions.push(currentTransaction);
          currentTransaction = null;
        }
        break;
        
      default:
        // Ignore other record types
        break;
    }
  }
  
  // Add the last transaction if it exists
  if (currentTransaction) {
    transactions.push(currentTransaction);
  }
  
  return transactions;
}

Deno.serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  try {
    // Get the authorization header from the incoming request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const requestData = await req.json() as ProcessCodaRequest;
    const { filePath, batchId } = requestData;

    if (!filePath) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: filePath' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Download the CODA file from storage
    console.log(`Downloading file: ${filePath}`);
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('coda-files')
      .download(filePath);

    if (downloadError) {
      console.error('Error downloading file:', downloadError);
      return new Response(
        JSON.stringify({ error: `Failed to download file: ${downloadError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse the CODA file
    console.log('Parsing CODA file...');
    const transactions = await parseCodaFile(new Uint8Array(await fileData.arrayBuffer()));
    console.log(`Found ${transactions.length} transactions`);

    // Generate a batch ID if not provided
    const importBatchId = batchId || `batch-${Date.now()}`;

    // Insert transactions into the database
    const insertedTransactions = [];
    let matchedCount = 0;

    for (const transaction of transactions) {
      // Insert the transaction
      const { data: insertedTx, error: insertError } = await supabase
        .from('bank_transactions')
        .insert({
          transaction_date: transaction.transaction_date,
          amount: transaction.amount,
          currency: transaction.currency,
          communication: transaction.communication,
          account_number: transaction.account_number,
          account_name: transaction.account_name,
          bank_reference: transaction.bank_reference,
          status: 'unmatched',
          raw_coda_file_path: filePath,
          import_batch_id: importBatchId
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error inserting transaction:', insertError);
        continue;
      }

      insertedTransactions.push(insertedTx);

      // Try to match the transaction to an invoice
      const { data: matchResult, error: matchError } = await supabase.rpc(
        'match_transaction_to_invoice',
        { transaction_id: insertedTx.id }
      );

      if (matchError) {
        console.error('Error matching transaction:', matchError);
      } else if (matchResult) {
        matchedCount++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${transactions.length} transactions, matched ${matchedCount}`,
        batch_id: importBatchId,
        transactions: insertedTransactions.length
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing CODA file:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});