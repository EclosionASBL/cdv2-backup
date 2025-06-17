import { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import { Loader2, AlertCircle, RefreshCw, Download, ExternalLink } from 'lucide-react';
import clsx from 'clsx';

interface Transaction {
  id: string;
  transaction_date: string;
  amount: number;
  status: string;
  communication: string;
  movement_number: string;
  counterparty_name: string | null;
}

interface CreditNote {
  id: string;
  credit_note_number: string;
  amount: number;
  created_at: string;
  type: 'cancellation' | 'overpayment';
  pdf_url: string | null;
}

interface PaymentSummary {
  success: boolean;
  error?: string;
  invoice_number: string;
  invoice_amount: number;
  total_payments: number;
  transaction_count: number;
  status: string;
  balance: number;
  transactions: Transaction[];
  credit_notes: CreditNote[];
}

interface InvoicePaymentSummaryProps {
  invoiceNumber: string;
  onClose?: () => void;
}

const InvoicePaymentSummary = ({ invoiceNumber, onClose }: InvoicePaymentSummaryProps) => {
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isReconciling, setIsReconciling] = useState(false);

  useEffect(() => {
    if (invoiceNumber) {
      fetchPaymentSummary();
    }
  }, [invoiceNumber]);

  const fetchPaymentSummary = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const { data, error } = await supabase.rpc(
        'get_invoice_payment_summary',
        { p_invoice_number: invoiceNumber }
      );
      
      if (error) throw error;
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch payment summary');
      }
      
      setSummary(data);
    } catch (err: any) {
      console.error('Error fetching payment summary:', err);
      setError(err.message || 'An error occurred while fetching payment summary');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReconcile = async () => {
    try {
      setIsReconciling(true);
      
      const { data, error } = await supabase.rpc(
        'reconcile_invoice',
        { p_invoice_number: invoiceNumber }
      );
      
      if (error) throw error;
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to reconcile invoice');
      }
      
      // Refresh the summary
      fetchPaymentSummary();
    } catch (err: any) {
      console.error('Error reconciling invoice:', err);
      setError(err.message || 'An error occurred while reconciling the invoice');
    } finally {
      setIsReconciling(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Payée
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            En attente
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            Annulée
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {status}
          </span>
        );
    }
  };

  const getTransactionStatusBadge = (status: string) => {
    switch (status) {
      case 'matched':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Associée
          </span>
        );
      case 'partially_matched':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            Partielle
          </span>
        );
      case 'overpaid':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            Surpayée
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {status}
          </span>
        );
    }
  };

  const getCreditNoteTypeBadge = (type: string) => {
    switch (type) {
      case 'cancellation':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            Annulation
          </span>
        );
      case 'overpayment':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            Surpaiement
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {type}
          </span>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 p-4 rounded-lg">
        <div className="flex">
          <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
          <div>
            <p className="text-red-700">{error}</p>
            <button
              onClick={fetchPaymentSummary}
              className="mt-2 text-sm text-red-700 hover:text-red-900 font-medium"
            >
              Réessayer
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="bg-gray-50 p-4 rounded-lg text-center">
        <p className="text-gray-600">Aucune information disponible</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary header */}
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-medium">Récapitulatif des paiements</h3>
          <p className="text-sm text-gray-500">Facture {summary.invoice_number}</p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={handleReconcile}
            disabled={isReconciling}
            className="btn-outline py-1 px-3 text-sm flex items-center"
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isReconciling ? 'animate-spin' : ''}`} />
            Réconcilier
          </button>
          <button
            onClick={fetchPaymentSummary}
            disabled={isLoading}
            className="btn-outline py-1 px-3 text-sm flex items-center"
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
        </div>
      </div>

      {/* Payment summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-50 p-4 rounded-lg">
          <p className="text-sm text-gray-500 mb-1">Montant facture</p>
          <p className="text-xl font-semibold">{formatCurrency(summary.invoice_amount)}</p>
        </div>
        
        <div className="bg-gray-50 p-4 rounded-lg">
          <p className="text-sm text-gray-500 mb-1">Total payé</p>
          <p className="text-xl font-semibold text-green-600">{formatCurrency(summary.total_payments)}</p>
          <p className="text-xs text-gray-500">{summary.transaction_count} transaction(s)</p>
        </div>
        
        <div className={clsx(
          "p-4 rounded-lg",
          summary.balance > 0 ? "bg-yellow-50" : 
          summary.balance < 0 ? "bg-blue-50" : "bg-green-50"
        )}>
          <p className="text-sm text-gray-500 mb-1">Solde</p>
          <p className={clsx(
            "text-xl font-semibold",
            summary.balance > 0 ? "text-yellow-600" : 
            summary.balance < 0 ? "text-blue-600" : "text-green-600"
          )}>
            {formatCurrency(Math.abs(summary.balance))}
          </p>
          <p className="text-xs text-gray-500">
            {summary.balance > 0 ? "Reste à payer" : 
             summary.balance < 0 ? "Surpayé" : "Payé intégralement"}
          </p>
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center">
        <p className="text-sm text-gray-500 mr-2">Statut:</p>
        {getStatusBadge(summary.status)}
      </div>

      {/* Transactions */}
      {summary.transactions.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Transactions associées</h4>
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Montant
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Communication
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Statut
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {summary.transactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(transaction.transaction_date)}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatCurrency(transaction.amount)}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-500 max-w-xs truncate">
                      {transaction.communication || <span className="italic text-gray-400">-</span>}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {getTransactionStatusBadge(transaction.status)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Credit Notes */}
      {summary.credit_notes && summary.credit_notes.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">Notes de crédit</h4>
          <div className="space-y-2">
            {summary.credit_notes.map((note) => (
              <div key={note.id} className="bg-blue-50 p-3 rounded-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-medium">{note.credit_note_number}</p>
                    <p className="text-xs text-gray-600">{formatDate(note.created_at)}</p>
                    <div className="mt-1">
                      {getCreditNoteTypeBadge(note.type)}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{formatCurrency(note.amount)}</p>
                    {note.pdf_url && (
                      <a 
                        href={note.pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary-600 hover:text-primary-800 flex items-center justify-end mt-1"
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Télécharger
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoicePaymentSummary;