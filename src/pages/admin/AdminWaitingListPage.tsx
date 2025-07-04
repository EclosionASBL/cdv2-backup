import { useEffect, useState } from 'react';
import { useWaitingListStore } from '../../stores/waitingListStore';
import { Loader2, AlertCircle, Clock, X, Mail, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast, { Toaster } from 'react-hot-toast';
import clsx from 'clsx';

const AdminWaitingListPage = () => {
  const { 
    entries, 
    fetchWaitingList, 
    isLoading, 
    error,
    offerSeat,
    convertToRegistration,
    cancelWaitingListEntry
  } = useWaitingListStore();
  
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);
  const [activities, setActivities] = useState<any[]>([]);
  const [isProcessingEntry, setIsProcessingEntry] = useState<string | null>(null);

  useEffect(() => {
    fetchWaitingList();
    fetchActivities();
  }, [fetchWaitingList]);

  useEffect(() => {
    console.log('Waiting list entries:', entries);
  }, [entries]);

  const fetchActivities = async () => {
    try {
      const { data, error } = await supabase
        .from('sessions')
        .select(`
          id,
          stage:stages(title),
          center:centers(name),
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
      await convertToRegistration(id);
      toast.success('Converti en inscription avec succès');
    } catch (error) {
      console.error('Error converting to registration:', error);
      toast.error('Une erreur est survenue');
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

  // Filter entries by selected activity
  const filteredEntries = selectedActivity
    ? entries.filter(entry => entry.activity_id === selectedActivity)
    : entries;

  // Group entries by activity
  const entriesByActivity = filteredEntries.reduce((acc, entry) => {
    const activityId = entry.activity_id;
    if (!acc[activityId]) {
      acc[activityId] = [];
    }
    acc[activityId].push(entry);
    return acc;
  }, {} as Record<string, typeof entries>);

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
      <Toaster position="top-right" />
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Liste d'attente</h1>
          <p className="text-gray-600">Gérez les listes d'attente pour les sessions complètes</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 p-4 rounded-lg">
          <p className="text-red-700">{error}</p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Filtrer par activité
          </label>
          <select
            value={selectedActivity || ''}
            onChange={(e) => setSelectedActivity(e.target.value || null)}
            className="form-input"
          >
            <option value="">Toutes les activités</option>
            {activities.map((activity) => (
              <option key={activity.id} value={activity.id}>
                {activity.stage.title} - {new Date(activity.start_date).toLocaleDateString('fr-FR')} - {activity.center.name}
              </option>
            ))}
          </select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Aucune entrée dans la liste d'attente</p>
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
                          Adresse
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
                        // Unwrap nested objects
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
                              {/* Add console.log to debug parent data */}
                              {console.log('Parent data:', unwrappedEntry.parent)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {unwrappedEntry.parent?.email}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {unwrappedEntry.parent?.adresse ? (
                                <>
                                  <div>{unwrappedEntry.parent.adresse}</div>
                                  <div>{unwrappedEntry.parent.cpostal} {unwrappedEntry.parent.localite}</div>
                                </>
                              ) : (
                                '-'
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {unwrappedEntry.parent?.telephone || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {new Date(unwrappedEntry.created_at).toLocaleDateString('fr-FR')}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={clsx(
                                "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                                getWaitingListStatusColor(unwrappedEntry.status)
                              )}>
                                <Clock className="h-4 w-4 mr-1" />
                                {getWaitingListStatusText(unwrappedEntry)}
                              </span>
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
    </div>
  );
};

export default AdminWaitingListPage;