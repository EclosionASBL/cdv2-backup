import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Loader2, AlertCircle, Filter, Search, RefreshCw, 
  Download, Upload, Mail, Trash2, CheckCircle, X, 
  Calendar, User, ArrowUpDown
} from 'lucide-react';
import { Dialog } from '@headlessui/react';
import toast, { Toaster } from 'react-hot-toast';
import clsx from 'clsx';

interface Subscriber {
  id: string;
  email: string;
  user_id: string | null;
  subscribed_at: string;
  source: string;
  active: boolean;
  unsubscribed_at: string | null;
  user?: {
    prenom: string | null;
    nom: string | null;
  };
}

const AdminNewsletterPage = () => {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<'email' | 'subscribed_at'>('subscribed_at');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedSubscriber, setSelectedSubscriber] = useState<Subscriber | null>(null);
  const [importEmails, setImportEmails] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    fetchSubscribers();
  }, [filter, sortField, sortDirection]);

  const fetchSubscribers = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      let query = supabase
        .from('newsletter_subscribers')
        .select(`
          *,
          user:user_id(
            prenom,
            nom
          )
        `);
      
      // Apply filter
      if (filter === 'active') {
        query = query.eq('active', true);
      } else if (filter === 'inactive') {
        query = query.eq('active', false);
      }
      
      // Apply sorting
      query = query.order(sortField, { ascending: sortDirection === 'asc' });
      
      const { data, error: fetchError } = await query;
      
      if (fetchError) throw fetchError;
      
      setSubscribers(data || []);
    } catch (err: any) {
      console.error('Error fetching subscribers:', err);
      setError(err.message || 'Une erreur est survenue lors du chargement des abonnés.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSort = (field: 'email' | 'subscribed_at') => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new field and default to descending
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleImport = async () => {
    if (!importEmails.trim()) {
      toast.error('Veuillez entrer au moins une adresse email');
      return;
    }
    
    setIsProcessing(true);
    
    try {
      // Parse emails (one per line or comma-separated)
      const emails = importEmails
        .split(/[\n,;]/)
        .map(email => email.trim())
        .filter(email => email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email));
      
      if (emails.length === 0) {
        toast.error('Aucune adresse email valide trouvée');
        return;
      }
      
      // Insert emails in batches
      const batchSize = 100;
      let successCount = 0;
      let errorCount = 0;
      
      for (let i = 0; i < emails.length; i += batchSize) {
        const batch = emails.slice(i, i + batchSize);
        
        const { data, error } = await supabase
          .from('newsletter_subscribers')
          .upsert(
            batch.map(email => ({
              email,
              source: 'import',
              active: true,
              unsubscribed_at: null
            })),
            { onConflict: 'email', ignoreDuplicates: false }
          );
        
        if (error) {
          console.error('Error importing batch:', error);
          errorCount += batch.length;
        } else {
          successCount += batch.length;
        }
      }
      
      toast.success(`${successCount} adresses email importées avec succès`);
      if (errorCount > 0) {
        toast.error(`${errorCount} adresses email n'ont pas pu être importées`);
      }
      
      setIsImportModalOpen(false);
      setImportEmails('');
      fetchSubscribers();
    } catch (err) {
      console.error('Error importing emails:', err);
      toast.error('Une erreur est survenue lors de l\'importation');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExport = () => {
    try {
      // Filter subscribers based on current filter
      const dataToExport = subscribers
        .filter(sub => {
          if (filter === 'active') return sub.active;
          if (filter === 'inactive') return !sub.active;
          return true;
        })
        .filter(sub => {
          if (!searchTerm) return true;
          const searchLower = searchTerm.toLowerCase();
          return (
            sub.email.toLowerCase().includes(searchLower) ||
            sub.user?.prenom?.toLowerCase().includes(searchLower) ||
            sub.user?.nom?.toLowerCase().includes(searchLower) ||
            sub.source.toLowerCase().includes(searchLower)
          );
        });
      
      // Create CSV content
      const headers = ['Email', 'Nom', 'Prénom', 'Date d\'inscription', 'Source', 'Statut'];
      const rows = dataToExport.map(sub => [
        sub.email,
        sub.user?.nom || '',
        sub.user?.prenom || '',
        new Date(sub.subscribed_at).toLocaleDateString('fr-FR'),
        sub.source,
        sub.active ? 'Actif' : 'Inactif'
      ]);
      
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\n');
      
      // Create and download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `newsletter_subscribers_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setIsExportModalOpen(false);
      toast.success('Export CSV réussi');
    } catch (err) {
      console.error('Error exporting CSV:', err);
      toast.error('Erreur lors de l\'export CSV');
    }
  };

  const handleDeleteSubscriber = async () => {
    if (!selectedSubscriber) return;
    
    setIsProcessing(true);
    
    try {
      const { error } = await supabase
        .from('newsletter_subscribers')
        .delete()
        .eq('id', selectedSubscriber.id);
      
      if (error) throw error;
      
      toast.success('Abonné supprimé avec succès');
      setIsDeleteModalOpen(false);
      setSelectedSubscriber(null);
      fetchSubscribers();
    } catch (err) {
      console.error('Error deleting subscriber:', err);
      toast.error('Erreur lors de la suppression');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleActive = async (subscriber: Subscriber) => {
    try {
      const { error } = await supabase
        .from('newsletter_subscribers')
        .update({
          active: !subscriber.active,
          unsubscribed_at: !subscriber.active ? null : new Date().toISOString()
        })
        .eq('id', subscriber.id);
      
      if (error) throw error;
      
      toast.success(subscriber.active 
        ? 'Abonné désactivé avec succès' 
        : 'Abonné réactivé avec succès');
      
      fetchSubscribers();
    } catch (err) {
      console.error('Error toggling subscriber status:', err);
      toast.error('Erreur lors de la mise à jour du statut');
    }
  };

  // Filter and search subscribers
  const filteredSubscribers = subscribers
    .filter(sub => {
      if (!searchTerm) return true;
      const searchLower = searchTerm.toLowerCase();
      return (
        sub.email.toLowerCase().includes(searchLower) ||
        sub.user?.prenom?.toLowerCase().includes(searchLower) ||
        sub.user?.nom?.toLowerCase().includes(searchLower) ||
        sub.source.toLowerCase().includes(searchLower)
      );
    });

  return (
    <div className="space-y-6">
      <Toaster position="top-right" />
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Gestion de la newsletter</h1>
          <p className="text-gray-600">Gérez les abonnés à votre newsletter</p>
        </div>
        
        <div className="flex space-x-3">
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="btn-outline flex items-center"
          >
            <Download className="h-4 w-4 mr-2" />
            Exporter CSV
          </button>
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="btn-outline flex items-center"
          >
            <Upload className="h-4 w-4 mr-2" />
            Importer
          </button>
          <button
            onClick={fetchSubscribers}
            disabled={isLoading}
            className="btn-primary flex items-center"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Actualiser
          </button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
        <div className="relative flex-grow">
          <input
            type="text"
            placeholder="Rechercher un abonné..."
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
            <option value="all">Tous les abonnés</option>
            <option value="active">Abonnés actifs</option>
            <option value="inactive">Abonnés inactifs</option>
          </select>
        </div>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      ) : error ? (
        <div className="bg-red-50 p-4 rounded-lg">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      ) : filteredSubscribers.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-8 text-center">
          <p className="text-gray-600 mb-4">
            {searchTerm || filter !== 'all'
              ? 'Aucun abonné ne correspond à vos critères.'
              : 'Aucun abonné à la newsletter.'}
          </p>
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="btn-primary inline-flex items-center"
          >
            <Upload className="h-4 w-4 mr-2" />
            Importer des abonnés
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    onClick={() => handleSort('email')}
                  >
                    <div className="flex items-center">
                      Email
                      {sortField === 'email' && (
                        <ArrowUpDown className="h-4 w-4 ml-1" />
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nom
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                    onClick={() => handleSort('subscribed_at')}
                  >
                    <div className="flex items-center">
                      Date d'abonnement
                      {sortField === 'subscribed_at' && (
                        <ArrowUpDown className="h-4 w-4 ml-1" />
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Source
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Statut
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredSubscribers.map((subscriber) => (
                  <tr key={subscriber.id} className={clsx(
                    "hover:bg-gray-50",
                    !subscriber.active && "bg-gray-50 text-gray-500"
                  )}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {subscriber.email}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {subscriber.user ? (
                        <div className="text-sm text-gray-900">
                          {subscriber.user.prenom} {subscriber.user.nom}
                          <div className="text-xs text-gray-500">Utilisateur inscrit</div>
                        </div>
                      ) : (
                        <div className="text-sm text-gray-500 italic">
                          Visiteur externe
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {new Date(subscriber.subscribed_at).toLocaleDateString('fr-FR')}
                      </div>
                      <div className="text-xs text-gray-500">
                        {new Date(subscriber.subscribed_at).toLocaleTimeString('fr-FR')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={clsx(
                        "px-2 inline-flex text-xs leading-5 font-semibold rounded-full",
                        subscriber.source === 'website' && "bg-blue-100 text-blue-800",
                        subscriber.source === 'profile' && "bg-green-100 text-green-800",
                        subscriber.source === 'import' && "bg-purple-100 text-purple-800",
                        subscriber.source === 'migration' && "bg-yellow-100 text-yellow-800"
                      )}>
                        {subscriber.source === 'website' && 'Site web'}
                        {subscriber.source === 'profile' && 'Profil utilisateur'}
                        {subscriber.source === 'import' && 'Import'}
                        {subscriber.source === 'migration' && 'Migration'}
                        {!['website', 'profile', 'import', 'migration'].includes(subscriber.source) && subscriber.source}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={clsx(
                        "px-2 inline-flex text-xs leading-5 font-semibold rounded-full",
                        subscriber.active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                      )}>
                        {subscriber.active ? 'Actif' : 'Inactif'}
                      </span>
                      {!subscriber.active && subscriber.unsubscribed_at && (
                        <div className="text-xs text-gray-500 mt-1">
                          Désinscrit le {new Date(subscriber.unsubscribed_at).toLocaleDateString('fr-FR')}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => handleToggleActive(subscriber)}
                          className={clsx(
                            "p-1 rounded-full",
                            subscriber.active 
                              ? "text-red-600 hover:text-red-900 hover:bg-red-100" 
                              : "text-green-600 hover:text-green-900 hover:bg-green-100"
                          )}
                          title={subscriber.active ? "Désactiver" : "Réactiver"}
                        >
                          {subscriber.active ? (
                            <X className="h-5 w-5" />
                          ) : (
                            <CheckCircle className="h-5 w-5" />
                          )}
                        </button>
                        <button
                          onClick={() => {
                            setSelectedSubscriber(subscriber);
                            setIsDeleteModalOpen(true);
                          }}
                          className="p-1 text-red-600 hover:text-red-900 hover:bg-red-100 rounded-full"
                          title="Supprimer"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Import Modal */}
      <Dialog
        open={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        className="fixed inset-0 z-50 overflow-y-auto"
      >
        <div className="flex min-h-screen items-center justify-center p-4">
          <Dialog.Overlay className="fixed inset-0 bg-black bg-opacity-30" />

          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-auto p-6">
            <Dialog.Title className="text-lg font-semibold mb-4">
              Importer des abonnés
            </Dialog.Title>

            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Entrez les adresses email à ajouter à la newsletter, une par ligne ou séparées par des virgules.
              </p>

              <textarea
                value={importEmails}
                onChange={(e) => setImportEmails(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                rows={10}
                placeholder="exemple@email.com, exemple2@email.com..."
              />

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="btn-outline"
                  disabled={isProcessing}
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={isProcessing || !importEmails.trim()}
                  className="btn-primary"
                >
                  {isProcessing ? (
                    <span className="flex items-center">
                      <Loader2 className="animate-spin mr-2 h-4 w-4" />
                      Importation...
                    </span>
                  ) : (
                    'Importer'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </Dialog>

      {/* Export Modal */}
      <Dialog
        open={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        className="fixed inset-0 z-50 overflow-y-auto"
      >
        <div className="flex min-h-screen items-center justify-center p-4">
          <Dialog.Overlay className="fixed inset-0 bg-black bg-opacity-30" />

          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-auto p-6">
            <Dialog.Title className="text-lg font-semibold mb-4">
              Exporter les abonnés
            </Dialog.Title>

            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                Vous êtes sur le point d'exporter {filteredSubscribers.length} abonnés au format CSV.
              </p>

              <div className="bg-yellow-50 p-4 rounded-lg">
                <div className="flex">
                  <AlertCircle className="h-5 w-5 text-yellow-500 mr-2 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-yellow-700">
                    Assurez-vous de respecter le RGPD lors de l'utilisation de ces données.
                  </p>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsExportModalOpen(false)}
                  className="btn-outline"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleExport}
                  className="btn-primary"
                >
                  Exporter CSV
                </button>
              </div>
            </div>
          </div>
        </div>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog
        open={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        className="fixed inset-0 z-50 overflow-y-auto"
      >
        <div className="flex min-h-screen items-center justify-center p-4">
          <Dialog.Overlay className="fixed inset-0 bg-black bg-opacity-30" />

          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-auto p-6">
            <div className="flex items-center mb-4">
              <div className="bg-red-100 rounded-full p-2 mr-3">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <Dialog.Title className="text-lg font-semibold">
                Confirmer la suppression
              </Dialog.Title>
            </div>

            {selectedSubscriber && (
              <div className="space-y-4">
                <p className="text-gray-600">
                  Êtes-vous sûr de vouloir supprimer définitivement cet abonné de la newsletter ?
                </p>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="font-medium">{selectedSubscriber.email}</p>
                  {selectedSubscriber.user && (
                    <p className="text-sm text-gray-600">
                      {selectedSubscriber.user.prenom} {selectedSubscriber.user.nom}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Abonné depuis le {new Date(selectedSubscriber.subscribed_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
                
                <div className="bg-yellow-50 p-4 rounded-lg">
                  <div className="flex">
                    <AlertCircle className="h-5 w-5 text-yellow-500 mr-2 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-yellow-700">
                      Cette action est irréversible. L'abonné sera définitivement supprimé de la base de données.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsDeleteModalOpen(false)}
                    className="btn-outline"
                    disabled={isProcessing}
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteSubscriber}
                    disabled={isProcessing}
                    className="btn-primary bg-red-600 hover:bg-red-700"
                  >
                    {isProcessing ? (
                      <span className="flex items-center">
                        <Loader2 className="animate-spin mr-2 h-4 w-4" />
                        Suppression...
                      </span>
                    ) : (
                      'Supprimer définitivement'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default AdminNewsletterPage;