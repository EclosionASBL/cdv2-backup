import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useActivityStore } from '../../stores/activityStore';
import { ChevronRight, User, Clock } from 'lucide-react';
import clsx from 'clsx';

interface PopularStagesProps {
  limit?: number;
}

const ImageWithFallback = ({ src, alt, className }: { src: string | null, alt: string, className?: string }) => {
  const [error, setError] = useState(false);
  
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
      onError={() => setError(true)}
    />
  );
};

const PopularStages = ({ limit = 4 }: PopularStagesProps) => {
  const { 
    activities, 
    centers, 
    periodes,
    fetchActivities, 
    fetchCenters,
    fetchPeriodes,
    isLoading 
  } = useActivityStore();
  
  const [selectedCenter, setSelectedCenter] = useState<string>('');
  const [selectedAge, setSelectedAge] = useState<string>('');
  const [selectedSemaine, setSelectedSemaine] = useState<string>('');
  const [filteredActivities, setFilteredActivities] = useState<any[]>([]);
  
  // Age ranges for the filter
  const ageRanges = [
    { label: 'Tous les âges', value: '' },
    { label: '2,5 - 4 ans', value: '2.5-4' },
    { label: '4 - 6 ans', value: '4-6' },
    { label: '6 - 8 ans', value: '6-8' },
    { label: '8 - 12 ans', value: '8-12' },
    { label: '12 - 13 ans', value: '12-13' }
  ];
  
  // Semaines options will be dynamically generated from activities
  const [semaineOptions, setSemaineOptions] = useState<{label: string, value: string}[]>([
    { label: 'Toutes les semaines', value: '' }
  ]);

  useEffect(() => {
    // Fetch activities, centers, and periodes on component mount
    fetchActivities();
    fetchCenters();
    fetchPeriodes();
  }, [fetchActivities, fetchCenters, fetchPeriodes]);

  useEffect(() => {
    // Extract unique semaines from activities and sort them
    if (activities.length > 0) {
      const uniqueSemaines = [...new Set(activities.map(a => a.semaine).filter(Boolean))];
      const sortedSemaines = uniqueSemaines.sort();
      
      const options = [
        { label: 'Toutes les semaines', value: '' },
        ...sortedSemaines.map(semaine => ({ 
          label: semaine, 
          value: semaine 
        }))
      ];
      
      setSemaineOptions(options);
    }
  }, [activities]);

  useEffect(() => {
    // Filter activities based on selected filters
    let filtered = [...activities];
    
    // Filter by center
    if (selectedCenter) {
      filtered = filtered.filter(activity => activity.center_id === selectedCenter);
    }
    
    // Filter by age range
    if (selectedAge) {
      const [minAge, maxAge] = selectedAge.split('-').map(Number);
      filtered = filtered.filter(activity => {
        return activity.stage.age_min <= maxAge && activity.stage.age_max >= minAge;
      });
    }
    
    // Filter by semaine
    if (selectedSemaine) {
      filtered = filtered.filter(activity => activity.semaine === selectedSemaine);
    }
    
    // Filter out past activities
    const today = new Date();
    filtered = filtered.filter(activity => {
      const endDate = new Date(activity.end_date);
      return endDate >= today;
    });
    
    // Sort by remaining places (ascending) to prioritize those with fewer spots
    filtered.sort((a, b) => {
      const remainingA = a.capacity - (a.current_registrations || 0);
      const remainingB = b.capacity - (b.current_registrations || 0);
      return remainingA - remainingB;
    });
    
    // Limit the number of activities shown
    setFilteredActivities(filtered.slice(0, limit));
  }, [activities, selectedCenter, selectedAge, selectedSemaine, limit]);

  const resetFilters = () => {
    setSelectedCenter('');
    setSelectedAge('');
    setSelectedSemaine('');
  };

  return (
    <div className="py-16 bg-gray-50">
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-12">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Nos stages populaires</h2>
            <p className="text-lg text-gray-600 max-w-3xl">
              Découvrez notre sélection de stages variés pour tous les âges et tous les goûts
            </p>
          </div>
          <Link
            to="/activities"
            className="mt-4 md:mt-0 text-primary-600 hover:text-primary-700 font-semibold flex items-center"
          >
            Voir tous les stages
            <ChevronRight className="ml-1 w-5 h-5" />
          </Link>
        </div>
        
        {/* Filters */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Centre
              </label>
              <select
                value={selectedCenter}
                onChange={(e) => setSelectedCenter(e.target.value)}
                className="form-input w-full"
              >
                <option value="">Tous les centres</option>
                {centers.map((center) => (
                  <option key={center.id} value={center.id}>
                    {center.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Âge de l'enfant
              </label>
              <select
                value={selectedAge}
                onChange={(e) => setSelectedAge(e.target.value)}
                className="form-input w-full"
              >
                {ageRanges.map((range) => (
                  <option key={range.value} value={range.value}>
                    {range.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Semaine
              </label>
              <select
                value={selectedSemaine}
                onChange={(e) => setSelectedSemaine(e.target.value)}
                className="form-input w-full"
              >
                {semaineOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          {(selectedCenter || selectedAge || selectedSemaine) && (
            <div className="mt-4 flex justify-end">
              <button
                onClick={resetFilters}
                className="text-primary-600 hover:text-primary-700 text-sm font-medium"
              >
                Réinitialiser les filtres
              </button>
            </div>
          )}
        </div>
        
        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {Array(4).fill(0).map((_, index) => (
              <div key={index} className="bg-white rounded-xl shadow animate-pulse">
                <div className="h-52 bg-gray-200 rounded-t-xl"></div>
                <div className="p-4">
                  <div className="h-6 bg-gray-200 rounded mb-3"></div>
                  <div className="h-4 bg-gray-200 rounded mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded mb-2 w-2/3"></div>
                  <div className="h-8 bg-gray-200 rounded mt-4"></div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-8 text-center">
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Aucun stage disponible</h3>
            <p className="text-gray-600 mb-4">
              {selectedCenter || selectedAge || selectedSemaine
                ? "Aucun stage ne correspond à vos critères. Veuillez modifier vos filtres."
                : "Aucun stage n'est disponible pour le moment. Revenez bientôt pour découvrir notre programmation."}
            </p>
            {(selectedCenter || selectedAge || selectedSemaine) && (
              <button
                onClick={resetFilters}
                className="btn-primary"
              >
                Réinitialiser les filtres
              </button>
            )}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredActivities.map((activity) => {
              const remainingPlaces = activity.capacity - (activity.current_registrations || 0);
              const isAlmostFull = remainingPlaces <= 3 && remainingPlaces > 0;
              const isFull = remainingPlaces <= 0;
              
              return (
                <Link
                  key={activity.id}
                  to={`/activities/${activity.id}`}
                  className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow"
                >
                  <div className="relative">
                    <ImageWithFallback
                      src={activity.stage.image_url}
                      alt={activity.stage.title}
                      className="w-full h-48 object-cover"
                    />
                    {isAlmostFull && (
                      <div className="absolute top-2 right-2 bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                        Plus que {remainingPlaces} place{remainingPlaces > 1 ? 's' : ''}
                      </div>
                    )}
                    {isFull && (
                      <div className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                        Complet
                      </div>
                    )}
                  </div>
                  
                  <div className="p-4">
                    <h3 className="font-semibold text-lg mb-1 text-gray-900">{activity.stage.title}</h3>
                    <p className="text-sm text-gray-600 mb-1">
                      {new Date(activity.start_date).toLocaleDateString('fr-BE')} - {new Date(activity.end_date).toLocaleDateString('fr-BE')}
                    </p>
                    <p className="text-sm text-gray-600 mb-2">
                      {activity.center.name}
                    </p>
                    <div className="flex justify-between items-center mt-3">
                      <span className="text-primary-600 font-bold">
                        {activity.calculated_main_price || activity.prix_normal} €
                      </span>
                      <span className="text-xs text-gray-500 flex items-center">
                        <Clock className="h-3 w-3 mr-1" />
                        {activity.stage.age_min} - {activity.stage.age_max} ans
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default PopularStages;