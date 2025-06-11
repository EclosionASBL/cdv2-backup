import { Link } from 'react-router-dom';
import { CalendarCheck, Users, CreditCard, ShieldCheck } from 'lucide-react';
import { useActivityStore } from '../stores/activityStore';
import { useEffect } from 'react';
import PopularStages from '../components/home/PopularStages';
import NewsletterSection from '../components/home/NewsletterSection';

const HomePage = () => {
  const { activities, fetchActivities, isLoading } = useActivityStore();
  
  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);
  
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
      
      {/* Popular Stages section */}
      <PopularStages limit={4} />
      
      {/* Newsletter Section */}
      <NewsletterSection />
    </div>
  );
};

export default HomePage;