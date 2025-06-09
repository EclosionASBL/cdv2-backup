import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useWaitingListStore } from '../../stores/waitingListStore';
import { useCartStore } from '../../stores/cartStore';
import { useRegistrationStore } from '../../stores/registrationStore';
import { useAuthStore } from '../../stores/authStore';
import { useActivityStore } from '../../stores/activityStore'; // Import useActivityStore
import { Loader2, CheckCircle, Clock, ArrowLeft, Filter, Search, FileText, XCircle, RefreshCw, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';
import toast, { Toaster } from 'react-hot-toast';

interface Registration {
  id: string;
  payment_status: string;
  amount_paid: number;
  created_at: string;
  kid_id: string;
  activity_id: string;
  price_type: string;
  reduced_declaration: boolean;
  invoice_id: string | null;
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
    center: {
      name: string;
    };
  };
}

const RegistrationsPage = () => {
  const navigate = useNavigate();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'paid' | 'pending'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [processingEntry, setProcessingEntry] = useState<string | null>(null);
  
  const { 
    entries: waitingListEntries, 
    fetchWaitingList, 
    isLoading: isWaitingListLoading,
    removeFromWaitingList,
    markEntryConverted
  } = useWaitingListStore();
  
  const { addItem } = useCartStore();
  const { fetchRegistrations } = useRegistrationStore();
  const { clearRegistrationNotification } = useAuthStore();
  const { getPrice } = useActivityStore(); // Get the getPrice function
  
  useEffect(() => {
    fetchDetailedRegistrations();
    fetchWaitingList();
    fetchRegistrations(); // Also fetch simplified registrations for the store
    
    // Clear notification when this page is visited
    clearRegistrationNotification();
  }, [fetchWaitingList, fetchRegistrations, clearRegistrationNotification]);
  
  const fetchDetailedRegistrations = async () => {
    try {
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('registrations')
        .select(`
          id,
          payment_status,
          amount_paid,
          created_at,
          kid_id,
          activity_id,
          price_type,
          reduced_declaration,
          invoice_id,
          kid:kids(
            prenom,
            nom,
            cpostal,
            ecole
          ),
          session:activity_id(
            stage:stage_id(
              title
            ),
            start_date,
            end_date,
            center:center_id(
              name
            ),
            prix_normal,
            prix_reduit,
            prix_local,
            prix_local_reduit,
            tarif_condition_id
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      setRegistrations(data || []);
    } catch (err) {
      console.error('Error fetching registrations:', err);
      setError('Une erreur est survenue lors du chargement des inscriptions.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelWaitingList = async (id: string) => {
    try {
      setProcessingEntry(id);
      await removeFromWaitingList(id);
      toast.success("Retiré de la liste d'attente");
    } catch (error) {
      console.error("Error removing from waiting list:", error);
      toast.error("Une erreur est survenue");
    } finally {
      setProcessingEntry(null);
    }
  };

  const handleValidateWaitingList = async (entry: any) => {
    if (processingEntry) return; // Prevent double-clicks
    
    try {
      setProcessingEntry(entry.id);
      
      // Check if the entry is still valid
      const { data: currentEntry, error: checkError } = await supabase
        .from('waiting_list')
        .select('*')
        .eq('id', entry.id)
        .eq('status', 'invited')
        .single();
      
      if (checkError || !currentEntry) {
        toast.error("Cette invitation n'est plus valide");
        return;
      }
      
      // Check if the entry has expired
      if (currentEntry.expires_at && new Date(currentEntry.expires_at) < new Date()) {
        toast.error("Cette invitation a expiré");
        return;
      }
      
      // Mark the waiting list entry as converted
      await markEntryConverted(entry.id);
      
      // Get session details for cart
      const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select(`
          id,
          stage:stages!stage_id(title, image_url),
          start_date,
          end_date,
          prix_normal,
          prix_reduit,
          prix_local,
          prix_local_reduit,
          tarif_condition_id
        `)
        .eq('id', entry.activity_id)
        .single();
      
      if (sessionError || !sessionData) {
        toast.error("Erreur lors de la récupération des informations de l'activité");
        return;
      }

      // Unwrap kid data to access cpostal and ecole
      const kid = Array.isArray(entry.kid) ? entry.kid[0] : entry.kid;
      
      // Calculate the correct price based on the kid's postal code and school
      const { mainPrice, reducedPrice } = await getPrice(
        sessionData,
        kid.cpostal,
        kid.ecole
      );

      // Determine the price type based on the calculated prices
      let priceType = 'normal';
      if (mainPrice !== sessionData.prix_normal) {
        priceType = 'local';
      }
      
      // Store activity data in session storage for price calculations later
      window.sessionStorage.setItem(`activity_${entry.activity_id}`, JSON.stringify({
        calculated_main_price: mainPrice,
        calculated_reduced_price: reducedPrice,
        prix_normal: sessionData.prix_normal,
        prix_reduit: sessionData.prix_reduit
      }));
      
      // Add to cart with the correct price and price type
      addItem({
        id: `${entry.activity_id}-${entry.kid_id}`,
        activity_id: entry.activity_id,
        kid_id: entry.kid_id,
        kidName: `${kid.prenom} ${kid.nom}`,
        activityName: sessionData.stage.title,
        activityCategory: 'Stage',
        dateRange: `${new Date(sessionData.start_date).toLocaleDateString('fr-FR')} - ${new Date(sessionData.end_date).toLocaleDateString('fr-FR')}`,
        price: mainPrice,
        price_type: priceType,
        reduced_declaration: false,
        imageUrl: sessionData.stage.image_url
      });
      
      toast.success("Place validée ! Redirection vers le panier...");
      
      // Refresh data
      await fetchWaitingList();
      await fetchDetailedRegistrations();
      
      // Redirect to cart after a short delay
      setTimeout(() => {
        navigate('/cart');
      }, 1500);
      
    } catch (error) {
      console.error("Error validating waiting list entry:", error);
      toast.error("Une erreur est survenue lors de la validation");
    } finally {
      setProcessingEntry(null);
    }
  };

  const getPaymentStatusIcon = (status: string, invoiceId: string | null) => {
    if (status === 'paid') {
      return <CheckCircle className="h-4 w-4 text-green-500 mr-1" />;
    } else if (status === 'cancelled') {
      return <XCircle className="h-4 w-4 text-red-500 mr-1" />;
    } else if (status === 'refunded') {
      return <RefreshCw className="h-4 w-4 text-blue-500 mr-1" />;
    } else {
      // pending
      return invoiceId ? 
        <FileText className="h-4 w-4 text-yellow-500 mr-1" /> : 
        <Clock className="h-4 w-4 text-yellow-500 mr-1" />;
    }
  };

  const getPaymentStatusText = (status: string, invoiceId: string | null) => {
    if (status === 'paid') {
      return 'Payé';
    } else if (status === 'cancelled') {
      return 'Annulé';
    } else if (status === 'refunded') {
      return 'Remboursé';
    } else {
      // pending
      return invoiceId ? 'Facture en attente' : 'Paiement en attente';
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

  const getWaitingListStatusColor = (status: string) => {
    switch (status) {
      case 'invited':
        return 'bg-blue-100 text-blue-800';
      case 'waiting':
      default:
        return 'bg-amber-100 text-amber-800';
    }
  };

  const getWaitingListStatusText = (entry: any) => {
    if (entry.status === 'invited') {
      // Calculate remaining time if expires_at is set
      if (entry.expires_at) {
        const expiresAt = new Date(entry.expires_at);
        const now = new Date();
        const hoursRemaining = Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60)));
        
        return `Place disponible - Confirmer dans ${hoursRemaining}h`;
      }
      return 'Place disponible';
    }
    return 'En attente';
  };

  // Unwrap arrays for kid and parent if needed
  const unwrapEntry = (entry: any) => {
    const kid = Array.isArray(entry.kid) ? entry.kid[0] : entry.kid;
    const parent = Array.isArray(entry.parent) ? entry.parent[0] : entry.parent;
    const session = Array.isArray(entry.session) ? entry.session[0] : entry.session;
    return { ...entry, kid, parent, session };
  };
  
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
        reg.session.stage.title.toLowerCase().includes(searchLower) ||
        reg.kid.prenom.toLowerCase().includes(searchLower) ||
        reg.kid.nom.toLowerCase().includes(searchLower) ||
        reg.session.center.name.toLowerCase().includes(searchLower)
      );
    });

  // Filter waiting list entries to only show waiting or invited
  const activeWaitingListEntries = waitingListEntries.filter(
    entry => entry.status === 'waiting' || entry.status === 'invited'
  );
  
  return (
    <div className="container max-w-6xl mx-auto py-12 px-4">
      <Link to="/dashboard" className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6">
        <ArrowLeft className="h-5 w-5 mr-2" />
        Retour au tableau de bord
      </Link>
      
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <h1 className="text-3xl font-bold">Mes inscriptions</h1>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
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
      </div>
      
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      ) : error ? (
        <div className="bg-red-50 p-4 rounded-lg">
          <p className="text-red-700">{error}</p>
        </div>
      ) : filteredRegistrations.length === 0 && activeWaitingListEntries.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-8 text-center">
          <p className="text-gray-600 mb-4">
            {searchTerm || filter !== 'all'
              ? 'Aucune inscription ne correspond à vos critères.'
              : 'Vous n\'avez pas encore d\'inscriptions.'}
          </p>
          {!searchTerm && filter === 'all' && (
            <Link to="/activities" className="btn-primary inline-block">
              Découvrir les stages
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {filteredRegistrations.length > 0 && (
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="p-4 bg-gray-50 border-b">
                <h2 className="text-xl font-semibold">Inscriptions</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Stage
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Enfant
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Dates
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Centre
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tarif
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Montant
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Statut
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredRegistrations.map((reg) => (
                      <tr key={reg.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            {reg.session.stage.title}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(reg.created_at).toLocaleDateString('fr-BE')}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {reg.kid.prenom} {reg.kid.nom}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {new Date(reg.session.start_date).toLocaleDateString('fr-BE')}
                          </div>
                          <div className="text-sm text-gray-500">
                            au {new Date(reg.session.end_date).toLocaleDateString('fr-BE')}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {reg.session.center.name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {reg.price_type.includes('reduced') && (
                              <span className="inline-block text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                                Tarif réduit
                              </span>
                            )}
                            {reg.price_type.includes('local') && (
                              <span className="inline-block text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                                Tarif local
                              </span>
                            )}
                            {!reg.price_type.includes('reduced') && !reg.price_type.includes('local') && (
                              <span className="text-sm text-gray-500">Standard</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {reg.amount_paid} €
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={clsx(
                            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                            getPaymentStatusColor(reg.payment_status)
                          )}>
                            {getPaymentStatusIcon(reg.payment_status, reg.invoice_id)}
                            {getPaymentStatusText(reg.payment_status, reg.invoice_id)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Waiting List Section */}
          {activeWaitingListEntries.length > 0 && (
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="p-4 bg-gray-50 border-b">
                <h2 className="text-xl font-semibold">Liste d'attente</h2>
              </div>
              
              {isWaitingListLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Stage
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Enfant
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Dates
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Centre
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Statut
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {activeWaitingListEntries.map((entry) => (
                        <tr key={entry.id} className={clsx(
                          "hover:bg-gray-50",
                          entry.status === 'invited' && "bg-blue-50"
                        )}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {entry.session?.stage.title}
                            </div>
                            <div className="text-xs text-gray-500">
                              {new Date(entry.created_at).toLocaleDateString('fr-BE')}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {entry.kid?.prenom} {entry.kid?.nom}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {entry.session && new Date(entry.session.start_date).toLocaleDateString('fr-BE')}
                            </div>
                            <div className="text-sm text-gray-500">
                              au {entry.session && new Date(entry.session.end_date).toLocaleDateString('fr-BE')}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {entry.session?.center.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={clsx(
                              "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                              getWaitingListStatusColor(entry.status)
                            )}>
                              <Clock className="h-4 w-4 mr-1" />
                              {getWaitingListStatusText(entry)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex space-x-3">
                              {entry.status === 'invited' && (
                                <button
                                  onClick={() => handleValidateWaitingList(entry)}
                                  disabled={processingEntry === entry.id}
                                  className={clsx(
                                    "text-green-600 hover:text-green-800 text-sm font-medium",
                                    processingEntry === entry.id && "opacity-50 cursor-not-allowed"
                                  )}
                                >
                                  {processingEntry === entry.id ? (
                                    <span className="flex items-center">
                                      <Loader2 className="animate-spin h-3 w-3 mr-1" />
                                      Validation...
                                    </span>
                                  ) : (
                                    "Valider la place"
                                  )}
                                </button>
                              )}
                              <button
                                onClick={() => handleCancelWaitingList(entry.id)}
                                disabled={processingEntry === entry.id}
                                className={clsx(
                                  "text-red-600 hover:text-red-800 text-sm font-medium",
                                  processingEntry === entry.id && "opacity-50 cursor-not-allowed"
                                )}
                              >
                                {processingEntry === entry.id ? (
                                  <span className="flex items-center">
                                    <Loader2 className="animate-spin h-3 w-3 mr-1" />
                                    Annulation...
                                  </span>
                                ) : (
                                  "Annuler"
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      <Toaster position="top-right" />
    </div>
  );
};

export default RegistrationsPage;