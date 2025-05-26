import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useCartStore } from '../../stores/cartStore';
import { CheckCircle, Calendar, Home } from 'lucide-react';

const OrderConfirmationPage = () => {
  const { clearCart } = useCartStore();

  useEffect(() => {
    // Clear the cart on successful payment
    clearCart();
  }, [clearCart]);

  return (
    <div className="container max-w-3xl mx-auto py-12 px-4 text-center">
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="p-8">
          <div className="flex justify-center mb-6">
            <div className="p-3 bg-green-100 rounded-full">
              <CheckCircle size={48} className="text-green-500" />
            </div>
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Merci pour votre commande !
          </h1>
          
          <p className="text-lg text-gray-600 mb-8">
            Votre paiement a été traité avec succès. Vous recevrez bientôt un email de confirmation avec tous les détails de votre inscription.
          </p>
          
          <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 justify-center">
            <Link
              to="/dashboard"
              className="btn-primary flex items-center justify-center"
            >
              <Calendar size={18} className="mr-2" />
              Voir mes inscriptions
            </Link>
            <Link
              to="/"
              className="btn-outline flex items-center justify-center"
            >
              <Home size={18} className="mr-2" />
              Retour à l'accueil
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderConfirmationPage;