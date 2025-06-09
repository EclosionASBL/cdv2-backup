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

interface Transaction {
  transaction_date: string;
  amount: number;
  currency: string;
  bank_reference: string;
  communication: string;
  account_number: string;
  account_name: string;
  notes?: string;
}

/**
 * Parse and validate a date string from CODA file in DDMMYY format
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

    // Parse in DDMMYY format (standard for Belgian CODA)
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
 * Parse amount from CODA file
 * @param amountStr - Amount string from CODA file (positions 32-47)
 * First character is 0 for credit, 1 for debit
 * The rest is the amount in cents (2 decimal places)
 */
function parseAmount(amountStr: string): {
  amount: number;
  isValid: boolean;
  notes?: string;
} {
  try {
    if (!amountStr || amountStr.length < 2) {
      return {
        amount: 0,
        isValid: false,
        notes: `Invalid amount string: ${amountStr}`
      };
    }

    // First character indicates sign (0=credit, 1=debit)
    const isNegative = amountStr.charAt(0) === '1';
    
    // Rest of string is the amount in cents
    const amountInCents = parseInt(amountStr.substring(1));
    
    if (isNaN(amountInCents)) {
      return {
        amount: 0,
        isValid: false,
        notes: `Could not parse amount string: ${amountStr}`
      };
    }
    
    // Convert cents to euros
    const amount = amountInCents / 100;
    
    return {
      amount: isNegative ? -amount : amount,
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
 * Parse a CODA file according to the Belgian CODA BC2 format specification
 * @param fileContent - Binary content of the CODA file
 */
async function parseCodaFile(fileContent: Uint8Array): Promise<Transaction[]> {
  // Convert the binary data to text using ISO-8859-1 encoding (Latin-1)
  const decoder = new TextDecoder('iso-8859-1');
  const text = decoder.decode(fileContent);
  
  // Split the file into lines
  const lines = text.split('\n');
  
  const transactions: Transaction[] = [];
  let currentTransaction: Transaction | null = null;
  
  // Process each line
  for (const line of lines) {
    if (!line.trim()) continue;
    
    // Identify record type based on first character
    const recordType = line.charAt(0);
    const recordSubtype = line.length > 1 ? line.charAt(1) : '';
    
    // Full record identification (e.g., "21" for movement record)
    const recordId = recordType + recordSubtype;
    
    switch (recordId) {
      case '0': // Header record
        // Process header information if needed
        console.log('Header record found');
        break;
        
      case '21': // Movement record (2.1) - Start of a new transaction
        // If we have a current transaction, save it before starting a new one
        if (currentTransaction) {
          transactions.push(currentTransaction);
        }
        
        // Parse transaction date (positions 48-53, format DDMMYY)
        const dateStr = line.substring(47, 53);
        const { date, isValid: isDateValid, notes: dateNotes } = parseAndValidateDate(dateStr);
        
        // Parse amount (positions 32-47)
        const amountStr = line.substring(31, 47);
        const { amount, isValid: isAmountValid, notes: amountNotes } = parseAmount(amountStr);
        
        // Create new transaction
        currentTransaction = {
          transaction_date: date,
          amount: amount,
          currency: 'EUR', // Default currency
          bank_reference: line.substring(10, 31).trim(),
          communication: line.substring(63, 115).trim(), // Communication starts at position 64
          account_number: '',
          account_name: '',
          notes: [dateNotes, amountNotes].filter(Boolean).join('. ')
        };
        break;
        
      case '22': // Movement record (2.2) - Additional details
        if (currentTransaction) {
          // Extract additional information if needed
          // This might include BIC codes, etc.
        }
        break;
        
      case '23': // Movement record (2.3) - Counterparty details
        if (currentTransaction) {
          // Extract counterparty account and name
          currentTransaction.account_number = line.substring(10, 47).trim();
          currentTransaction.account_name = line.substring(47).trim();
        }
        break;
        
      case '31': // Information record (3.1) - Additional communication
        if (currentTransaction) {
          // Append to communication
          const additionalInfo = line.substring(10).trim();
          if (additionalInfo) {
            currentTransaction.communication += ' ' + additionalInfo;
          }
        }
        break;
        
      case '32': // Information record (3.2) - More communication
        if (currentTransaction) {
          // Append to communication
          const additionalInfo = line.substring(10).trim();
          if (additionalInfo) {
            currentTransaction.communication += ' ' + additionalInfo;
          }
        }
        break;
        
      case '8': // New balance record
        // Process new balance if needed
        break;
        
      case '9': // Trailer record
        // End of file - add the last transaction if it exists
        if (currentTransaction) {
          transactions.push(currentTransaction);
          currentTransaction = null;
        }
        break;
        
      default:
        // Log unhandled record types for debugging
        console.log(`Unhandled record type: ${recordId}`);
        break;
    }
  }
  
  // Add the last transaction if it exists
  if (currentTransaction) {
    transactions.push(currentTransaction);
  }
  
  // Clean up transactions - trim communication and remove empty notes
  return transactions.map(tx => ({
    ...tx,
    communication: tx.communication.trim(),
    notes: tx.notes && tx.notes.trim() ? tx.notes.trim() : undefined
  }));
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
      } catch (err) {
        console.error('Error processing transaction:', err);
        errorCount++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${transactions.length} transactions, matched ${matchedCount}, errors: ${errorCount}`,
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