import { supabase } from './supabase';

interface InvoiceData {
  invoice_id: string;
  amount: number;
  user_id: string;
  kid_id: string;
  activity_id: string;
  kid_name: string;
  activity_name: string;
  communication: string;
}

// Google Apps Script deployment URL
const GOOGLE_SCRIPT_URL = import.meta.env.VITE_GOOGLE_SCRIPT_URL;

/**
 * Sends invoice data to Google Sheets via Google Apps Script
 */
export async function sendInvoiceToGoogleSheets(invoiceData: InvoiceData): Promise<boolean> {
  try {
    if (!GOOGLE_SCRIPT_URL) {
      console.error('Google Script URL is not defined in environment variables');
      return false;
    }

    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...invoiceData,
        api_key: 'oJ77UmqWU4VLzXcRQEh4jYsuembHe'
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to send invoice to Google Sheets:', errorText);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending invoice to Google Sheets:', error);
    return false;
  }
}

/**
 * Generates a structured communication code for bank transfers
 * Format: +++123/4567/89012+++
 */
export function generateStructuredCommunication(): string {
  // Generate 10 random digits
  const digits = Array.from({ length: 10 }, () => Math.floor(Math.random() * 10)).join('');
  
  // Calculate check digit (modulo 97, or 97 if result is 0)
  const base = parseInt(digits, 10);
  let checkDigits = 97 - (base % 97);
  if (checkDigits === 0) checkDigits = 97;
  
  // Format with leading zero for check digits if needed
  const formattedCheckDigits = checkDigits < 10 ? `0${checkDigits}` : `${checkDigits}`;
  
  // Format as +++xxx/xxxx/xxxxx+++
  return `+++${digits.slice(0, 3)}/${digits.slice(3, 7)}/${digits.slice(7, 10)}${formattedCheckDigits}+++`;
}

/**
 * Generates a unique invoice ID with prefix
 */
export function generateInvoiceId(): string {
  const prefix = 'INV';
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Updates registration payment status in Supabase
 */
export async function updatePaymentStatus(invoiceId: string, status: 'paid' | 'cancelled' | 'refunded'): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('registrations')
      .update({ 
        payment_status: status,
        ...(status === 'paid' ? { due_date: null } : {})
      })
      .eq('invoice_id', invoiceId);

    if (error) {
      console.error('Error updating payment status:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error updating payment status:', error);
    return false;
  }
}