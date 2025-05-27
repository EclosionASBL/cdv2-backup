import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, CheckCircle, Clock, Search, Filter, FileText, XCircle, RefreshCw, AlertTriangle, Download } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

interface Invoice {
  id: string;
  invoice_number: string;
  user_id: string;
  amount: number;
  status: string;
  due_date: string | null;
  created_at: string;
  paid_at: string | null;
  pdf_url: string | null;
  communication: string;
  registration_ids: string[];
  user: {
    email: string;
    prenom: string;
    nom: string;
  };
}

const AdminPaymentsPage = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'paid' | 'pending'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [processingInvoiceId, setProcessingInvoiceId] = useState<string | null>(null);

  useEffect(() => {
    fetchInvoices();
  }, []);

  const fetchInvoices = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          user:user_id(
            email,
            prenom,
            nom
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (err: any) {
      console.error('Error fetching invoices:', err);
      setError(err.message || 'Une erreur est survenue lors du chargement des factures.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkAsPaid = async (invoiceId: string) => {
    try {
      setProcessingInvoiceId(invoiceId);
      
      // Update invoice status
      const now = new Date().toISOString();
      const { error: invoiceError } = await supabase
        .from('invoices')
        .update({ 
          status: 'paid',
          paid_at: now
        })
        .eq('id', invoiceId);

      if (invoiceError) throw invoiceError;

      // Get registration IDs for this invoice
      const { data: invoice } = await supabase
        .from('invoices')
        .select('registration_ids')
        .eq('id', invoiceId)
        .single();

      if (invoice && invoice.registration_ids) {
        // Update registrations payment status
        const { error: regError } = await supabase
          .from('registrations')
          .update({ 
            payment_status: 'paid',
            due_date: null
          })
          .in('id', invoice.registration_ids);

        if (regError) throw regError;
      }

      toast.success('Paiement marqué comme reçu');
      fetchInvoices(); // Refresh the list
    } catch (error: any) {
      console.error('Error marking as paid:', error);
      toast.error('Erreur lors de la mise à jour du statut');
    } finally {
      setProcessingInvoiceId(null);
    }
  };

  const handleSendReminder = async (invoiceId: string) => {
    try {
      setProcessingInvoiceId(invoiceId);
      
      // Get registration IDs for this invoice
      const { data: invoice } = await supabase
        .from('invoices')
        .select('registration_ids')
        .eq('id', invoiceId)
        .single();

      if (invoice && invoice.registration_ids) {
        // Update registrations reminder status
        const { error: regError } = await supabase
          .from('registrations')
          .update({ 
            reminder_sent: true
          })
          .in('id', invoice.registration_ids);

        if (regError) throw regError;
      }

      toast.success('Rappel envoyé avec succès');
      fetchInvoices(); // Refresh the list
    } catch (error: any) {
      console.error('Error sending reminder:', error);
      toast.error('Erreur lors de l\'envoi du rappel');
    } finally {
      setProcessingInvoiceId(null);
    }
  };

  const handleExportCSV = () => {
    try {
      setIsExporting(true);
      
      // Filter invoices based on current filter
      const filteredData = invoices.filter(inv => {
        if (filter === 'all') return true;
        if (filter === 'paid') return inv.status === 'paid';
        if (filter === 'pending') return inv.status === 'pending';
        return true;
      });
      
      // Create CSV content
      const headers = [
        'Numéro de facture',
        'Date de création',
        'Parent',
        'Email',
        'Montant',
        'Statut',
        'Date d\'échéance',
        'Communication'
      ];
      
      const rows = filteredData.map(inv => [
        inv.invoice_number,
        new Date(inv.created_at).toLocaleDateString('fr-FR'),
        `${inv.user.prenom} ${inv.user.nom}`,
        inv.user.email,
        `${inv.amount} €`,
        inv.status === 'paid' ? 'Payé' : inv.status === 'cancelled' ? 'Annulé' : 'En attente',
        inv.due_date ? new Date(inv.due_date).toLocaleDateString('fr-FR') : '-',
        inv.communication
      ]);
      
      // Combine headers and rows
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');
      
      // Create and download the file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `factures_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('Export CSV réussi');
    } catch (err: any) {
      console.error('Error exporting CSV:', err);
      toast.error('Erreur lors de l\'export CSV');
    } finally {
      setIsExporting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    if (status === 'paid') {
      return <CheckCircle className="h-4 w-4 text-green-500 mr-1" />;
    } else if (status === 'cancelled') {
      return <XCircle className="h-4 w-4 text-red-500 mr-1" />;
    } else {
      // pending
      return <Clock className="h-4 w-4 text-yellow-500 mr-1" />;
    }
  };

  const getStatusText = (status: string) => {
    if (status === 'paid') {
      return 'Payé';
    } else if (status === 'cancelled') {
      return 'Annulé';
    } else {
      // pending
      return 'En attente';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  // Filter and search invoices
  const filteredInvoices = invoices
    .filter(inv => {
      if (filter === 'all') return true;
      if (filter === 'paid') return inv.status === 'paid';
      if (filter === 'pending') return inv.status === 'pending';
      return true;
    })
    .filter(inv => {
      if (!searchTerm) return true;
      const searchLower = searchTerm.toLowerCase();
      return (
        inv.invoice_number?.toLowerCase().includes(searchLower) ||
        inv.user?.email?.toLowerCase().includes(searchLower) ||
        inv.user?.prenom?.toLowerCase().includes(searchLower) ||
        inv.user?.nom?.toLowerCase().includes(searchLower) ||
        inv.communication?.toLowerCase().includes(searchLower)
      );
    });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestion des paiements</h1>
          <p className="text-gray-600">Suivez et gérez les paiements des inscriptions</p>
        </div>
        
        <div className="flex space-x-3">
          <button
            onClick={handleExportCSV}
            disabled={isExporting}
            className="btn-outline flex items-center"
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            Exporter CSV
          </button>
          <button
            onClick={fetchInvoices}
            className="btn-primary flex items-center"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualiser
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
        <div className="relative flex-grow">
          <input
            type="text"
            placeholder="Rechercher..."
            className="form-input pl-10 pr-4 py-2 w-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
        </div>
        
        <div className="flex items-center space-x-2">
          <Filter className="h-5 w-5 text-gray-500" />
          <select
            className="form-input py-2"
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
          >
            <option value="all">Tous</option>
            <option value="paid">Payés</option>
            <option value="pending">En attente</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      ) : error ? (
        <div className="bg-red-50 p-4 rounded-lg">
          <p className="text-red-700">{error}</p>
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-8 text-center">
          <p className="text-gray-600 mb-4">
            {searchTerm || filter !== 'all'
              ? 'Aucune facture ne correspond à vos critères.'
              : 'Aucune facture trouvée.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Numéro de facture
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Parent
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Montant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Communication
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Échéance
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredInvoices.map((invoice) => {
                  // Check if due date is passed
                  const isDueDatePassed = invoice.due_date && new Date(invoice.due_date) < new Date();
                  
                  return (
                    <tr key={invoice.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {invoice.invoice_number}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {new Date(invoice.created_at).toLocaleDateString('fr-FR')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {invoice.user.prenom} {invoice.user.nom}
                        </div>
                        <div className="text-sm text-gray-500">
                          {invoice.user.email}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {invoice.amount} €
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-mono text-gray-500">
                          {invoice.communication}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          getStatusColor(invoice.status)
                        }`}>
                          {getStatusIcon(invoice.status)}
                          {getStatusText(invoice.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {invoice.due_date ? (
                          <div className={`text-sm ${isDueDatePassed ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                            {new Date(invoice.due_date).toLocaleDateString('fr-FR')}
                            {isDueDatePassed && ' (dépassée)'}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500">-</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          {invoice.status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleMarkAsPaid(invoice.id)}
                                disabled={processingInvoiceId === invoice.id}
                                className="text-green-600 hover:text-green-900"
                                title="Marquer comme payé"
                              >
                                {processingInvoiceId === invoice.id ? (
                                  <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                  <CheckCircle className="h-5 w-5" />
                                )}
                              </button>
                              
                              <button
                                onClick={() => handleSendReminder(invoice.id)}
                                disabled={processingInvoiceId === invoice.id}
                                className="text-blue-600 hover:text-blue-900"
                                title="Envoyer un rappel"
                              >
                                <FileText className="h-5 w-5" />
                              </button>
                            </>
                          )}
                          
                          {invoice.pdf_url && (
                            <a
                              href={invoice.pdf_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-gray-600 hover:text-gray-900"
                              title="Voir la facture"
                            >
                              <FileText className="h-5 w-5" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <Toaster position="top-right" />
    </div>
  );
};

export default AdminPaymentsPage;