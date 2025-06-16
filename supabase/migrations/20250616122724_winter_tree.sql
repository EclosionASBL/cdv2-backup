/*
  # Fix max(uuid) function error in bank_transactions

  1. Changes
     - Drop user_financial_summary view with CASCADE to handle dependencies
     - Recreate the user_financial_summary view without max(uuid) calls
     - Recreate the get_user_financial_summary function that depends on the view
     - Fix trigger_update_invoice_payment_status function to avoid max(uuid)
     - Fix trigger_update_invoice_status_on_credit_note_change function
*/

-- Drop the view with CASCADE to handle dependencies
DROP VIEW IF EXISTS user_financial_summary CASCADE;

-- Recreate the view without max(uuid) calls
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

-- Recreate the get_user_financial_summary function that depends on the view
CREATE OR REPLACE FUNCTION get_user_financial_summary(p_user_id uuid)
RETURNS SETOF user_financial_summary AS $$
  SELECT * FROM user_financial_summary WHERE user_id = p_user_id;
$$ LANGUAGE sql SECURITY DEFINER;

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
                END,
                -- Add transaction_ids to the array if not already present
                transaction_ids = CASE
                    WHEN NEW.id = ANY(transaction_ids) THEN transaction_ids
                    ELSE array_append(COALESCE(transaction_ids, '{}'::uuid[]), NEW.id)
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
                END,
                -- Remove the transaction ID from the array
                transaction_ids = array_remove(transaction_ids, OLD.id)
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
                WHERE cn.invoice_id = invoices.id
                OR cn.invoice_number = invoices.invoice_number
                AND cn.status = 'issued'
            ), 0) THEN 'cancelled'
            ELSE status
        END
        WHERE invoice_number = NEW.invoice_number
           OR id = NEW.invoice_id;
        
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
                WHERE (cn.invoice_id = invoices.id
                       OR cn.invoice_number = invoices.invoice_number)
                AND cn.status = 'issued'
            ), 0) THEN 'cancelled'
            WHEN total_payments >= amount THEN 'paid'
            WHEN total_payments > 0 THEN 'pending'
            ELSE 'pending'
        END
        WHERE invoice_number = OLD.invoice_number
           OR id = OLD.invoice_id;
        
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