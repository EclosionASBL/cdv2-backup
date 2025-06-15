import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
  'Content-Type': 'application/json'
};

interface ProcessCsvRequest {
  filePath: string;
  batchId?: string;
}

interface Transaction {
  transaction_date: string;
  amount: number;
  currency: string;
  communication: string;
  extracted_invoice_number: string | null;
  account_number: string;
  account_name: string;
  bank_reference: string;
  movement_number: string;
  counterparty_address: string;
  notes?: string;
}

/**
 * Extract invoice number from communication string
 * @param communication - Communication string from transaction
 * @returns Extracted invoice number or null if not found
 */
function extractInvoiceNumber(communication: string): string | null {
  if (!communication) return null;
  
  // Match patterns like CDV-YYMMDD-XXXXX or CDV-YYMMDD-XXXXX
  // Also match variations with spaces or dashes
  const regex = /CDV[-\s]?(\d{6})[-\s]?(\d{5})/i;
  const match = communication.match(regex);
  
  if (match) {
    return `CDV-${match[1]}-${match[2]}`;
  }
  
  // Try alternative format with just the numbers
  const altRegex = /CDV[-\s]?(\d{5,6})/i;
  const altMatch = communication.match(altRegex);
  
  if (altMatch) {
    return `CDV-${altMatch[1]}`;
  }
  
  return null;
}

/**
 * Extract communication from text fields
 * @param libelles - Libellés field from CSV
 * @param details - Détails du mouvement field from CSV
 * @returns Extracted communication
 */
function extractCommunication(libelles: string, details: string): string {
  // Initialize with empty string
  let communication = '';
  
  // First try to extract from Libellés
  if (libelles) {
    // Look for "Communication:" followed by text up to "Info personnelle:" or end of string
    const commRegex = /Communication\s*:\s*([^:]+?)(?:\s*Info personnelle:|$)/i;
    const match = libelles.match(commRegex);
    
    if (match && match[1]) {
      communication = match[1].trim();
      return communication;
    }
  }
  
  // If not found in Libellés, try Détails du mouvement
  if (details) {
    // Look for "Communication :" followed by text up to "Info personnelle:" or end of string
    const commRegex = /Communication\s*:?\s*([^:]+?)(?:\s*Info personnelle:|$)/i;
    const match = details.match(commRegex);
    
    if (match && match[1]) {
      communication = match[1].trim();
      return communication;
    }
  }
  
  return communication;
}

/**
 * Parse a CSV file according to the specified format
 * @param fileContent - Text content of the CSV file
 */
async function parseCsvFile(fileContent: string): Promise<Transaction[]> {
  // Split the file into lines
  const lines = fileContent.split('\n');
  
  // Skip header line if present
  const startIndex = lines[0].includes('Numéro de compte;Nom du compte') ? 1 : 0;
  
  const transactions: Transaction[] = [];
  
  // Process each line
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    try {
      // Split by semicolon
      const fields = line.split(';');
      
      // Check if we have enough fields
      if (fields.length < 10) {
        console.log(`Skipping line ${i+1}: Not enough fields`);
        continue;
      }
      
      // Extract fields according to the format:
      // Numéro de compte;Nom du compte;Compte contrepartie;Numéro de mouvement;Date comptable;Date valeur;Montant;Devise;Libellés;Détails du mouvement;Message
      const accountNumber = fields[0].trim();
      const accountName = fields[1].trim();
      const counterpartyAddress = fields[2].trim();
      const movementNumber = fields[3].trim();
      const accountingDate = fields[4].trim();
      const valueDate = fields[5].trim();
      const amountStr = fields[6].trim().replace(',', '.');
      const currency = fields[7].trim();
      const libelles = fields[8].trim();
      const details = fields[9].trim();
      const message = fields.length > 10 ? fields[10].trim() : '';
      
      // Parse amount
      const amount = parseFloat(amountStr);
      if (isNaN(amount)) {
        console.log(`Skipping line ${i+1}: Invalid amount: ${amountStr}`);
        continue;
      }
      
      // Parse date (assuming format DD/MM/YYYY)
      let transactionDate = '';
      try {
        const dateParts = accountingDate.split('/');
        if (dateParts.length === 3) {
          // Convert DD/MM/YYYY to YYYY-MM-DD
          transactionDate = `${dateParts[2]}-${dateParts[1].padStart(2, '0')}-${dateParts[0].padStart(2, '0')}`;
        } else {
          console.log(`Warning: Invalid date format on line ${i+1}: ${accountingDate}, using current date`);
          transactionDate = new Date().toISOString().split('T')[0];
        }
      } catch (dateError) {
        console.log(`Warning: Error parsing date on line ${i+1}: ${dateError}`);
        transactionDate = new Date().toISOString().split('T')[0];
      }
      
      // Extract communication from Libellés or Détails du mouvement
      const communication = extractCommunication(libelles, details);
      
      // Extract invoice number from communication
      const extractedInvoiceNumber = extractInvoiceNumber(communication);
      
      // Create transaction object
      const transaction: Transaction = {
        transaction_date: transactionDate,
        amount: amount,
        currency: currency,
        communication: communication,
        extracted_invoice_number: extractedInvoiceNumber,
        account_number: accountNumber,
        account_name: accountName,
        bank_reference: message,
        movement_number: movementNumber,
        counterparty_address: counterpartyAddress
      };
      
      transactions.push(transaction);
    } catch (lineError) {
      console.error(`Error processing line ${i+1}:`, lineError);
      continue;
    }
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
      console.error('Missing Authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    let requestData;
    try {
      requestData = await req.json() as ProcessCsvRequest;
      console.log('Request data:', JSON.stringify(requestData));
    } catch (parseError) {
      console.error('Error parsing request JSON:', parseError);
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const { filePath, batchId } = requestData;

    if (!filePath) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: filePath' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify the user is an admin
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Authorization failed' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userError) {
      console.error('Error fetching user role:', userError);
      return new Response(
        JSON.stringify({ error: 'Error verifying admin status' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (userData.role !== 'admin') {
      console.error('User is not an admin:', user.id);
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if this file has already been processed
    const { data: existingImports, error: checkError } = await supabase
      .from('bank_transactions')
      .select('id')
      .eq('raw_file_path', filePath)
      .limit(1);
      
    if (checkError) {
      console.error('Error checking for existing imports:', checkError);
    } else if (existingImports && existingImports.length > 0) {
      return new Response(
        JSON.stringify({ 
          error: 'This CSV file has already been imported. Please use a different file to avoid duplicate transactions.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Download the CSV file from storage
    console.log(`Downloading file: ${filePath}`);
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('csv-files')
      .download(filePath);

    if (downloadError) {
      console.error('Error downloading file:', downloadError);
      return new Response(
        JSON.stringify({ error: `Failed to download file: ${downloadError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Convert file data to text
    const fileContent = await fileData.text();

    // Parse the CSV file
    console.log('Parsing CSV file...');
    const transactions = await parseCsvFile(fileContent);
    console.log(`Found ${transactions.length} transactions`);

    // Generate a batch ID if not provided
    const importBatchId = batchId || `batch-${Date.now()}`;

    // Insert transactions into the database
    const insertedTransactions = [];
    let errorCount = 0;

    for (const transaction of transactions) {
      try {
        // Skip transactions with zero amount
        if (transaction.amount === 0) {
          console.log('Skipping transaction with zero amount');
          errorCount++;
          continue;
        }

        // Insert the transaction
        const { data: insertedTx, error: insertError } = await supabase
          .from('bank_transactions')
          .insert({
            transaction_date: transaction.transaction_date,
            amount: transaction.amount,
            currency: transaction.currency,
            communication: transaction.communication,
            extracted_invoice_number: transaction.extracted_invoice_number,
            account_number: transaction.account_number,
            account_name: transaction.account_name,
            bank_reference: transaction.bank_reference,
            movement_number: transaction.movement_number,
            counterparty_address: transaction.counterparty_address,
            status: 'unmatched',
            raw_file_path: filePath,
            import_batch_id: importBatchId,
            notes: transaction.notes
          })
          .select()
          .single();

        if (insertError) {
          console.error('Error inserting transaction:', insertError);
          errorCount++;
          continue;
        }

        insertedTransactions.push(insertedTx);
      } catch (err) {
        console.error('Error processing transaction:', err);
        errorCount++;
      }
    }

    // Register the import in coda_file_imports table (reused for CSV)
    try {
      await supabase.rpc('register_file_import', {
        file_path: filePath,
        batch_id: importBatchId,
        transaction_count: insertedTransactions.length,
        user_id: user.id
      });
    } catch (registerError) {
      console.error('Error registering file import:', registerError);
      // Continue despite this error
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${transactions.length} transactions, errors: ${errorCount}`,
        batch_id: importBatchId,
        transactions: insertedTransactions.length
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error processing CSV file:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});