/*
# Fix Payment Status Calculation

1. Changes
   - Update the `trigger_update_invoice_payment_status` function to include all relevant payment statuses
   - Include 'matched', 'partially_matched', and 'overpaid' statuses when calculating total payments
   - Ensure transaction IDs are properly tracked in the invoice

2. Purpose
   - Fix issue where payments are not showing up in the parent's financial summary
   - Ensure all payment types contribute to the total payment amount
*/

-- Update the trigger function to include all relevant payment statuses
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
                    AND status IN ('matched', 'partially_matched', 'overpaid')
                ), 0),
                status = CASE 
                    WHEN COALESCE((
                        SELECT SUM(amount) 
                        FROM bank_transactions 
                        WHERE invoice_id = NEW.invoice_id 
                        AND status IN ('matched', 'partially_matched', 'overpaid')
                    ), 0) >= amount THEN 'paid'
                    WHEN COALESCE((
                        SELECT SUM(amount) 
                        FROM bank_transactions 
                        WHERE invoice_id = NEW.invoice_id 
                        AND status IN ('matched', 'partially_matched', 'overpaid')
                    ), 0) > 0 THEN 'pending'
                    ELSE status
                END,
                paid_at = CASE 
                    WHEN COALESCE((
                        SELECT SUM(amount) 
                        FROM bank_transactions 
                        WHERE invoice_id = NEW.invoice_id 
                        AND status IN ('matched', 'partially_matched', 'overpaid')
                    ), 0) >= amount THEN NOW()
                    ELSE paid_at
                END,
                -- Add transaction_ids to the array if not already present
                transaction_ids = CASE
                    WHEN NEW.id = ANY(COALESCE(transaction_ids, '{}'::uuid[])) THEN transaction_ids
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
                    AND status IN ('matched', 'partially_matched', 'overpaid')
                ), 0),
                status = CASE 
                    WHEN COALESCE((
                        SELECT SUM(amount) 
                        FROM bank_transactions 
                        WHERE invoice_id = OLD.invoice_id 
                        AND status IN ('matched', 'partially_matched', 'overpaid')
                    ), 0) >= amount THEN 'paid'
                    WHEN COALESCE((
                        SELECT SUM(amount) 
                        FROM bank_transactions 
                        WHERE invoice_id = OLD.invoice_id 
                        AND status IN ('matched', 'partially_matched', 'overpaid')
                    ), 0) > 0 THEN 'pending'
                    ELSE 'pending'
                END,
                paid_at = CASE 
                    WHEN COALESCE((
                        SELECT SUM(amount) 
                        FROM bank_transactions 
                        WHERE invoice_id = OLD.invoice_id 
                        AND status IN ('matched', 'partially_matched', 'overpaid')
                    ), 0) >= amount THEN NOW()
                    ELSE NULL
                END,
                -- Remove the transaction ID from the array
                transaction_ids = array_remove(COALESCE(transaction_ids, '{}'::uuid[]), OLD.id)
            WHERE id = OLD.invoice_id;
        END IF;
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger to ensure it uses the updated function
DROP TRIGGER IF EXISTS trg_update_invoice_payment_status ON bank_transactions;
CREATE TRIGGER trg_update_invoice_payment_status
    AFTER INSERT OR UPDATE OF amount, invoice_id, status OR DELETE
    ON bank_transactions
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_invoice_payment_status();

-- Create a function to update all existing invoices with the new calculation
CREATE OR REPLACE FUNCTION update_all_invoice_payments()
RETURNS void AS $$
DECLARE
    v_invoice_id uuid;
BEGIN
    FOR v_invoice_id IN SELECT id FROM invoices LOOP
        UPDATE invoices 
        SET 
            total_payments = COALESCE((
                SELECT SUM(amount) 
                FROM bank_transactions 
                WHERE invoice_id = v_invoice_id 
                AND status IN ('matched', 'partially_matched', 'overpaid')
            ), 0),
            status = CASE 
                WHEN COALESCE((
                    SELECT SUM(amount) 
                    FROM bank_transactions 
                    WHERE invoice_id = v_invoice_id 
                    AND status IN ('matched', 'partially_matched', 'overpaid')
                ), 0) >= amount THEN 'paid'
                WHEN COALESCE((
                    SELECT SUM(amount) 
                    FROM bank_transactions 
                    WHERE invoice_id = v_invoice_id 
                    AND status IN ('matched', 'partially_matched', 'overpaid')
                ), 0) > 0 THEN 'pending'
                ELSE status
            END,
            paid_at = CASE 
                WHEN COALESCE((
                    SELECT SUM(amount) 
                    FROM bank_transactions 
                    WHERE invoice_id = v_invoice_id 
                    AND status IN ('matched', 'partially_matched', 'overpaid')
                ), 0) >= amount THEN NOW()
                ELSE paid_at
            END,
            transaction_ids = ARRAY(
                SELECT id 
                FROM bank_transactions 
                WHERE invoice_id = v_invoice_id 
                AND status IN ('matched', 'partially_matched', 'overpaid')
            )
        WHERE id = v_invoice_id;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Execute the function to update all existing invoices
SELECT update_all_invoice_payments();

-- Drop the function after use
DROP FUNCTION update_all_invoice_payments();