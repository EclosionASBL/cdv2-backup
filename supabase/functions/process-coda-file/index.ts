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

/**
 * Parse and validate a date string from CODA file
 * Handles various date formats and edge cases
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

    // Try DDMMYY format first (standard for Belgian CODA)
    let day = parseInt(dateStr.substring(0, 2));
    let month = parseInt(dateStr.substring(2, 4));
    let year = 2000 + parseInt(dateStr.substring(4, 6)); // Assuming 21st century
    
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
    
    // If DDMMYY fails, try MMDDYY format
    day = parseInt(dateStr.substring(2, 4));
    month = parseInt(dateStr.substring(0, 2));
    
    // Check if swapped date is valid
    const swappedDate = new Date(year, month - 1, day);
    const isValidSwappedDate = swappedDate instanceof Date && !isNaN(swappedDate.getTime()) &&
                              swappedDate.getDate() === day &&
                              swappedDate.getMonth() === month - 1;
    
    if (isValidSwappedDate) {
      return { 
        date: `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`,
        isValid: true,
        notes: `Date format was MMDDYY instead of DDMMYY: ${dateStr}`
      };
    }
    
    // If both formats fail, try to extract a valid date by checking various combinations
    // For example, if month is out of range (e.g., 14), try to interpret it differently
    
    // Try to handle the specific case in the error: "2013-14-00"
    if (month > 12) {
      // This could be a special code or a formatting error
      // Default to first day of the month as a fallback
      return { 
        date: `${year}-01-01`,
        isValid: false,
        notes: `Invalid month (${month}) in date string: ${dateStr}. Using fallback date.`
      };
    }
    
    // If day is 0, default to 1st day of the month
    if (day === 0) {
      return { 
        date: `${year}-${month.toString().padStart(2, '0')}-01`,
        isValid: false,
        notes: `Invalid day (0) in date string: ${dateStr}. Using 1st day of month.`
      };
    }
    
    // Last resort fallback
    return { 
      date: '1970-01-01',
      isValid: false,
      notes: `Could not parse date string: ${dateStr}. Using epoch date as fallback.`
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
        const { date, isValid, notes } = parseAndValidateDate(dateStr);
        
        // Parse amount (positions 32-47)
        const amountStr = line.substring(31, 47);
        const isNegative = amountStr.charAt(0) === '1';
        
        // Parse the amount and handle NaN values
        let amount;
        try {
          amount = parseInt(amountStr.substring(1)) / 100; // Convert cents to euros
          
          // Check if amount is NaN and set a default value
          if (isNaN(amount)) {
            amount = 0;
            const amountNote = `Could not parse amount string: ${amountStr}. Using 0 as fallback.`;
            currentTransaction = {
              transaction_date: date,
              amount: 0,
              currency: 'EUR',
              bank_reference: line.substring(10, 31).trim(),
              communication: '',
              account_number: '',
              account_name: '',
              notes: notes ? `${notes}. ${amountNote}` : amountNote
            };
          } else {
            currentTransaction = {
              transaction_date: date,
              amount: isNegative ? -amount : amount,
              currency: 'EUR',
              bank_reference: line.substring(10, 31).trim(),
              communication: '',
              account_number: '',
              account_name: '',
              notes: notes || null
            };
          }
        } catch (error) {
          // Handle any parsing errors
          amount = 0;
          const amountNote = `Error parsing amount: ${error instanceof Error ? error.message : 'Unknown error'}. Using 0 as fallback.`;
          currentTransaction = {
            transaction_date: date,
            amount: 0,
            currency: 'EUR',
            bank_reference: line.substring(10, 31).trim(),
            communication: '',
            account_number: '',
            account_name: '',
            notes: notes ? `${notes}. ${amountNote}` : amountNote
          };
        }
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
    let errorCount = 0;

    for (const transaction of transactions) {
      try {
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