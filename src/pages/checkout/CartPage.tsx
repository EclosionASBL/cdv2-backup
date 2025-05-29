import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCartStore, CartItem } from '../../stores/cartStore';
import { useKidStore } from '../../stores/kidStore';
import { useActivityStore } from '../../stores/activityStore';
import { ShoppingCart, Trash2, AlertCircle, ChevronRight, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { AddMoreStagesModal } from '../../components/checkout/AddMoreStagesModal';

const CartPage = () => {
  const { items, removeItem, clearCart, total } = useCartStore();
  const { kids, fetchKids } = useKidStore();
  const { clearKidFilter } = useActivityStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAddMoreStagesModalOpen, setIsAddMoreStagesModalOpen] = useState(false);
  const navigate = useNavigate();
  
  useEffect(() => {
    fetchKids();
  }, [fetchKids]);
  
  const handleCheckout = () => {
    setIsAddMoreStagesModalOpen(true);
  };
  
  const handleProceedToPayment = () => {
    setIsAddMoreStagesModalOpen(false);
    navigate('/checkout');
  };

  const handleAddMoreStages = () => {
    setIsAddMoreStagesModalOpen(false);
    clearKidFilter();
    navigate('/activities');
  };
  
  if (items.length === 0) {
    return (
      <div className="container max-w-5xl mx-auto py-12 px-4">
        <h1 className="text-3xl font-bold mb-8">Mon Panier</h1>
        
        <div className="bg-white rounded-xl shadow-md p-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-gray-100 rounded-full">
              <ShoppingCart size={48} className="text-gray-400" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-gray-700 mb-4">Votre panier est vide</h2>
          <p className="text-gray-600 mb-6">
            Aucun stage n'a été ajouté à votre panier. Parcourez notre catalogue pour trouver des activités passionnantes pour vos enfants.
          </p>
          <Link
            to="/activities"
            className="btn-primary inline-block"
          >
            Découvrir les stages
          </Link>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container max-w-6xl mx-auto py-12 px-4 animate-fade-in">
      <h1 className="text-3xl font-bold mb-8">Mon Panier</h1>
      
      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-2">
          <div className="bg-white rounded-xl shadow-md overflow-hidden mb-6">
            <div className="p-4 bg-gray-50 border-b">
              <h2 className="text-lg font-semibold">Activités sélectionnées</h2>
            </div>
            
            <div>
              {items.map((item: CartItem) => (
                <div key={item.id} className="border-b last:border-b-0">
                  <div className="p-4 flex flex-col sm:flex-row">
                    <div className="flex-shrink-0 mb-4 sm:mb-0 sm:mr-4">
                      <div className="h-24 w-24 bg-gray-100 rounded-lg overflow-hidden">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.activityName}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center bg-primary-50">
                            <span className="text-primary-500 font-medium">
                              {item.activityCategory.slice(0, 1).toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex-grow">
                      <div className="flex flex-col sm:flex-row sm:justify-between">
                        <div>
                          <h3 className="font-semibold text-lg mb-1">
                            {item.activityName}
                          </h3>
                          <p className="text-sm text-gray-600 mb-1">
                            Catégorie: {item.activityCategory}
                          </p>
                          <p className="text-sm text-gray-600 mb-2">
                            Période: {item.dateRange}
                          </p>
                          <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800 mb-2">
                            Pour: {item.kidName}
                          </div>
                          {item.price_type.includes('reduced') && (
                            <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 ml-2">
                              Tarif réduit
                            </div>
                          )}
                          {item.price_type.includes('local') && (
                            <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 ml-2">
                              Tarif local
                            </div>
                          )}
                        </div>
                        
                        <div className="mt-3 sm:mt-0 sm:text-right">
                          <p className="text-lg font-bold text-primary-600">
                            {item.price} €
                          </p>
                          <button
                            onClick={() => removeItem(item.id)}
                            className="mt-2 inline-flex items-center text-sm text-red-600 hover:text-red-800"
                          >
                            <Trash2 size={16} className="mr-1" />
                            Supprimer
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="p-4 bg-gray-50 flex justify-between items-center">
              <button
                onClick={() => clearCart()}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                Vider le panier
              </button>
              <Link
                to="/activities"
                className="text-sm text-primary-600 hover:text-primary-800 font-medium"
              >
                Continuer les achats
              </Link>
            </div>
          </div>
        </div>
        
        <div className="md:col-span-1">
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="p-4 bg-gray-50 border-b">
              <h2 className="text-lg font-semibold">Récapitulatif</h2>
            </div>
            
            <div className="p-4">
              <div className="space-y-3 mb-4">
                {items.map((item) => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      {item.activityName} ({item.kidName})
                    </span>
                    <span className="font-medium">{item.price} €</span>
                  </div>
                ))}
              </div>
              
              <div className="border-t pt-3 mb-4">
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span className="text-lg text-primary-600">{total()} €</span>
                </div>
              </div>
              
              {error && (
                <div className="bg-red-50 p-3 rounded-lg mb-4">
                  <div className="flex items-start">
                    <AlertCircle size={20} className="text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              )}
              
              <div className="bg-primary-50 p-3 rounded-lg mb-4">
                <div className="flex items-start">
                  <AlertCircle size={20} className="text-primary-600 mr-2 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-primary-700">
                    Vous recevrez une facture par email et aurez 20 jours pour effectuer le paiement.
                  </p>
                </div>
              </div>
              
              <button
                onClick={handleCheckout}
                disabled={isLoading}
                className="btn-primary w-full py-3 flex items-center justify-center"
              >
                {isLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin mr-2" />
                    Chargement...
                  </>
                ) : (
                  <>
                    {items.length > 1 ? 'Valider les inscriptions' : 'Valider l\'inscription'}
                    <ChevronRight size={18} className="ml-1" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Add More Stages Confirmation Modal */}
      <AddMoreStagesModal
        isOpen={isAddMoreStagesModalOpen}
        onClose={() => setIsAddMoreStagesModalOpen(false)}
        onConfirmProceed={handleProceedToPayment}
        onConfirmAddMore={handleAddMoreStages}
      />
    </div>
  );
};

export default CartPage;