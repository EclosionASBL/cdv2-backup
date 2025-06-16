/*
  # Add Performance Indexes for Bank Transactions

  1. New Indexes
    - Add index on `invoices.invoice_number` for faster invoice lookups
    - Add index on `invoices.communication` for faster communication matching
    - Add composite index on `invoices(status, invoice_number)` for filtered searches
    - Add composite index on `invoices(status, amount)` for amount-based matching
    - Add index on `bank_transactions.status` for status filtering
    - Add index on `bank_transactions.transaction_date` for date sorting
    - Add index on `bank_transactions.amount` for amount-based searches
    - Add index on `bank_transactions.extracted_invoice_number` for invoice matching
    - Add index on `bank_transactions.communication` for communication searches
    - Add composite index on `bank_transactions(status, transaction_date)` for filtered queries
    - Add composite index on `bank_transactions(import_batch_id, status)` for batch filtering

  2. Performance Improvements
    - These indexes will significantly speed up transaction-to-invoice matching
    - Reduce timeout issues when querying large datasets
    - Improve performance of admin bank transactions page
    - Optimize the match-transaction-to-invoice edge function
*/

-- Add indexes on invoices table for faster lookups
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_communication ON invoices(communication);
CREATE INDEX IF NOT EXISTS idx_invoices_status_invoice_number ON invoices(status, invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_status_amount ON invoices(status, amount);

-- Add indexes on bank_transactions table for better performance
CREATE INDEX IF NOT EXISTS idx_bank_transactions_status ON bank_transactions(status);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_transaction_date ON bank_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_amount ON bank_transactions(amount);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_extracted_invoice_number ON bank_transactions(extracted_invoice_number);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_communication ON bank_transactions(communication);

-- Add composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_bank_transactions_status_date ON bank_transactions(status, transaction_date);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_batch_status ON bank_transactions(import_batch_id, status);

-- Add index for counterparty searches
CREATE INDEX IF NOT EXISTS idx_bank_transactions_counterparty_name ON bank_transactions(counterparty_name);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_account_name ON bank_transactions(account_name);

-- Add partial indexes for unmatched transactions (most common queries)
CREATE INDEX IF NOT EXISTS idx_bank_transactions_unmatched ON bank_transactions(transaction_date, amount) WHERE status = 'unmatched';
CREATE INDEX IF NOT EXISTS idx_invoices_pending ON invoices(invoice_number, amount) WHERE status = 'pending';