import { Link } from 'react-router-dom';
import { CalendarCheck, Users, CreditCard, ShieldCheck, Filter, Search, MapPin, Calendar, User } from 'lucide-react';
import { useActivityStore } from '../stores/activityStore';
import { useEffect, useState } from 'react';
import clsx from 'clsx';

const HomePage = () => {
  const { activities, centers, periodes, semaines, isLoading, fetchActivities, fetchCenters, fetchPeriodes, fetchSemaines } = useActivityStore();
  
  // State for filters
  const [selectedCenter, setSelectedCenter] = useState<string | null>(null);
  const [selectedAge, setSelectedAge] = useState<number | null>(null);
  const [selectedSemaine, setSelectedSemaine] = useState<string | null>(null);
  const [filteredActivities, setFilteredActivities] = useState<any[]>([]);
  
  useEffect(() => {
    fetchActivities();
    fetchCenters();
    fetchPeriodes();
    fetchSemaines();
  }, [fetchActivities, fetchCenters, fetchPeriodes, fetchSemaines]);
  
  useEffect(() => {
    // Filter activities based on selected filters
    let filtered = [...activities];
    
    if (selectedCenter) {
      filtered = filtered.filter(activity => activity.center_id === selectedCenter);
    }
    
    if (selectedAge !== null) {
      filtered = filtered.filter(activity => 
        selectedAge >= activity.stage.age_min && selectedAge < activity.stage.age_max
      );
    }
    
    if (selectedSemaine) {
      filtered = filtered.filter(activity => activity.semaine === selectedSemaine);
    }
    
    // Sort by remaining places (ascending)
    filtered.sort((a, b) => {
      const remainingA = a.capacity - (a.current_registrations || 0);
      const remainingB = b.capacity - (b.current_registrations || 0);
      return remainingA - remainingB;
    });
    
    // Limit to top 4 for display
    setFilteredActivities(filtered.slice(0, 4));
  }, [activities, selectedCenter, selectedAge, selectedSemaine]);
  
  // Generate age options from 2 to 18
  const ageOptions = Array.from({ length: 17 }, (_, i) => i + 2);
  
  const ImageWithFallback = ({ src, alt, className }: { src: string | null, alt: string, className?: string }) => {
    const [error, setError] = useState(false);
    
    if (error || !src) {
      return (
        <div className={clsx("bg-gray-200 flex items-center justify-center", className)}>
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
  
  return (
    <div className="page-transition">
      {/* Hero section */}
      <section className="bg-gradient-to-br from-primary-50 to-blue-50 py-16 md:py-24">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="order-2 md:order-1">
              <h1 className="text-4xl md:text-5xl font-bold leading-tight text-gray-900 mb-6">
                Stages passionnants pour vos enfants !
              </h1>
              <p className="text-lg text-gray-600 mb-8">
                Inscrivez vos enfants à nos stages de qualité pour des vacances inoubliables.
                Nature, cirque, science, sport et bien plus encore.
              </p>
              <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4">
                <Link
                  to="/activities"
                  className="btn-primary text-center py-3 px-6"
                >
                  Découvrir les stages
                </Link>
                <Link
                  to="/register"
                  className="btn-outline text-center py-3 px-6"
                >
                  Créer un compte
                </Link>
              </div>
            </div>
            <div className="order-1 md:order-2">
              <img
                src="https://www.eclosion.be/new/wp-content/uploads/2017/11/site-bg-01.jpg"
                alt="Enfants s'amusant pendant un stage"
                className="rounded-xl shadow-xl w-full"
              />
            </div>
          </div>
        </div>
      </section>
      
      {/* Features section */}
      <section className="py-16">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Comment ça marche ?</h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Un processus simple et rapide pour inscrire vos enfants à nos stages
            </p>
          </div>
          
          <div className="grid md:grid-cols-4 gap-8">
            <div className="bg-white p-6 rounded-xl shadow-md text-center hover:shadow-lg transition-shadow">
              <div className="inline-flex items-center justify-center p-3 bg-primary-100 rounded-full mb-5">
                <Users className="h-8 w-8 text-primary-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Créez un compte</h3>
              <p className="text-gray-600">
                Inscrivez-vous et ajoutez les profils de vos enfants avec leurs informations
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-md text-center hover:shadow-lg transition-shadow">
              <div className="inline-flex items-center justify-center p-3 bg-primary-100 rounded-full mb-5">
                <CalendarCheck className="h-8 w-8 text-primary-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Choisissez un stage</h3>
              <p className="text-gray-600">
                Parcourez notre catalogue et sélectionnez les stages qui intéressent vos enfants
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-md text-center hover:shadow-lg transition-shadow">
              <div className="inline-flex items-center justify-center p-3 bg-primary-100 rounded-full mb-5">
                <CreditCard className="h-8 w-8 text-primary-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Paiement sécurisé</h3>
              <p className="text-gray-600">
                Effectuez le paiement via notre plateforme sécurisée en toute confiance
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-md text-center hover:shadow-lg transition-shadow">
              <div className="inline-flex items-center justify-center p-3 bg-primary-100 rounded-full mb-5">
                <ShieldCheck className="h-8 w-8 text-primary-600" />
              </div>
              <h3 className="text-xl font-semibold mb-3">Confirmation</h3>
              <p className="text-gray-600">
                Recevez votre confirmation d'inscription et les informations pratiques
              </p>
            </div>
          </div>
        </div>
      </section>
      
      {/* Activities preview */}
      <section className="py-16 bg-gray-50">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
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
              <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
          
          {/* Filters */}
          <div className="bg-white p-4 rounded-xl shadow-md mb-8">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Centre</label>
                <select
                  className="form-input w-full"
                  value={selectedCenter || ''}
                  onChange={(e) => setSelectedCenter(e.target.value || null)}
                >
                  <option value="">Tous les centres</option>
                  {centers.map((center) => (
                    <option key={center.id} value={center.id}>
                      {center.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Âge de l'enfant</label>
                <select
                  className="form-input w-full"
                  value={selectedAge || ''}
                  onChange={(e) => setSelectedAge(e.target.value ? parseInt(e.target.value) : null)}
                >
                  <option value="">Tous les âges</option>
                  {ageOptions.map((age) => (
                    <option key={age} value={age}>
                      {age} ans
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Semaine</label>
                <select
                  className="form-input w-full"
                  value={selectedSemaine || ''}
                  onChange={(e) => setSelectedSemaine(e.target.value || null)}
                >
                  <option value="">Toutes les semaines</option>
                  {semaines.map((semaine) => (
                    <option key={semaine} value={semaine}>
                      {semaine}
                    </option>
                  ))}
                </select>
              </div>
            </div>
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
            <div className="col-span-full py-12 text-center">
              <div className="bg-white rounded-xl shadow-md p-8 mx-auto max-w-2xl">
                <h3 className="text-2xl font-bold text-gray-800 mb-4">Aucun stage disponible</h3>
                <p className="text-gray-600 mb-6">
                  Aucun stage ne correspond à vos critères de recherche. Veuillez modifier vos filtres ou revenir plus tard.
                </p>
                <button
                  onClick={() => {
                    setSelectedCenter(null);
                    setSelectedAge(null);
                    setSelectedSemaine(null);
                  }}
                  className="btn-primary inline-block"
                >
                  Réinitialiser les filtres
                </button>
              </div>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {filteredActivities.map((activity) => {
                const remainingPlaces = activity.capacity - (activity.current_registrations || 0);
                const isAlmostFull = remainingPlaces <= 3 && remainingPlaces > 0;
                const isFull = remainingPlaces <= 0;
                
                return (
                  <div key={activity.id} className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-all">
                    <div className="relative">
                      <ImageWithFallback
                        src={activity.stage.image_url}
                        alt={activity.stage.title}
                        className="h-48 w-full object-cover"
                      />
                      {isFull && (
                        <div className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                          Complet
                        </div>
                      )}
                      {isAlmostFull && (
                        <div className="absolute top-2 right-2 bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                          Plus que {remainingPlaces} place{remainingPlaces > 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-lg mb-1 line-clamp-1">{activity.stage.title}</h3>
                      <div className="flex items-center text-sm text-gray-500 mb-1">
                        <Calendar className="h-4 w-4 mr-1" />
                        <span>
                          {new Date(activity.start_date).toLocaleDateString('fr-BE')} - {new Date(activity.end_date).toLocaleDateString('fr-BE')}
                        </span>
                      </div>
                      <div className="flex items-center text-sm text-gray-500 mb-3">
                        <MapPin className="h-4 w-4 mr-1" />
                        <span>{activity.center.name}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-primary-600">{activity.prix_normal} €</span>
                        <span className="text-sm text-gray-500">
                          {activity.stage.age_min} - {activity.stage.age_max} ans
                        </span>
                      </div>
                      <Link
                        to={`/activities/${activity.id}`}
                        className="btn-primary w-full text-center mt-3 py-2 block"
                      >
                        Voir les détails
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
      
      {/* Testimonials section */}
      <section className="py-16">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Ce que disent les parents</h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Découvrez les témoignages de parents satisfaits
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-shadow">
              <div className="flex items-center mb-4">
                <svg className="text-yellow-400 w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                </svg>
                <svg className="text-yellow-400 w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                </svg>
                <svg className="text-yellow-400 w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                </svg>
                <svg className="text-yellow-400 w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                </svg>
                <svg className="text-yellow-400 w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                </svg>
              </div>
              <p className="text-gray-600 mb-4">
                "Nous tenions à vous remercier pour la qualité de l'accueil et des activités et pour la gentillesse et le professionnalisme des animateurs. Faustine et Baptiste ont passé de supers moments et c'est avec plaisir que nous les inscrirons de nouveau. Merci encore!"
              </p>              
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                    <span className="text-primary-600 font-semibold">M</span>
                  </div>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900">M.</p>
                  <p className="text-sm text-gray-500">Maman de Faustine et Baptiste</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-shadow">
              <div className="flex items-center mb-4">
                <svg className="text-yellow-400 w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                </svg>
                <svg className="text-yellow-400 w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                </svg>
                <svg className="text-yellow-400 w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                </svg>
                <svg className="text-yellow-400 w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                </svg>
                <svg className="text-yellow-400 w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                </svg>
              </div>
              <p className="text-gray-600 mb-4">
                "Nous sommes ravi de cette première expérience avec vous. Merci aux animateurs pour leur énergie et leur accueil chaleureux."
              </p>
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                    <span className="text-primary-600 font-semibold">T</span>
                  </div>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900">T.B.</p>
                  <p className="text-sm text-gray-500">Papa de Thomas à Ixelles</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-xl shadow-md hover:shadow-lg transition-shadow">
              <div className="flex items-center mb-4">
                <svg className="text-yellow-400 w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                </svg>
                <svg className="text-yellow-400 w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                </svg>
                <svg className="text-yellow-400 w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                </svg>
                <svg className="text-yellow-400 w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                </svg>
                <svg className="text-yellow-400 w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path>
                </svg>
              </div>
              <p className="text-gray-600 mb-4">
                "Bravo à l'équipe! Chouette ambiance, animateur.rice.s souriant.e.s, top! Chouette "spectacle" à la fin de la semaine, très bonne idée de proposer une auberge espagnole"
              </p>
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                    <span className="text-primary-600 font-semibold">A</span>
                  </div>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-900">Amal</p>
                  <p className="text-sm text-gray-500">Maman à Ixelles</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Newsletter */}
      <section className="py-16 bg-primary-50">
        <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="grid md:grid-cols-2">
              <div className="p-8 md:p-12">
                <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
                  Restez informé !
                </h2>
                <p className="text-gray-600 mb-6">
                  Inscrivez-vous à notre newsletter pour être informé des nouveaux stages et offres spéciales.
                </p>
                <form className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="email"
                    placeholder="Votre adresse email"
                    className="form-input flex-grow"
                    required
                  />
                  <button
                    type="submit"
                    className="btn-primary whitespace-nowrap"
                  >
                    S'inscrire
                  </button>
                </form>
              </div>
              <div className="hidden md:block">
                <img
                  src="https://images.pexels.com/photos/3905856/pexels-photo-3905856.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2"
                  alt="Enfants jouant ensemble"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;