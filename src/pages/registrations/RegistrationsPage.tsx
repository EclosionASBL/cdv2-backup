import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useWaitingListStore } from '../../stores/waitingListStore';
import { useCartStore } from '../../stores/cartStore';
import { useRegistrationStore } from '../../stores/registrationStore';
import { useCancellationRequestStore } from '../../stores/cancellationRequestStore';
import { useAuthStore } from '../../stores/authStore';
import { useActivityStore } from '../../stores/activityStore';
import { 
  Loader2, CheckCircle, Clock, ArrowLeft, Filter, Search, FileText, 
  XCircle, RefreshCw, AlertTriangle, Ban, Download, ExternalLink
} from 'lucide-react';
import { CancellationRequestModal } from '../../components/modals/CancellationRequestModal';
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
  invoice_url: string | null;
  cancellation_status: 'none' | 'requested' | 'cancelled_full_refund' | 'cancelled_partial_refund' | 'cancelled_no_refund';
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
  cancellation_request?: {
    id: string;
    status: string;
    refund_type: string | null;
    credit_note_id: string | null;
    credit_note_url: string | null;
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
  const { getPrice } = useActivityStore();
  const { 
    createRequest, 
    checkExistingRequest,
    isLoading: isCancellationRequestLoading 
  } = useCancellationRequestStore();
  
  // State for cancellation request modal
  const [isCancellationModalOpen, setIsCancellationModalOpen] = useState(false);
  const [selectedRegistrationForCancellation, setSelectedRegistrationForCancellation] = useState<Registration | null>(null);
  const [hasPendingCancellationRequests, setHasPendingCancellationRequests] = useState<Record<string, boolean>>({});
  
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
          invoice_url,
          cancellation_status,
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
          ),
          cancellation_request:cancellation_requests(
            id,
            status,
            refund_type,
            credit_note_id,
            credit_note_url
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      const registrationsData = data || [];
      setRegistrations(registrationsData);
      
      // Check for existing cancellation requests
      const cancellationStatuses: Record<string, boolean> = {};
      for (const reg of registrationsData) {
        const hasRequest = await checkExistingRequest(reg.id);
        cancellationStatuses[reg.id] = hasRequest;
      }
      setHasPendingCancellationRequests(cancellationStatuses);
      
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

  const handleRequestCancellation = (registration: Registration) => {
    setSelectedRegistrationForCancellation(registration);
    setIsCancellationModalOpen(true);
  };

  const handleConfirmCancellation = async (notes: string) => {
    if (!selectedRegistrationForCancellation) return;
    
    try {
      await createRequest(
        selectedRegistrationForCancellation.id,
        selectedRegistrationForCancellation.kid_id,
        selectedRegistrationForCancellation.activity_id,
        notes
      );
      
      // Update the local state to show this registration has a pending cancellation request
      setHasPendingCancellationRequests(prev => ({
        ...prev,
        [selectedRegistrationForCancellation.id]: true
      }));
      
      // Update the registration's cancellation_status
      const updatedRegistrations = registrations.map(reg => 
        reg.id === selectedRegistrationForCancellation.id 
          ? { ...reg, cancellation_status: 'requested' as const } 
          : reg
      );
      setRegistrations(updatedRegistrations);
      
      toast.success("Votre demande d'annulation a été envoyée");
      setIsCancellationModalOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Une erreur est survenue");
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

  const getCancellationStatusBadge = (status: string) => {
    switch (status) {
      case 'requested':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
            <Ban className="h-3 w-3 mr-1" />
            Annulation en cours
          </span>
        );
      case 'cancelled_full_refund':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Annulé (remboursement complet)
          </span>
        );
      case 'cancelled_partial_refund':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Annulé (remboursement partiel)
          </span>
        );
      case 'cancelled_no_refund':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle className="h-3 w-3 mr-1" />
            Annulé (sans remboursement)
          </span>
        );
      default:
        return null;
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
    <div className="container max-w-6xl mx-auto py-8 px-4 sm:py-12">
      <Link to="/dashboard" className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6">
        <ArrowLeft className="h-5 w-5 mr-2" />
        Retour au tableau de bord
      </Link>
      
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold">Mes inscriptions</h1>
        
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
              
              {/* Mobile-friendly card layout */}
              <div className="divide-y divide-gray-200">
                {filteredRegistrations.map((reg) => {
                  const hasCancellationRequest = reg.cancellation_status === 'requested';
                  const isCancelled = reg.cancellation_status.startsWith('cancelled_');
                  const daysUntilStart = Math.ceil(
                    (new Date(reg.session.start_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
                  );
                  
                  // Get credit note info if available
                  const creditNoteId = reg.cancellation_request?.credit_note_id;
                  const creditNoteUrl = reg.cancellation_request?.credit_note_url;
                  
                  return (
                    <div key={reg.id} className="p-4 hover:bg-gray-50">
                      <div className="flex flex-col space-y-4">
                        {/* Stage and kid info */}
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                          <div>
                            <h3 className="font-semibold text-lg text-gray-900">{reg.session.stage.title}</h3>
                            <p className="text-sm text-gray-600">Pour: {reg.kid.prenom} {reg.kid.nom}</p>
                          </div>
                          <div className="flex flex-col items-start sm:items-end">
                            <span className={clsx(
                              "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                              getPaymentStatusColor(reg.payment_status)
                            )}>
                              {getPaymentStatusIcon(reg.payment_status, reg.invoice_id)}
                              {getPaymentStatusText(reg.payment_status, reg.invoice_id)}
                            </span>
                            
                            {hasCancellationRequest && (
                              <div className="mt-1">
                                {getCancellationStatusBadge(reg.cancellation_status)}
                              </div>
                            )}
                            
                            {isCancelled && (
                              <div className="mt-1">
                                {getCancellationStatusBadge(reg.cancellation_status)}
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Dates, center, and price info */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <p className="text-xs text-gray-500 uppercase font-medium">Dates</p>
                            <p className="text-sm">
                              {new Date(reg.session.start_date).toLocaleDateString('fr-BE')} au {new Date(reg.session.end_date).toLocaleDateString('fr-BE')}
                            </p>
                          </div>
                          
                          <div>
                            <p className="text-xs text-gray-500 uppercase font-medium">Centre</p>
                            <p className="text-sm">{reg.session.center.name}</p>
                          </div>
                          
                          <div>
                            <p className="text-xs text-gray-500 uppercase font-medium">Tarif</p>
                            <div className="flex items-center">
                              <p className="text-sm font-medium">{reg.amount_paid} €</p>
                              {reg.price_type.includes('reduced') && (
                                <span className="ml-2 inline-block text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                                  Tarif réduit
                                </span>
                              )}
                              {reg.price_type.includes('local') && (
                                <span className="ml-2 inline-block text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                                  Tarif local
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Actions */}
                        <div className="flex flex-wrap gap-2 mt-2">
                          {!hasCancellationRequest && !isCancelled && reg.payment_status !== 'cancelled' && (
                            <button
                              onClick={() => handleRequestCancellation(reg)}
                              className="btn-outline py-1 px-3 text-sm text-red-600 border-red-200 hover:bg-red-50"
                            >
                              Demander annulation
                            </button>
                          )}
                          
                          {reg.invoice_url && (
                            <a 
                              href={reg.invoice_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-outline py-1 px-3 text-sm flex items-center"
                            >
                              <FileText className="h-3 w-3 mr-1" />
                              Voir la facture
                            </a>
                          )}
                          
                          {creditNoteId && creditNoteUrl && (
                            <a 
                              href={creditNoteUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-outline py-1 px-3 text-sm flex items-center"
                            >
                              <FileText className="h-3 w-3 mr-1" />
                              Note de crédit
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
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
                <div className="divide-y divide-gray-200">
                  {activeWaitingListEntries.map((entry) => {
                    // Unwrap nested objects
                    const unwrappedEntry = unwrapEntry(entry);
                    
                    return (
                      <div key={unwrappedEntry.id} className={clsx(
                        "p-4",
                        unwrappedEntry.status === 'invited' && "bg-blue-50"
                      )}>
                        <div className="flex flex-col space-y-4">
                          {/* Stage and status info */}
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                            <div>
                              <h3 className="font-semibold text-lg text-gray-900">
                                {unwrappedEntry.session?.stage.title}
                              </h3>
                              <p className="text-sm text-gray-600">
                                Pour: {unwrappedEntry.kid?.prenom} {unwrappedEntry.kid?.nom}
                              </p>
                            </div>
                            <div>
                              <span className={clsx(
                                "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                                getWaitingListStatusColor(unwrappedEntry.status)
                              )}>
                                <Clock className="h-4 w-4 mr-1" />
                                {getWaitingListStatusText(unwrappedEntry)}
                              </span>
                            </div>
                          </div>
                          
                          {/* Dates and center info */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <p className="text-xs text-gray-500 uppercase font-medium">Dates</p>
                              <p className="text-sm">
                                {unwrappedEntry.session && new Date(unwrappedEntry.session.start_date).toLocaleDateString('fr-BE')} au {unwrappedEntry.session && new Date(unwrappedEntry.session.end_date).toLocaleDateString('fr-BE')}
                              </p>
                            </div>
                            
                            <div>
                              <p className="text-xs text-gray-500 uppercase font-medium">Centre</p>
                              <p className="text-sm">{unwrappedEntry.session?.center.name}</p>
                            </div>
                          </div>
                          
                          {/* Actions */}
                          <div className="flex flex-wrap gap-2 mt-2">
                            {unwrappedEntry.status === 'invited' && (
                              <button
                                onClick={() => handleValidateWaitingList(unwrappedEntry)}
                                disabled={processingEntry === unwrappedEntry.id}
                                className={clsx(
                                  "btn-primary py-1 px-3 text-sm",
                                  processingEntry === unwrappedEntry.id && "opacity-50 cursor-not-allowed"
                                )}
                              >
                                {processingEntry === unwrappedEntry.id ? (
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
                              onClick={() => handleCancelWaitingList(unwrappedEntry.id)}
                              disabled={processingEntry === unwrappedEntry.id}
                              className={clsx(
                                "btn-outline py-1 px-3 text-sm text-red-600 border-red-200 hover:bg-red-50",
                                processingEntry === unwrappedEntry.id && "opacity-50 cursor-not-allowed"
                              )}
                            >
                              {processingEntry === unwrappedEntry.id ? (
                                <span className="flex items-center">
                                  <Loader2 className="animate-spin h-3 w-3 mr-1" />
                                  Annulation...
                                </span>
                              ) : (
                                "Annuler"
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Cancellation Request Modal */}
      <CancellationRequestModal
        isOpen={isCancellationModalOpen}
        onClose={() => setIsCancellationModalOpen(false)}
        onConfirm={handleConfirmCancellation}
        registrationDetails={selectedRegistrationForCancellation}
        isLoading={isCancellationRequestLoading}
      />
      
      <Toaster position="top-right" />
    </div>
  );
};

export default RegistrationsPage;