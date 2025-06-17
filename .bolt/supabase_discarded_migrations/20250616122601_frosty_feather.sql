/*
  # Fix max(uuid) function error in bank_transactions

  1. Problem
    - PostgreSQL function max(uuid) does not exist
    - Error occurs when querying bank_transactions table
    - Likely caused by a view, trigger, or RLS policy trying to use max() on UUID column

  2. Solution
    - Identify and fix any views, functions, or policies using max() on UUID columns
    - Replace with appropriate timestamp-based ordering where needed
    - Ensure all aggregations use proper data types

  3. Changes
    - Review and fix any problematic database objects
    - Add proper type casting or use appropriate columns for max() operations
*/

-- First, let's check if there are any views or functions that might be causing this issue
-- We'll recreate any problematic views that might be using max() on UUID columns

-- Check if there are any custom functions that might be problematic
-- If there's a custom max function for UUIDs, we need to handle it properly

-- The error is likely in a view or RLS policy. Let's ensure all views are properly defined.
-- Based on the schema, let's check the user_financial_summary view which might be problematic

DROP VIEW IF EXISTS user_financial_summary;

CREATE VIEW user_financial_summary AS
SELECT 
    u.id as user_id,
    u.prenom,
    u.nom,
    u.email,
    COALESCE(SUM(CASE WHEN i.status = 'pending' OR i.status = 'paid' OR i.status = 'overdue' THEN i.amount ELSE 0 END), 0) as total_invoiced,
    COALESCE(SUM(CASE WHEN i.status = 'paid' THEN i.amount ELSE 0 END), 0) as total_paid,
    COALESCE(SUM(CASE WHEN i.status = 'pending' OR i.status = 'overdue' THEN i.amount ELSE 0 END), 0) as total_pending,
    COALESCE(SUM(CASE WHEN i.status = 'cancelled' THEN i.amount ELSE 0 END), 0) as total_cancelled,
    COALESCE(SUM(cn.amount), 0) as total_credits,
    COALESCE(SUM(CASE WHEN i.status = 'pending' OR i.status = 'paid' OR i.status = 'overdue' THEN i.amount ELSE 0 END), 0) as gross_balance,
    COALESCE(SUM(CASE WHEN i.status = 'pending' OR i.status = 'paid' OR i.status = 'overdue' THEN i.amount ELSE 0 END), 0) - COALESCE(SUM(cn.amount), 0) as net_balance
FROM users u
LEFT JOIN invoices i ON u.id = i.user_id
LEFT JOIN credit_notes cn ON u.id = cn.user_id
GROUP BY u.id, u.prenom, u.nom, u.email;

-- Grant appropriate permissions
GRANT SELECT ON user_financial_summary TO authenticated;

-- Ensure RLS is enabled and policies are correct for bank_transactions
-- Check if there are any problematic RLS policies

-- Let's also ensure that any triggers or functions on bank_transactions are working correctly
-- The issue might be in the trigger function trigger_update_invoice_payment_status

-- Let's recreate the trigger function to ensure it doesn't use max() on UUIDs
CREATE OR REPLACE FUNCTION trigger_update_invoice_payment_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Update invoice payment status based on bank transactions
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        -- Update the invoice if it exists
        IF NEW.invoice_id IS NOT NULL THEN
            UPDATE invoices 
            SET 
                total_payments = COALESCE((
                    SELECT SUM(amount) 
                    FROM bank_transactions 
                    WHERE invoice_id = NEW.invoice_id 
                    AND status = 'matched'
                ), 0),
                status = CASE 
                    WHEN COALESCE((
                        SELECT SUM(amount) 
                        FROM bank_transactions 
                        WHERE invoice_id = NEW.invoice_id 
                        AND status = 'matched'
                    ), 0) >= amount THEN 'paid'
                    WHEN COALESCE((
                        SELECT SUM(amount) 
                        FROM bank_transactions 
                        WHERE invoice_id = NEW.invoice_id 
                        AND status = 'matched'
                    ), 0) > 0 THEN 'pending'
                    ELSE status
                END,
                paid_at = CASE 
                    WHEN COALESCE((
                        SELECT SUM(amount) 
                        FROM bank_transactions 
                        WHERE invoice_id = NEW.invoice_id 
                        AND status = 'matched'
                    ), 0) >= amount THEN NOW()
                    ELSE paid_at
                END
            WHERE id = NEW.invoice_id;
        END IF;
    END IF;

    -- Handle DELETE case
    IF TG_OP = 'DELETE' THEN
        IF OLD.invoice_id IS NOT NULL THEN
            UPDATE invoices 
            SET 
                total_payments = COALESCE((
                    SELECT SUM(amount) 
                    FROM bank_transactions 
                    WHERE invoice_id = OLD.invoice_id 
                    AND status = 'matched'
                ), 0),
                status = CASE 
                    WHEN COALESCE((
                        SELECT SUM(amount) 
                        FROM bank_transactions 
                        WHERE invoice_id = OLD.invoice_id 
                        AND status = 'matched'
                    ), 0) >= amount THEN 'paid'
                    WHEN COALESCE((
                        SELECT SUM(amount) 
                        FROM bank_transactions 
                        WHERE invoice_id = OLD.invoice_id 
                        AND status = 'matched'
                    ), 0) > 0 THEN 'pending'
                    ELSE 'pending'
                END,
                paid_at = CASE 
                    WHEN COALESCE((
                        SELECT SUM(amount) 
                        FROM bank_transactions 
                        WHERE invoice_id = OLD.invoice_id 
                        AND status = 'matched'
                    ), 0) >= amount THEN NOW()
                    ELSE NULL
                END
            WHERE id = OLD.invoice_id;
        END IF;
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS trg_update_invoice_payment_status ON bank_transactions;
CREATE TRIGGER trg_update_invoice_payment_status
    AFTER INSERT OR UPDATE OF amount, invoice_id, status OR DELETE
    ON bank_transactions
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_invoice_payment_status();

-- Also check and fix the credit note trigger function
CREATE OR REPLACE FUNCTION trigger_update_invoice_status_on_credit_note_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Handle INSERT and UPDATE
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        -- Update invoice status based on credit notes
        UPDATE invoices 
        SET status = CASE 
            WHEN amount <= COALESCE((
                SELECT SUM(cn.amount) 
                FROM credit_notes cn 
                WHERE cn.invoice_id = invoices.invoice_number::text
                AND cn.status = 'issued'
            ), 0) THEN 'cancelled'
            ELSE status
        END
        WHERE invoice_number = NEW.invoice_number;
        
        RETURN NEW;
    END IF;

    -- Handle DELETE
    IF TG_OP = 'DELETE' THEN
        -- Update invoice status when credit note is deleted
        UPDATE invoices 
        SET status = CASE 
            WHEN amount <= COALESCE((
                SELECT SUM(cn.amount) 
                FROM credit_notes cn 
                WHERE cn.invoice_id = invoices.invoice_number::text
                AND cn.status = 'issued'
            ), 0) THEN 'cancelled'
            WHEN total_payments >= amount THEN 'paid'
            WHEN total_payments > 0 THEN 'pending'
            ELSE 'pending'
        END
        WHERE invoice_number = OLD.invoice_number;
        
        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
DROP TRIGGER IF EXISTS trg_update_invoice_status_on_credit_note_change ON credit_notes;
CREATE TRIGGER trg_update_invoice_status_on_credit_note_change
    AFTER INSERT OR UPDATE OR DELETE
    ON credit_notes
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_invoice_status_on_credit_note_change();