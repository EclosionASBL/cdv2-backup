import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useActivityStore } from '../../stores/activityStore';
import { useKidStore } from '../../stores/kidStore';
import { useCartStore } from '../../stores/cartStore';
import { useWaitingListStore } from '../../stores/waitingListStore';
import { useRegistrationStore } from '../../stores/registrationStore';
import { Filter, Loader2, AlertCircle, ShoppingCart, Info, X, User, Clock } from 'lucide-react';
import clsx from 'clsx';
import toast, { Toaster } from 'react-hot-toast';

interface ActivityModalProps {
  activity: any;
  onClose: () => void;
}

const ImageWithFallback = ({ src, alt, className }: { src: string | null, alt: string, className?: string }) => {
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  const handleError = () => {
    if (retryCount < maxRetries) {
      // Exponential backoff: wait longer between each retry
      const timeout = Math.pow(2, retryCount) * 1000;
      setTimeout(() => {
        setRetryCount(prev => prev + 1);
        setError(false); // Reset error to trigger a new load attempt
      }, timeout);
    } else {
      setError(true);
    }
  };

  if (error || !src) {
    return (
      <div className={clsx("bg-gray-100 flex items-center justify-center", className)}>
        <User className="h-12 w-12 text-gray-400" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={handleError}
      key={retryCount} // Force re-render on retry
    />
  );
};

const ActivityModal = ({ activity, onClose }: ActivityModalProps) => {
  const isSessionFull = (activity.registration_count || 0) >= activity.capacity;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-lg max-w-2xl w-full p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X className="h-6 w-6" />
        </button>

        <div className="space-y-4">
          <div className="flex items-start space-x-4">
            <ImageWithFallback
              src={activity.stage.image_url}
              alt={activity.stage.title}
              className="h-32 w-32 object-cover rounded-lg"
            />
            <div>
              <h2 className="text-2xl font-bold">{activity.stage.title}</h2>
              <div className="inline-flex items-center px-2 py-1 rounded-full text-sm bg-accent-500 text-white mt-2">
                {activity.periode}
              </div>
              {isSessionFull && (
                <div className="inline-flex items-center px-2 py-1 rounded-full text-sm bg-red-500 text-white mt-2 ml-2">
                  Complet
                </div>
              )}
            </div>
          </div>

          <div className="prose prose-sm max-w-none">
            <p>{activity.stage.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <h3 className="font-semibold text-gray-700">Dates</h3>
              <p>{new Date(activity.start_date).toLocaleDateString('fr-FR')} - {new Date(activity.end_date).toLocaleDateString('fr-FR')}</p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-700">Places disponibles</h3>
              <p>{isSessionFull ? 'Complet' : `${activity.capacity - (activity.registration_count || 0)}/${activity.capacity} places`}</p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-700">Prix</h3>
              <p className="text-primary-600 font-bold">
                {activity.calculated_main_price ?? activity.prix_normal} €
                {(activity.calculated_reduced_price ?? activity.prix_reduit) && (
                  <span className="text-sm text-gray-500 ml-2">
                    (Réduit: {activity.calculated_reduced_price ?? activity.prix_reduit} €)
                  </span>
                )}
              </p>
              {activity.calculated_main_price !== activity.prix_normal && (
                <span className="inline-block mt-1 text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                  Tarif local appliqué
                </span>
              )}
            </div>
            <div>
              <h3 className="font-semibold text-gray-700">Centre</h3>
              <p>{activity.center.name}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ActivitiesPage = () => {
  const navigate = useNavigate();
  const { kids, fetchKids } = useKidStore();
  const { addItem } = useCartStore();
  const { 
    activities,
    filters,
    centers,
    periodes,
    isLoading,
    error,
    fetchActivities,
    fetchCenters,
    fetchPeriodes,
    setFilters,
    getPrice
  } = useActivityStore();
  const { 
    addToWaitingList, 
    isOnWaitingList,
    isLoading: isWaitingListLoading,
    fetchWaitingList
  } = useWaitingListStore();
  const {
    fetchRegistrations,
    isKidRegistered
  } = useRegistrationStore();

  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<any>(null);
  const [joiningWaitingList, setJoiningWaitingList] = useState<string | null>(null);

  useEffect(() => {
    fetchKids();
    fetchCenters();
    fetchPeriodes();
    fetchWaitingList();
    fetchRegistrations();
  }, [fetchKids, fetchCenters, fetchPeriodes, fetchWaitingList, fetchRegistrations]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters({ ...filters, [key]: value });
  };

  const toggleActivitySelection = (id: string, isFull: boolean, isAlreadyRegistered: boolean) => {
    if (isFull || isAlreadyRegistered) return; // Don't allow selection if the session is full or already registered
    
    setSelectedActivities(prev => 
      prev.includes(id) 
        ? prev.filter(actId => actId !== id)
        : [...prev, id]
    );
  };

  const handleAddToCart = async () => {
    const selectedItems = activities.filter(activity => 
      selectedActivities.includes(activity.id)
    );

    for (const activity of selectedItems) {
      if (!filters.kid_id) return;

      const selectedKid = kids.find(kid => kid.id === filters.kid_id);
      if (!selectedKid) return;

      const { mainPrice, reducedPrice } = await getPrice(
        activity,
        selectedKid.cpostal,
        selectedKid.ecole
      );

      const priceType = activity.calculated_main_price !== activity.prix_normal ? 'local' : 'normal';

      // Store activity data in session storage for price calculations later
      window.sessionStorage.setItem(`activity_${activity.id}`, JSON.stringify({
        calculated_main_price: activity.calculated_main_price,
        calculated_reduced_price: activity.calculated_reduced_price,
        prix_normal: activity.prix_normal,
        prix_reduit: activity.prix_reduit
      }));

      addItem({
        id: `${activity.id}-${filters.kid_id}`,
        activity_id: activity.id,
        kid_id: filters.kid_id,
        kidName: `${selectedKid.prenom} ${selectedKid.nom}`,
        activityName: activity.stage.title,
        activityCategory: activity.periode,
        dateRange: `${new Date(activity.start_date).toLocaleDateString('fr-FR')} - ${new Date(activity.end_date).toLocaleDateString('fr-FR')}`,
        price: mainPrice,
        price_type: priceType,
        reduced_declaration: false,
        imageUrl: activity.stage.image_url
      });
    }

    navigate('/cart');
  };

  const handleJoinWaitingList = async (activityId: string) => {
    if (!filters.kid_id) {
      toast.error("Veuillez sélectionner un enfant");
      return;
    }

    try {
      setJoiningWaitingList(activityId);
      await addToWaitingList(activityId, filters.kid_id);
      toast.success("Vous avez été ajouté à la liste d'attente");
    } catch (error) {
      console.error("Error joining waiting list:", error);
      toast.error("Une erreur est survenue");
    } finally {
      setJoiningWaitingList(null);
    }
  };

  const showNoFiltersMessage = !filters.kid_id || !filters.center_id || !filters.periode;

  const handleInfoClick = (e: React.MouseEvent, activity: any) => {
    e.stopPropagation(); // Prevent the card click event from firing
    setSelectedActivity(activity);
  };

  return (
    <div className="container max-w-7xl mx-auto py-12 px-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <h1 className="text-3xl font-bold">Stages disponibles</h1>
      </div>

      <div className="grid lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center">
                <Filter className="h-5 w-5 mr-2" />
                Filtres obligatoires
              </h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="form-label">Enfant</label>
                <select
                  className="form-input"
                  value={filters.kid_id || ''}
                  onChange={(e) => handleFilterChange('kid_id', e.target.value)}
                >
                  <option value="">Sélectionner un enfant</option>
                  {kids.map((kid) => (
                    <option key={kid.id} value={kid.id}>
                      {kid.prenom} {kid.nom}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Centre</label>
                <select
                  className="form-input"
                  value={filters.center_id || ''}
                  onChange={(e) => handleFilterChange('center_id', e.target.value)}
                >
                  <option value="">Sélectionner un centre</option>
                  {centers.map((center) => (
                    <option key={center.id} value={center.id}>
                      {center.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="form-label">Période</label>
                <select
                  className="form-input"
                  value={filters.periode || ''}
                  onChange={(e) => handleFilterChange('periode', e.target.value)}
                >
                  <option value="">Sélectionner une période</option>
                  {periodes.map((periode) => (
                    <option key={periode} value={periode}>
                      {periode}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-3">
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
          ) : showNoFiltersMessage ? (
            <div className="bg-white rounded-xl shadow-md p-8">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Sélectionnez les filtres obligatoires</h3>
                <p className="text-gray-600">
                  Pour voir les stages disponibles, veuillez sélectionner un enfant, un centre et une période.
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="bg-white rounded-xl shadow-md p-8">
              <div className="text-center text-red-600">
                <AlertCircle className="h-12 w-12 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Une erreur est survenue</h3>
                <p>{error}</p>
              </div>
            </div>
          ) : activities.length === 0 ? (
            <div className="bg-white rounded-xl shadow-md p-8">
              <div className="text-center">
                <Info className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Aucun stage disponible</h3>
                <p className="text-gray-600">
                  Il n'y a pas de stages disponibles pour les critères sélectionnés.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid md:grid-cols-2 gap-6">
                {activities.map((activity) => {
                  const isSessionFull = (activity.registration_count || 0) >= activity.capacity;
                  const isWaiting = filters.kid_id ? isOnWaitingList(activity.id, filters.kid_id) : false;
                  const isAlreadyRegistered = filters.kid_id ? isKidRegistered(filters.kid_id, activity.id) : false;
                  
                  return (
                    <div
                      key={activity.id}
                      className={clsx(
                        "bg-white rounded-xl shadow-md overflow-hidden transition-transform hover:scale-[1.02] cursor-pointer",
                        selectedActivities.includes(activity.id) && "ring-2 ring-primary-500",
                        (isSessionFull || isAlreadyRegistered) && "opacity-90"
                      )}
                      onClick={() => toggleActivitySelection(activity.id, isSessionFull, isAlreadyRegistered)}
                    >
                      <div className="relative">
                        <ImageWithFallback
                          src={activity.stage.image_url}
                          alt={activity.stage.title}
                          className="w-full h-48 object-cover"
                        />
                        {!isSessionFull && !isAlreadyRegistered && (
                          <div
                            className={clsx(
                              "absolute top-4 right-4",
                              (isSessionFull || isAlreadyRegistered) && "cursor-not-allowed"
                            )}
                          >
                            <div className={clsx(
                              "w-6 h-6 rounded-full border-2",
                              selectedActivities.includes(activity.id)
                                ? "bg-primary-500 border-primary-500"
                                : isSessionFull || isAlreadyRegistered
                                  ? "bg-gray-300 border-gray-300"
                                  : "bg-white border-gray-300"
                            )} />
                          </div>
                        )}
                        
                        {isSessionFull && (
                          <div className="absolute top-4 left-4">
                            <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                              Complet
                            </span>
                          </div>
                        )}

                        {isAlreadyRegistered && (
                          <div className="absolute top-4 left-4">
                            <span className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                              Déjà inscrit
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="p-6">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="text-xl font-semibold mb-2">{activity.stage.title}</h3>
                            <div className="inline-flex items-center px-2 py-1 rounded-full text-sm bg-accent-500 text-white">
                              {activity.periode}
                            </div>
                          </div>
                          <button
                            onClick={(e) => handleInfoClick(e, activity)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <Info className="h-5 w-5" />
                          </button>
                        </div>

                        <div className="space-y-2 text-sm text-gray-600">
                          <p>
                            Du {new Date(activity.start_date).toLocaleDateString('fr-FR')} au{' '}
                            {new Date(activity.end_date).toLocaleDateString('fr-FR')}
                          </p>
                          <p>{activity.center.name}</p>
                          <p className="font-semibold text-primary-600">
                            {activity.calculated_main_price ?? activity.prix_normal} €
                            {(activity.calculated_reduced_price ?? activity.prix_reduit) && (
                              <span className="text-sm text-gray-500 ml-2">
                                (Réduit: {activity.calculated_reduced_price ?? activity.prix_reduit} €)
                              </span>
                            )}
                          </p>
                          {activity.calculated_main_price !== activity.prix_normal && (
                            <span className="inline-block text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                              Tarif local appliqué
                            </span>
                          )}
                          <p className="text-xs">
                            Places: {activity.capacity - (activity.registration_count || 0)}/{activity.capacity}
                          </p>
                          
                          {isAlreadyRegistered ? (
                            <div className="mt-2">
                              <div className="flex items-center text-green-600 text-sm">
                                <Clock className="h-4 w-4 mr-1" />
                                <span>Déjà inscrit</span>
                              </div>
                            </div>
                          ) : isSessionFull && (
                            <div className="mt-2">
                              {isWaiting ? (
                                <div className="flex items-center text-amber-600 text-sm">
                                  <Clock className="h-4 w-4 mr-1" />
                                  <span>Sur liste d'attente</span>
                                </div>
                              ) : (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation(); // Prevent card selection
                                    handleJoinWaitingList(activity.id);
                                  }}
                                  disabled={joiningWaitingList === activity.id}
                                  className="btn-outline py-1 px-3 text-sm w-full"
                                >
                                  {joiningWaitingList === activity.id ? (
                                    <span className="flex items-center justify-center">
                                      <Loader2 className="animate-spin h-4 w-4 mr-2" />
                                      En cours...
                                    </span>
                                  ) : (
                                    "Rejoindre la liste d'attente"
                                  )}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {selectedActivities.length > 0 && (
                <div className="fixed bottom-8 right-8">
                  <button
                    onClick={handleAddToCart}
                    className="btn-primary flex items-center space-x-2 shadow-lg"
                  >
                    <ShoppingCart className="h-5 w-5" />
                    <span>
                      Ajouter {selectedActivities.length} stage{selectedActivities.length > 1 ? 's' : ''} au panier
                    </span>
                  </button>
                </div>
              )}

              {selectedActivity && (
                <ActivityModal
                  activity={selectedActivity}
                  onClose={() => setSelectedActivity(null)}
                />
              )}
            </>
          )}
        </div>
      </div>
      <Toaster position="top-right" />
    </div>
  );
};

export default ActivitiesPage;