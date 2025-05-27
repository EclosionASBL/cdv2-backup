import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, Search, Filter, CheckCircle, Clock, FileText, RefreshCw, XCircle, Download } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

interface Registration {
  id: string;
  created_at: string;
  user_id: string;
  kid_id: string;
  activity_id: string;
  payment_status: string;
  amount_paid: number;
  price_type: string;
  invoice_id: string;
  due_date: string | null;
  reminder_sent: boolean;
  user: {
    email: string;
    prenom: string;
    nom: string;
  };
  kid: {
    prenom: string;
    nom: string;
  };
  session: {
    stage: {
      title: string;
    };
    start_date: string;
    end_date: string;
  };
}

const AdminPaymentsPage = () => {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'paid' | 'pending'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    fetchRegistrations();
  }, []);

  const fetchRegistrations = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('registrations')
        .select(`
          *,
          user:user_id(email, prenom, nom),
          kid:kid_id(prenom, nom),
          session:activity_id(
            stage:stage_id(title),
            start_date,
            end_date
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRegistrations(data || []);
    } catch (err: any) {
      console.error('Error fetching registrations:', err);
      setError(err.message || 'Une erreur est survenue lors du chargement des inscriptions.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendReminder = async (id: string) => {
    try {
      // Update the reminder_sent flag
      const { error } = await supabase
        .from('registrations')
        .update({ reminder_sent: true })
        .eq('id', id);

      if (error) throw error;

      // Update local state
      setRegistrations(prev => 
        prev.map(reg => 
          reg.id === id ? { ...reg, reminder_sent: true } : reg
        )
      );

      toast.success('Rappel envoyé avec succès');
    } catch (err: any) {
      console.error('Error sending reminder:', err);
      toast.error('Erreur lors de l\'envoi du rappel');
    }
  };

  const handleMarkAsPaid = async (invoiceId: string) => {
    try {
      // Update the payment status
      const { error } = await supabase
        .from('registrations')
        .update({ 
          payment_status: 'paid',
          due_date: null
        })
        .eq('invoice_id', invoiceId);

      if (error) throw error;

      // Update local state
      setRegistrations(prev => 
        prev.map(reg => 
          reg.invoice_id === invoiceId 
            ? { ...reg, payment_status: 'paid', due_date: null } 
            : reg
        )
      );

      toast.success('Paiement marqué comme reçu');
    } catch (err: any) {
      console.error('Error marking as paid:', err);
      toast.error('Erreur lors de la mise à jour du statut');
    }
  };

  const handleExportCSV = () => {
    try {
      setIsExporting(true);
      
      // Filter registrations based on current filter
      const filteredData = registrations.filter(reg => {
        if (filter === 'all') return true;
        if (filter === 'paid') return reg.payment_status === 'paid';
        if (filter === 'pending') return reg.payment_status === 'pending';
        return true;
      });
      
      // Create CSV content
      const headers = [
        'ID Facture',
        'Date de création',
        'Parent',
        'Email',
        'Enfant',
        'Activité',
        'Dates',
        'Montant',
        'Statut',
        'Date d\'échéance'
      ];
      
      const rows = filteredData.map(reg => [
        reg.invoice_id,
        new Date(reg.created_at).toLocaleDateString('fr-FR'),
        `${reg.user.prenom} ${reg.user.nom}`,
        reg.user.email,
        `${reg.kid.prenom} ${reg.kid.nom}`,
        reg.session.stage.title,
        `${new Date(reg.session.start_date).toLocaleDateString('fr-FR')} - ${new Date(reg.session.end_date).toLocaleDateString('fr-FR')}`,
        `${reg.amount_paid} €`,
        reg.payment_status === 'paid' ? 'Payé' : 'En attente',
        reg.due_date ? new Date(reg.due_date).toLocaleDateString('fr-FR') : '-'
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
      link.setAttribute('download', `paiements_${new Date().toISOString().split('T')[0]}.csv`);
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

  const getPaymentStatusIcon = (status: string) => {
    if (status === 'paid') {
      return <CheckCircle className="h-4 w-4 text-green-500 mr-1" />;
    } else if (status === 'cancelled') {
      return <XCircle className="h-4 w-4 text-red-500 mr-1" />;
    } else if (status === 'refunded') {
      return <RefreshCw className="h-4 w-4 text-blue-500 mr-1" />;
    } else {
      // pending
      return <Clock className="h-4 w-4 text-yellow-500 mr-1" />;
    }
  };

  const getPaymentStatusText = (status: string) => {
    if (status === 'paid') {
      return 'Payé';
    } else if (status === 'cancelled') {
      return 'Annulé';
    } else if (status === 'refunded') {
      return 'Remboursé';
    } else {
      // pending
      return 'En attente';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'refunded':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  // Filter and search registrations
  const filteredRegistrations = registrations
    .filter(reg => {
      if (filter === 'all') return true;
      if (filter === 'paid') return reg.payment_status === 'paid';
      if (filter === 'pending') return reg.payment_status === 'pending';
      return true;
    })
    .filter(reg => {
      if (!searchTerm) return true;
      const searchLower = searchTerm.toLowerCase();
      return (
        reg.invoice_id?.toLowerCase().includes(searchLower) ||
        reg.user?.email?.toLowerCase().includes(searchLower) ||
        reg.user?.prenom?.toLowerCase().includes(searchLower) ||
        reg.user?.nom?.toLowerCase().includes(searchLower) ||
        reg.kid?.prenom?.toLowerCase().includes(searchLower) ||
        reg.kid?.nom?.toLowerCase().includes(searchLower) ||
        reg.session?.stage?.title?.toLowerCase().includes(searchLower)
      );
    });

  // Group registrations by invoice_id
  const groupedRegistrations = filteredRegistrations.reduce((acc, reg) => {
    if (!acc[reg.invoice_id]) {
      acc[reg.invoice_id] = [];
    }
    acc[reg.invoice_id].push(reg);
    return acc;
  }, {} as Record<string, Registration[]>);

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
            onClick={fetchRegistrations}
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
      ) : Object.keys(groupedRegistrations).length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-8 text-center">
          <p className="text-gray-600 mb-4">
            {searchTerm || filter !== 'all'
              ? 'Aucune inscription ne correspond à vos critères.'
              : 'Aucune inscription trouvée.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Facture
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Parent
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Inscriptions
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Montant
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
                {Object.entries(groupedRegistrations).map(([invoiceId, regs]) => {
                  // Use the first registration for common data
                  const firstReg = regs[0];
                  // Calculate total amount for this invoice
                  const totalAmount = regs.reduce((sum, reg) => sum + reg.amount_paid, 0);
                  // Check if any registration in this invoice is already paid
                  const isPaid = regs.some(reg => reg.payment_status === 'paid');
                  // Check if reminder has been sent
                  const reminderSent = regs.some(reg => reg.reminder_sent);
                  // Check if due date is passed
                  const isDueDatePassed = firstReg.due_date && new Date(firstReg.due_date) < new Date();
                  
                  return (
                    <tr key={invoiceId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {invoiceId}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {new Date(firstReg.created_at).toLocaleDateString('fr-FR')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {firstReg.user.prenom} {firstReg.user.nom}
                        </div>
                        <div className="text-sm text-gray-500">
                          {firstReg.user.email}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {regs.map((reg, index) => (
                            <div key={reg.id} className={index > 0 ? 'mt-1' : ''}>
                              {reg.session.stage.title} ({reg.kid.prenom})
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {totalAmount} €
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          getPaymentStatusColor(firstReg.payment_status)
                        }`}>
                          {getPaymentStatusIcon(firstReg.payment_status)}
                          {getPaymentStatusText(firstReg.payment_status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {firstReg.due_date ? (
                          <div className={`text-sm ${isDueDatePassed ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
                            {new Date(firstReg.due_date).toLocaleDateString('fr-FR')}
                            {isDueDatePassed && ' (dépassée)'}
                          </div>
                        ) : (
                          <div className="text-sm text-gray-500">-</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          {!isPaid && (
                            <>
                              <button
                                onClick={() => handleMarkAsPaid(invoiceId)}
                                className="text-green-600 hover:text-green-900"
                                title="Marquer comme payé"
                              >
                                <CheckCircle className="h-5 w-5" />
                              </button>
                              
                              {!reminderSent && (
                                <button
                                  onClick={() => handleSendReminder(regs[0].id)}
                                  className="text-blue-600 hover:text-blue-900"
                                  title="Envoyer un rappel"
                                >
                                  <FileText className="h-5 w-5" />
                                </button>
                              )}
                            </>
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