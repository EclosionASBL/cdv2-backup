import { useEffect, useState } from 'react';
import { useWaitingListStore } from '../../stores/waitingListStore';
import { Loader2, AlertCircle, Clock, X, Mail, CheckCircle, Search, Filter } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast, { Toaster } from 'react-hot-toast';
import clsx from 'clsx';

const AdminWaitingListPage = () => {
  const { 
    entries: waitingListEntries, 
    fetchWaitingList, 
    isLoading: isWaitingListLoading, 
    error,
    removeFromWaitingList,
    offerSeat,
    markEntryConverted,
    cancelWaitingListEntry
  } = useWaitingListStore();
  
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [isProcessingEntry, setIsProcessingEntry] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [registrations, setRegistrations] = useState<Record<string, Set<string>>>({});

  useEffect(() => {
    fetchWaitingList();
    fetchActivities();
    fetchRegistrations();
  }, [fetchWaitingList]);

  useEffect(() => {
    console.log('Waiting list entries:', waitingListEntries);
  }, [waitingListEntries]);

  const fetchActivities = async () => {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select(`
          id,
          stage:stage_id(title),
          center:center_id(name),
          start_date,
          end_date,
          capacity
        `)
        .order('start_date', { ascending: false });

      if (error) throw error;
      setActivities(data || []);
    } catch (error) {
      console.error('Error fetching activities:', error);
    }
  };

  const fetchRegistrations = async () => {
    try {
      const { data, error } = await supabase
        .from('registrations')
        .select('activity_id, kid_id')
        .in('payment_status', ['paid', 'pending'])
        .neq('cancellation_status', 'cancelled_full_refund');

      if (error) throw error;
      
      // Create a map of activity_id -> Set of kid_ids
      const registrationMap: Record<string, Set<string>> = {};
      
      if (data) {
        data.forEach(reg => {
          if (!registrationMap[reg.activity_id]) {
            registrationMap[reg.activity_id] = new Set();
          }
          registrationMap[reg.activity_id].add(reg.kid_id);
        });
      }
      
      setRegistrations(registrationMap);
    } catch (error) {
      console.error('Error fetching registrations:', error);
    }
  };

  const handleOfferSeat = async (id: string) => {
    try {
      setIsProcessingEntry(id);
      await offerSeat(id);
      toast.success('Place offerte avec succès');
    } catch (error) {
      console.error('Error offering seat:', error);
      toast.error('Une erreur est survenue');
    } finally {
      setIsProcessingEntry(null);
    }
  };

  const handleConvertToRegistration = async (id: string) => {
    try {
      setIsProcessingEntry(id);
      await markEntryConverted(id);
      toast.success('Converti en inscription avec succès');
      // Refresh registrations after conversion
      await fetchRegistrations();
    } catch (error) {
      console.error('Error converting to registration:', error);
      toast.error('Une erreur est survenue lors de la conversion');
    } finally {
      setIsProcessingEntry(null);
    }
  };

  const handleCancelWaitingList = async (id: string) => {
    try {
      setIsProcessingEntry(id);
      await cancelWaitingListEntry(id);
      toast.success('Entrée annulée avec succès');
    } catch (error) {
      console.error('Error cancelling waiting list entry:', error);
      toast.error('Une erreur est survenue');
    } finally {
      setIsProcessingEntry(null);
    }
  };

  // Filter entries by selected activity and search term
  // Also filter out entries where the kid is already registered for the activity
  const filteredEntries = waitingListEntries
    .filter(entry => {
      // Filter by activity if selected
      if (selectedActivity && entry.activity_id !== selectedActivity) {
        return false;
      }
      
      // Filter out entries where the kid is already registered for this activity
      if (registrations[entry.activity_id] && registrations[entry.activity_id].has(entry.kid_id)) {
        return false;
      }
      
      // Filter by search term if provided
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        
        // Unwrap nested objects if needed
        const kid = Array.isArray(entry.kid) ? entry.kid[0] : entry.kid;
        const parent = Array.isArray(entry.parent) ? entry.parent[0] : entry.parent;
        
        return (
          kid?.prenom?.toLowerCase().includes(searchLower) ||
          kid?.nom?.toLowerCase().includes(searchLower) ||
          parent?.prenom?.toLowerCase().includes(searchLower) ||
          parent?.nom?.toLowerCase().includes(searchLower) ||
          parent?.email?.toLowerCase().includes(searchLower)
        );
      }
      
      return true;
    })
    .filter(entry => entry.status === 'waiting' || entry.status === 'invited');

  // Group entries by activity
  const entriesByActivity = filteredEntries.reduce((acc, entry) => {
    const activityId = entry.activity_id;
    if (!acc[activityId]) {
      acc[activityId] = [];
    }
    acc[activityId].push(entry);
    return acc;
  }, {} as Record<string, typeof filteredEntries>);

  useEffect(() => {
    console.log('entriesByActivity:', entriesByActivity);
    console.log('Object.keys(entriesByActivity):', Object.keys(entriesByActivity));
  }, [entriesByActivity]);

  // Sort entries by status (waiting first, then invited) and then by created_at
  Object.keys(entriesByActivity).forEach(activityId => {
    entriesByActivity[activityId].sort((a, b) => {
      // First sort by status (waiting first, then invited)
      if (a.status === 'waiting' && b.status !== 'waiting') return -1;
      if (a.status !== 'waiting' && b.status === 'waiting') return 1;
      
      // Then sort by created_at
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  });

  const getActivityName = (activityId: string) => {
    const activity = activities.find(a => a.id === activityId);
    if (!activity) return 'Activité inconnue';
    return `${activity.stage.title} - ${new Date(activity.start_date).toLocaleDateString('fr-FR')} au ${new Date(activity.end_date).toLocaleDateString('fr-FR')} - Centre: ${activity.center.name}`;
  };

  const getStatusBadge = (status: string, expiresAt: string | null) => {
    switch (status) {
      case 'invited':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <Mail className="h-3 w-3 mr-1" />
            Invité
          </span>
        );
      case 'waiting':
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
            <Clock className="h-3 w-3 mr-1" />
            En attente
          </span>
        );
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
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Liste d'attente</h1>
          <p className="text-gray-600">Gérez les listes d'attente pour les sessions complètes</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 p-4 rounded-lg">
          <div className="flex">
            <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
            <p className="text-red-700">{error}</p>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-grow">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filtrer par activité
            </label>
            <select
              value={selectedActivity || ''}
              onChange={(e) => setSelectedActivity(e.target.value || null)}
              className="form-input w-full"
            >
              <option value="">Toutes les activités</option>
              {activities.map((activity) => (
                <option key={activity.id} value={activity.id}>
                  {activity.stage.title} - {new Date(activity.start_date).toLocaleDateString('fr-FR')} - {activity.center.name}
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex-grow">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rechercher
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Rechercher par nom, prénom, email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="form-input w-full pl-10"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
            </div>
          </div>
        </div>

        {isWaitingListLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">
              {searchTerm || selectedActivity 
                ? "Aucune entrée ne correspond à vos critères de recherche" 
                : "Aucune entrée dans la liste d'attente"}
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.keys(entriesByActivity).map((activityId) => (
              <div key={activityId} className="border rounded-lg overflow-hidden">
                <div className="bg-gray-50 p-4 border-b">
                  <h3 className="font-medium">{getActivityName(activityId)}</h3>
                  <p className="text-sm text-gray-500">
                    {entriesByActivity[activityId].length} {entriesByActivity[activityId].length > 1 ? 'enfants' : 'enfant'} en attente
                  </p>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Position
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Enfant
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Parent
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Email
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Téléphone
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date d'ajout
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
                      {entriesByActivity[activityId].map((entry, index) => {
                        // Unwrap arrays if needed
                        const unwrappedEntry = unwrapEntry(entry);
                        
                        return (
                          <tr key={unwrappedEntry.id} className={clsx(
                            "hover:bg-gray-50",
                            unwrappedEntry.status === 'invited' && "bg-blue-50"
                          )}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              #{index + 1}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {unwrappedEntry.kid?.prenom} {unwrappedEntry.kid?.nom}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {unwrappedEntry.parent?.prenom} {unwrappedEntry.parent?.nom}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {unwrappedEntry.parent?.email}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {unwrappedEntry.parent?.telephone || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {new Date(unwrappedEntry.created_at).toLocaleDateString('fr-FR')}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {getStatusBadge(unwrappedEntry.status, unwrappedEntry.expires_at)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex justify-end space-x-2">
                                {unwrappedEntry.status === 'waiting' && (
                                  <button
                                    onClick={() => handleOfferSeat(unwrappedEntry.id)}
                                    disabled={isProcessingEntry === unwrappedEntry.id}
                                    className="text-blue-600 hover:text-blue-900"
                                    title="Offrir un siège"
                                  >
                                    {isProcessingEntry === unwrappedEntry.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Mail className="h-4 w-4" />
                                    )}
                                  </button>
                                )}
                                
                                {unwrappedEntry.status === 'invited' && (
                                  <button
                                    onClick={() => handleConvertToRegistration(unwrappedEntry.id)}
                                    disabled={isProcessingEntry === unwrappedEntry.id}
                                    className="text-green-600 hover:text-green-900"
                                    title="Convertir en inscription"
                                  >
                                    {isProcessingEntry === unwrappedEntry.id ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <CheckCircle className="h-4 w-4" />
                                    )}
                                  </button>
                                )}
                                
                                <button
                                  onClick={() => handleCancelWaitingList(unwrappedEntry.id)}
                                  disabled={isProcessingEntry === unwrappedEntry.id}
                                  className="text-red-600 hover:text-red-900"
                                  title="Annuler"
                                >
                                  {isProcessingEntry === unwrappedEntry.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <X className="h-4 w-4" />
                                  )}
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <Toaster position="top-right" />
    </div>
  );
};

export default AdminWaitingListPage;