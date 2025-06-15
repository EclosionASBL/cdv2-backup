import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

// Define CORS headers with explicit content-type
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
  bank_reference: string;
  communication: string;
  extracted_invoice_number: string | null;
  account_number: string;
  account_name: string;
  notes?: string;
}

/**
 * Parse and validate a date string from CSV file in DDMMYY format
 * @param dateStr - Date string in DDMMYY format
 */
function parseAndValidateDate(dateStr: string): { 
  date: string; 
  isValid: boolean;
  notes?: string;
} {
  try {
    if (!dateStr || dateStr.length !== 6) {
      return { 
        date: '1970-01-01', 
        isValid: false,
        notes: `Invalid date string: ${dateStr}` 
      };
    }

    // Parse in DDMMYY format (standard for Belgian CSV)
    const day = parseInt(dateStr.substring(0, 2));
    const month = parseInt(dateStr.substring(2, 4));
    const year = 2000 + parseInt(dateStr.substring(4, 6)); // Assuming 21st century
    
    // Check if date is valid
    const date = new Date(year, month - 1, day);
    const isValidDate = date instanceof Date && !isNaN(date.getTime()) &&
                        date.getDate() === day &&
                        date.getMonth() === month - 1;
    
    if (isValidDate) {
      return { 
        date: `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`,
        isValid: true
      };
    }
    
    // If date is invalid, return a fallback with notes
    return { 
      date: '1970-01-01',
      isValid: false,
      notes: `Invalid date components: day=${day}, month=${month}, year=${year} from string: ${dateStr}`
    };
  } catch (error) {
    console.error('Error parsing date:', error, 'dateStr:', dateStr);
    return { 
      date: '1970-01-01', 
      isValid: false,
      notes: `Exception parsing date: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

/**
 * Parse amount from CSV file
 * @param amountStr - Amount string from CSV file
 */
function parseAmount(amountStr: string): {
  amount: number;
  isValid: boolean;
  notes?: string;
} {
  try {
    if (!amountStr) {
      return {
        amount: 0,
        isValid: false,
        notes: `Invalid amount string: ${amountStr}`
      };
    }

    // Remove any non-numeric characters except decimal point and minus sign
    const cleanedStr = amountStr.replace(/[^\d.-]/g, '');
    
    // Parse the amount
    const amount = parseFloat(cleanedStr);
    
    if (isNaN(amount)) {
      return {
        amount: 0,
        isValid: false,
        notes: `Could not parse amount string: ${amountStr}`
      };
    }
    
    return {
      amount: amount,
      isValid: true
    };
  } catch (error) {
    console.error('Error parsing amount:', error, 'amountStr:', amountStr);
    return {
      amount: 0,
      isValid: false,
      notes: `Exception parsing amount: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
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
 * Parse a CSV file
 * @param fileContent - Binary content of the CSV file
 */
async function parseCsvFile(fileContent: Uint8Array): Promise<Transaction[]> {
  // Convert the binary data to text using ISO-8859-1 encoding (Latin-1)
  const decoder = new TextDecoder('iso-8859-1');
  const text = decoder.decode(fileContent);
  
  // Split the file into lines
  const lines = text.split('\n');
  
  // Skip header line if present
  const startLine = lines[0].includes('Date') || lines[0].includes('Montant') ? 1 : 0;
  
  const transactions: Transaction[] = [];
  
  // Process each line
  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Split the line by delimiter (comma or semicolon)
    const delimiter = line.includes(';') ? ';' : ',';
    const fields = line.split(delimiter);
    
    // Skip if we don't have enough fields
    if (fields.length < 5) continue;
    
    // Parse date (assuming it's in the first column)
    const dateStr = fields[0].trim();
    const { date, isValid: isDateValid, notes: dateNotes } = parseAndValidateDate(dateStr);
    
    // Parse amount (assuming it's in the second column)
    const amountStr = fields[1].trim();
    const { amount, isValid: isAmountValid, notes: amountNotes } = parseAmount(amountStr);
    
    // Extract communication (assuming it's in the third column)
    const communication = fields[2].trim();
    
    // Extract invoice number from communication
    const extractedInvoiceNumber = extractInvoiceNumber(communication);
    
    // Create transaction object
    const transaction: Transaction = {
      transaction_date: date,
      amount: amount,
      currency: 'EUR', // Default currency
      communication: communication,
      extracted_invoice_number: extractedInvoiceNumber,
      account_number: fields[3]?.trim() || '',
      account_name: fields[4]?.trim() || '',
      bank_reference: fields[5]?.trim() || '',
      notes: [dateNotes, amountNotes].filter(Boolean).join('. ')
    };
    
    transactions.push(transaction);
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

    // Get user information from auth header
    const { data: { user }, error: userError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Authentication error' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is admin
    const { data: userData, error: roleError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (roleError || userData?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if this file has already been processed
    const { data: existingTransactions, error: checkError } = await supabase
      .from('bank_transactions')
      .select('id')
      .eq('raw_coda_file_path', filePath)
      .limit(1);
    
    if (checkError) {
      console.error('Error checking if file has been processed:', checkError);
      return new Response(
        JSON.stringify({ error: `Error checking file status: ${checkError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    if (existingTransactions && existingTransactions.length > 0) {
      return new Response(
        JSON.stringify({ 
          error: 'Ce fichier CSV a déjà été importé. Veuillez utiliser un fichier différent pour éviter les transactions en double.' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Download the CSV file from storage
    console.log(`Downloading file: ${filePath}`);
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('coda-files')
      .download(filePath);

    if (downloadError) {
      console.error('Error downloading file:', downloadError);
      
      // Register the failed import
      await supabase
        .from('coda_file_imports')
        .insert({
          file_path: filePath,
          imported_by: user.id,
          status: 'error',
          error_message: `Failed to download file: ${downloadError.message}`
        });
      
      return new Response(
        JSON.stringify({ error: `Failed to download file: ${downloadError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse the CSV file
    console.log('Parsing CSV file...');
    const transactions = await parseCsvFile(new Uint8Array(await fileData.arrayBuffer()));
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
            status: 'unmatched',
            raw_coda_file_path: filePath,
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

    // Register the successful import
    await supabase
      .from('coda_file_imports')
      .insert({
        file_path: filePath,
        batch_id: importBatchId,
        transaction_count: insertedTransactions.length,
        imported_by: user.id,
        status: 'success'
      });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${transactions.length} transactions, errors: ${errorCount}`,
        batch_id: importBatchId,
        transactions: insertedTransactions.length
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error processing CSV file:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});