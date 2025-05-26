import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useCartStore } from '../../stores/cartStore';
import { supabase } from '../../lib/supabase';
import { Loader2, AlertCircle, CreditCard, Lock, FileText, CheckCircle } from 'lucide-react';
import { Dialog } from '@headlessui/react';

const CheckoutPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isReducedPriceModalOpen, setIsReducedPriceModalOpen] = useState(false);
  const [reducedPriceConfirmed, setReducedPriceConfirmed] = useState(false);
  const [isReducedPrice, setIsReducedPrice] = useState(false);
  const { user, profile, fetchProfile } = useAuthStore();
  const { items, total, clearCart, updatePriceType, setReducedDeclaration } = useCartStore();
  const navigate = useNavigate();
  
  useEffect(() => {
    if (items.length === 0) {
      navigate('/cart');
    }
    
    if (user && !profile) {
      fetchProfile();
    }

    // Check if any items already have reduced price
    const hasReducedItems = items.some(item => 
      item.price_type === 'reduced' || item.price_type === 'local_reduced'
    );
    
    if (hasReducedItems) {
      setIsReducedPrice(true);
      setReducedPriceConfirmed(true);
    }
  }, [items, user, profile, navigate, fetchProfile]);

  const handleReducedPriceToggle = () => {
    if (!isReducedPrice) {
      setIsReducedPriceModalOpen(true);
    } else {
      setIsReducedPrice(false);
      updatePriceType('normal');
      setReducedDeclaration(false);
    }
  };

  const confirmReducedPrice = () => {
    setIsReducedPrice(true);
    updatePriceType('reduced');
    setReducedDeclaration(true);
    setReducedPriceConfirmed(true);
    setIsReducedPriceModalOpen(false);
  };
  
  const handleCheckout = async (payLater = false) => {
    try {
      if (!user) {
        throw new Error('Vous devez être connecté pour effectuer un paiement.');
      }

      if (items.length === 0) {
        throw new Error('Votre panier est vide.');
      }

      // Validate all items have session_id
      const invalidItem = items.find(item => !item.session_id || item.session_id.trim() === '');
      if (invalidItem) {
        throw new Error(`ID activité manquant pour l'article: ${invalidItem.activityName}. Veuillez supprimer cet article et le rajouter au panier.`);
      }

      // Validate prices
      const invalidPrice = items.find(item => !item.price || item.price <= 0);
      if (invalidPrice) {
        throw new Error(`Prix invalide pour l'article: ${invalidPrice.activityName}`);
      }
      
      setIsLoading(true);
      setError(null);
      
      // Get the current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        throw new Error('Erreur lors de la récupération de la session: ' + sessionError.message);
      }
      
      if (!session?.access_token) {
        throw new Error('Session expirée. Veuillez vous reconnecter.');
      }
      
      // Call our Supabase Edge Function to create a Stripe checkout session
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            items: items.map(item => ({
              ...item,
              activity_id: item.session_id, // Use session_id as activity_id
              price: item.price * 100 // Convert to cents for Stripe
            })),
            payLater,
            successUrl: `${window.location.origin}/order-confirmation`,
            cancelUrl: `${window.location.origin}/cart`,
          }),
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Checkout error response:', errorData);
        throw new Error(errorData.error || 'Une erreur est survenue lors de la création de la session de paiement.');
      }
      
      const { url, error: stripeError } = await response.json();
      
      if (stripeError) {
        console.error('Stripe error:', stripeError);
        throw new Error(stripeError);
      }
      
      if (!url) {
        throw new Error('Aucune URL de paiement n\'a été reçue.');
      }

      // Redirect to Stripe Checkout or Invoice
      window.location.href = url;
    } catch (error: any) {
      console.error('Error creating checkout session:', error);
      setError(error.message || 'Une erreur est survenue lors de la création de la session de paiement.');
    } finally {
      setIsLoading(false);
    }
  };
  
  return (
    <div className="container max-w-5xl mx-auto py-12 px-4 animate-fade-in">
      <h1 className="text-3xl font-bold mb-8">Finaliser la commande</h1>
      
      <div className="grid md:grid-cols-2 gap-8">
        <div className="order-2 md:order-1">
          <div className="bg-white rounded-xl shadow-md overflow-hidden mb-6">
            <div className="p-4 bg-gray-50 border-b">
              <h2 className="text-lg font-semibold">Informations de facturation</h2>
            </div>
            
            <div className="p-4">
              {profile ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium text-gray-700 mb-1">Contact</h3>
                    <p className="text-gray-600">
                      {profile.prenom} {profile.nom}
                    </p>
                    <p className="text-gray-600">{user?.email}</p>
                    <p className="text-gray-600">{profile.telephone || 'Aucun numéro renseigné'}</p>
                  </div>
                  
                  <div>
                    <h3 className="font-medium text-gray-700 mb-1">Adresse</h3>
                    {profile.adresse && profile.cpostal && profile.localite ? (
                      <>
                        <p className="text-gray-600">{profile.adresse}</p>
                        <p className="text-gray-600">
                          {profile.cpostal} {profile.localite}
                        </p>
                      </>
                    ) : (
                      <p className="text-gray-600">Aucune adresse renseignée</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="py-4 flex justify-center">
                  <Loader2 className="h-8 w-8 text-primary-600 animate-spin" />
                </div>
              )}
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="p-4 bg-gray-50 border-b">
              <h2 className="text-lg font-semibold">Options de paiement</h2>
            </div>
            
            <div className="p-4">
              <div className="mb-6">
                <label className="flex items-center space-x-3 mb-4">
                  <input
                    type="checkbox"
                    checked={isReducedPrice}
                    onChange={handleReducedPriceToggle}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Appliquer le tarif réduit
                  </span>
                </label>
                
                {isReducedPrice && reducedPriceConfirmed && (
                  <div className="bg-green-50 p-3 rounded-lg">
                    <div className="flex items-start">
                      <CheckCircle size={20} className="text-green-600 mr-2 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-green-700">
                        Vous avez déclaré sur l'honneur que vos revenus sont inférieurs au seuil requis pour bénéficier du tarif réduit.
                      </p>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="space-y-4">
                <button
                  onClick={() => handleCheckout(false)}
                  disabled={isLoading}
                  className="w-full btn-primary py-3 flex items-center justify-center"
                >
                  {isLoading ? (
                    <span className="flex items-center">
                      <Loader2 className="animate-spin mr-2 h-4 w-4" />
                      Traitement en cours...
                    </span>
                  ) : (
                    <span className="flex items-center">
                      <CreditCard className="h-5 w-5 mr-2" />
                      Payer maintenant
                    </span>
                  )}
                </button>
                
                <button
                  onClick={() => handleCheckout(true)}
                  disabled={isLoading}
                  className="w-full btn-outline py-3 flex items-center justify-center"
                >
                  {isLoading ? (
                    <span className="flex items-center">
                      <Loader2 className="animate-spin mr-2 h-4 w-4" />
                      Traitement en cours...
                    </span>
                  ) : (
                    <span className="flex items-center">
                      <FileText className="h-5 w-5 mr-2" />
                      Payer plus tard (facture)
                    </span>
                  )}
                </button>
              </div>
              
              <div className="mt-4 text-sm text-gray-600">
                <p className="flex items-center">
                  <Lock className="h-4 w-4 mr-1 text-gray-500" />
                  Paiement sécurisé par Stripe
                </p>
              </div>
              
              {error && (
                <div className="mt-4 bg-red-50 p-3 rounded-lg">
                  <div className="flex items-start">
                    <AlertCircle size={20} className="text-red-600 mr-2 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        <div className="order-1 md:order-2">
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="p-4 bg-gray-50 border-b">
              <h2 className="text-lg font-semibold">Récapitulatif de la commande</h2>
            </div>
            
            <div className="p-4">
              <div className="space-y-3 mb-4">
                {items.map((item) => (
                  <div key={item.id} className="flex justify-between">
                    <div className="flex-grow">
                      <p className="font-medium">{item.activityName}</p>
                      <p className="text-sm text-gray-600">Pour {item.kidName}</p>
                      <p className="text-xs text-gray-500">{item.dateRange}</p>
                      {item.price_type.includes('reduced') && (
                        <span className="inline-block text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded">
                          Tarif réduit
                        </span>
                      )}
                    </div>
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
              
              <div className="bg-primary-50 p-3 rounded-lg mb-4">
                <div className="flex items-start">
                  <AlertCircle size={20} className="text-primary-600 mr-2 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-primary-700">
                    {isReducedPrice 
                      ? "Vous bénéficiez du tarif réduit sur présentation de justificatifs."
                      : "Vous pouvez bénéficier d'un tarif réduit si vos revenus sont inférieurs au seuil requis."}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reduced Price Confirmation Modal */}
      <Dialog
        open={isReducedPriceModalOpen}
        onClose={() => setIsReducedPriceModalOpen(false)}
        className="fixed inset-0 z-50 overflow-y-auto"
      >
        <div className="flex min-h-screen items-center justify-center p-4">
          <Dialog.Overlay className="fixed inset-0 bg-black bg-opacity-30" />

          <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-auto p-6">
            <Dialog.Title className="text-lg font-medium mb-4">
              Déclaration sur l'honneur
            </Dialog.Title>

            <div className="mb-6">
              <p className="text-gray-700 mb-4">
                En sélectionnant le tarif réduit, je déclare sur l'honneur que mes revenus sont inférieurs au seuil de 2 070,48 € net par mois.
              </p>
              <p className="text-gray-700 mb-4">
                Je comprends que des justificatifs pourront m'être demandés et que toute fausse déclaration pourra entraîner l'annulation de l'inscription.
              </p>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={reducedPriceConfirmed}
                  onChange={(e) => setReducedPriceConfirmed(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  Je confirme cette déclaration sur l'honneur
                </span>
              </label>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setIsReducedPriceModalOpen(false)}
                className="btn-outline"
              >
                Annuler
              </button>
              <button
                onClick={confirmReducedPrice}
                disabled={!reducedPriceConfirmed}
                className="btn-primary"
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      </Dialog>
    </div>
  );
};

export default CheckoutPage;