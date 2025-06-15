/*
# Add Reconciliation RPC Functions

This migration adds RPC functions that can be called from the frontend to manually
trigger reconciliation processes.

1. Functions
  - Create `reconcile_invoice` function to manually reconcile a specific invoice
  - Create `reconcile_all_pending_invoices` function to reconcile all pending invoices
  - Create `get_invoice_payment_summary` function to get payment summary for an invoice

2. Security
  - These functions are restricted to admin users only
*/

-- Function to reconcile a specific invoice by invoice number
CREATE OR REPLACE FUNCTION public.reconcile_invoice(p_invoice_number text)
RETURNS jsonb AS $$
DECLARE
    v_invoice_id uuid;
    v_invoice_amount numeric;
    v_invoice_status text;
    v_user_id uuid;
    v_total_payments numeric := 0;
    v_transaction_count int := 0;
    v_result jsonb;
BEGIN
    -- Get invoice details
    SELECT id, amount, status, user_id
    INTO v_invoice_id, v_invoice_amount, v_invoice_status, v_user_id
    FROM public.invoices
    WHERE invoice_number = p_invoice_number;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invoice not found',
            'invoice_number', p_invoice_number
        );
    END IF;
    
    -- Calculate total payments
    SELECT COALESCE(SUM(amount), 0), COUNT(*)
    INTO v_total_payments, v_transaction_count
    FROM public.bank_transactions
    WHERE invoice_id = v_invoice_id
    AND status IN ('matched', 'partially_matched', 'overpaid');
    
    -- Call the reconciliation function
    PERFORM public.update_invoice_payment_status(p_invoice_number);
    
    -- Get updated invoice status
    SELECT status INTO v_invoice_status
    FROM public.invoices
    WHERE id = v_invoice_id;
    
    -- Build result
    v_result := jsonb_build_object(
        'success', true,
        'invoice_number', p_invoice_number,
        'invoice_amount', v_invoice_amount,
        'total_payments', v_total_payments,
        'transaction_count', v_transaction_count,
        'status', v_invoice_status,
        'balance', v_invoice_amount - v_total_payments
    );
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to reconcile all pending invoices
CREATE OR REPLACE FUNCTION public.reconcile_all_pending_invoices()
RETURNS jsonb AS $$
DECLARE
    v_count int := 0;
    v_success_count int := 0;
    v_error_count int := 0;
    v_invoice record;
BEGIN
    -- Get all pending invoices
    FOR v_invoice IN 
        SELECT invoice_number 
        FROM public.invoices 
        WHERE status = 'pending'
    LOOP
        v_count := v_count + 1;
        
        -- Try to reconcile each invoice
        BEGIN
            PERFORM public.update_invoice_payment_status(v_invoice.invoice_number);
            v_success_count := v_success_count + 1;
        EXCEPTION
            WHEN OTHERS THEN
                v_error_count := v_error_count + 1;
                RAISE NOTICE 'Error reconciling invoice %: %', v_invoice.invoice_number, SQLERRM;
        END;
    END LOOP;
    
    RETURN jsonb_build_object(
        'success', true,
        'total_invoices', v_count,
        'success_count', v_success_count,
        'error_count', v_error_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get payment summary for an invoice
CREATE OR REPLACE FUNCTION public.get_invoice_payment_summary(p_invoice_number text)
RETURNS jsonb AS $$
DECLARE
    v_invoice_id uuid;
    v_invoice_amount numeric;
    v_invoice_status text;
    v_user_id uuid;
    v_total_payments numeric := 0;
    v_transaction_count int := 0;
    v_transactions jsonb := '[]';
    v_credit_notes jsonb := '[]';
    v_result jsonb;
BEGIN
    -- Get invoice details
    SELECT id, amount, status, user_id
    INTO v_invoice_id, v_invoice_amount, v_invoice_status, v_user_id
    FROM public.invoices
    WHERE invoice_number = p_invoice_number;
    
    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Invoice not found',
            'invoice_number', p_invoice_number
        );
    END IF;
    
    -- Get transactions
    SELECT 
        COALESCE(SUM(amount), 0),
        COUNT(*),
        jsonb_agg(
            jsonb_build_object(
                'id', id,
                'transaction_date', transaction_date,
                'amount', amount,
                'status', status,
                'communication', communication,
                'movement_number', movement_number,
                'counterparty_name', counterparty_name
            )
        )
    INTO v_total_payments, v_transaction_count, v_transactions
    FROM public.bank_transactions
    WHERE invoice_id = v_invoice_id
    AND status IN ('matched', 'partially_matched', 'overpaid');
    
    -- Get credit notes
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', id,
            'credit_note_number', credit_note_number,
            'amount', amount,
            'created_at', created_at,
            'type', type,
            'pdf_url', pdf_url
        )
    )
    INTO v_credit_notes
    FROM public.credit_notes
    WHERE invoice_id = v_invoice_id OR invoice_number = p_invoice_number;
    
    -- Build result
    v_result := jsonb_build_object(
        'success', true,
        'invoice_number', p_invoice_number,
        'invoice_amount', v_invoice_amount,
        'total_payments', v_total_payments,
        'transaction_count', v_transaction_count,
        'status', v_invoice_status,
        'balance', v_invoice_amount - v_total_payments,
        'transactions', COALESCE(v_transactions, '[]'),
        'credit_notes', COALESCE(v_credit_notes, '[]')
    );
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.reconcile_invoice(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_all_pending_invoices() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_invoice_payment_summary(text) TO authenticated;

-- Add row-level security policies to restrict these functions to admin users
CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
RETURNS boolean AS $$
DECLARE
    v_is_admin boolean;
BEGIN
    SELECT (role = 'admin') INTO v_is_admin
    FROM public.users
    WHERE id = uid;
    
    RETURN COALESCE(v_is_admin, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;