import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Database } from '../../lib/database.types';
import { Search, Filter, Download, Link, Unlink, Eye, FileText, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';

type BankTransaction = Database['public']['Tables']['bank_transactions']['Row'];
type Invoice = Database['public']['Tables']['invoices']['Row'];

interface BankTransactionWithInvoice extends BankTransaction {
  invoice?: Invoice;
}

const AdminBankTransactionsPage: React.FC = () => {
  const [transactions, setTransactions] = useState<BankTransactionWithInvoice[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedTransaction, setSelectedTransaction] = useState<BankTransaction | null>(null);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('');
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    fetchTransactions();
    fetchInvoices();
  }, []);

  const fetchTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('bank_transactions')
        .select(`
          *,
          invoice:invoices(*)
        `)
        .order('transaction_date', { ascending: false });

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchInvoices = async () => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (error) {
      console.error('Error fetching invoices:', error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const { data, error } = await supabase.functions.invoke('process-csv-file', {
        body: formData,
      });

      if (error) throw error;

      alert('File imported successfully!');
      fetchTransactions();
    } catch (error) {
      console.error('Error importing file:', error);
      alert('Error importing file. Please try again.');
    } finally {
      setImporting(false);
      // Reset the input
      event.target.value = '';
    }
  };

  const handleLinkToInvoice = async () => {
    if (!selectedTransaction || !selectedInvoiceId) return;

    try {
      // Convert selectedInvoiceId to UUID if it's a string
      const invoiceUuid = selectedInvoiceId;
      
      const { error } = await supabase
        .from('bank_transactions')
        .update({ 
          invoice_id: invoiceUuid,
          status: 'matched'
        })
        .eq('id', selectedTransaction.id);

      if (error) throw error;

      setShowLinkModal(false);
      setSelectedTransaction(null);
      setSelectedInvoiceId('');
      fetchTransactions();
      alert('Transaction linked to invoice successfully!');
    } catch (error) {
      console.error('Error linking transaction to invoice:', error);
      alert('Error linking transaction to invoice. Please try again.');
    }
  };

  const handleUnlinkFromInvoice = async (transactionId: string) => {
    try {
      const { error } = await supabase
        .from('bank_transactions')
        .update({ 
          invoice_id: null,
          status: 'unmatched'
        })
        .eq('id', transactionId);

      if (error) throw error;

      fetchTransactions();
      alert('Transaction unlinked from invoice successfully!');
    } catch (error) {
      console.error('Error unlinking transaction:', error);
      alert('Error unlinking transaction. Please try again.');
    }
  };

  const handleStatusChange = async (transactionId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('bank_transactions')
        .update({ status: newStatus })
        .eq('id', transactionId);

      if (error) throw error;

      fetchTransactions();
    } catch (error) {
      console.error('Error updating transaction status:', error);
      alert('Error updating transaction status. Please try again.');
    }
  };

  const filteredTransactions = transactions.filter(transaction => {
    const matchesSearch = 
      transaction.communication?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.account_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.counterparty_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transaction.extracted_invoice_number?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || transaction.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'matched':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'partially_matched':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'overpaid':
        return <AlertCircle className="h-4 w-4 text-blue-500" />;
      case 'ignored':
        return <XCircle className="h-4 w-4 text-gray-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'matched':
        return 'bg-green-100 text-green-800';
      case 'partially_matched':
        return 'bg-yellow-100 text-yellow-800';
      case 'overpaid':
        return 'bg-blue-100 text-blue-800';
      case 'ignored':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-red-100 text-red-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Bank Transactions</h1>
        <p className="text-gray-600">Manage and reconcile bank transactions with invoices</p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-4 flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search transactions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
              >
                <option value="all">All Status</option>
                <option value="unmatched">Unmatched</option>
                <option value="matched">Matched</option>
                <option value="partially_matched">Partially Matched</option>
                <option value="overpaid">Overpaid</option>
                <option value="ignored">Ignored</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            <label className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 cursor-pointer">
              <Download className="h-4 w-4" />
              {importing ? 'Importing...' : 'Import CSV'}
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                disabled={importing}
              />
            </label>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Communication
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Account
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invoice
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTransactions.map((transaction) => (
                <tr key={transaction.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {format(new Date(transaction.transaction_date), 'dd/MM/yyyy')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    €{Number(transaction.amount).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                    {transaction.communication || '-'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                    {transaction.account_name || transaction.counterparty_name || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(transaction.status)}
                      <select
                        value={transaction.status}
                        onChange={(e) => handleStatusChange(transaction.id, e.target.value)}
                        className={`text-xs px-2 py-1 rounded-full border-0 ${getStatusColor(transaction.status)}`}
                      >
                        <option value="unmatched">Unmatched</option>
                        <option value="matched">Matched</option>
                        <option value="partially_matched">Partially Matched</option>
                        <option value="overpaid">Overpaid</option>
                        <option value="ignored">Ignored</option>
                      </select>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {transaction.invoice ? (
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-500" />
                        <span>{transaction.invoice.invoice_number}</span>
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center gap-2">
                      {transaction.invoice_id ? (
                        <button
                          onClick={() => handleUnlinkFromInvoice(transaction.id)}
                          className="text-red-600 hover:text-red-900 flex items-center gap-1"
                        >
                          <Unlink className="h-4 w-4" />
                          Unlink
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setSelectedTransaction(transaction);
                            setShowLinkModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-900 flex items-center gap-1"
                        >
                          <Link className="h-4 w-4" />
                          Link
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredTransactions.length === 0 && (
          <div className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No transactions found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your search or filter criteria.'
                : 'Import a CSV file to get started.'
              }
            </p>
          </div>
        )}
      </div>

      {/* Link to Invoice Modal */}
      {showLinkModal && selectedTransaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Link Transaction to Invoice
            </h3>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-2">Transaction Details:</p>
              <div className="bg-gray-50 p-3 rounded-lg text-sm">
                <p><strong>Date:</strong> {format(new Date(selectedTransaction.transaction_date), 'dd/MM/yyyy')}</p>
                <p><strong>Amount:</strong> €{Number(selectedTransaction.amount).toFixed(2)}</p>
                <p><strong>Communication:</strong> {selectedTransaction.communication || '-'}</p>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Invoice
              </label>
              <select
                value={selectedInvoiceId}
                onChange={(e) => setSelectedInvoiceId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select an invoice...</option>
                {invoices
                  .filter(invoice => invoice.status === 'pending')
                  .map((invoice) => (
                    <option key={invoice.id} value={invoice.id}>
                      {invoice.invoice_number} - €{Number(invoice.amount).toFixed(2)} - {invoice.communication}
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowLinkModal(false);
                  setSelectedTransaction(null);
                  setSelectedInvoiceId('');
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleLinkToInvoice}
                disabled={!selectedInvoiceId}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Link Transaction
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminBankTransactionsPage;