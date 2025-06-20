import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useCartStore } from '../../stores/cartStore';
import { supabase } from '../../lib/supabase';
import { Loader2, AlertCircle, FileText, Info } from 'lucide-react';
import { Dialog } from '@headlessui/react';
import { PayLaterConfirmModal } from '../../components/checkout/PayLaterConfirmModal';

interface LoginFormData {
  email: string;
  password: string;
}

const CheckoutPage = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPayLaterModalOpen, setIsPayLaterModalOpen] = useState(false);
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

  const handleValidateInscriptions = () => {
    // Check if user profile is complete
    if (!profile || !profile.prenom || !profile.nom || !profile.adresse || !profile.cpostal || !profile.localite || !profile.telephone) {
      setError('Veuillez compléter votre profil avant de continuer. Des informations sont manquantes.');
      setTimeout(() => {
        navigate('/profile');
      }, 3000);
      return;
    }
    
    setIsPayLaterModalOpen(true);
  };
  
  const handlePayLaterConfirm = async () => {
    if (!user) {
      setError('Vous devez être connecté pour effectuer un paiement.');
      return;
    }

    if (items.length === 0) {
      setError('Votre panier est vide.');
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      // Get the current session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        throw new Error('Erreur lors de la récupération de la session: ' + sessionError.message);
      }
      
      if (!session?.access_token) {
        throw new Error('Session expirée. Veuillez vous reconnecter.');
      }
      
      // Call our Supabase Edge Function to create an invoice
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-invoice`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            items: items.map(item => ({
              ...item,
              price: item.price * 100 // Convert to cents for Stripe
            }))
          }),
        }
      );
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Une erreur est survenue lors de la création de la facture.');
      }

      // Note: We're removing the clearCart() call here
      // The cart will be cleared in the InvoiceConfirmationPage component
      
      // Include registrationIds in the URL if available
      const registrationIdsParam = data.registrationIds ? 
        `&registrationIds=${encodeURIComponent(JSON.stringify(data.registrationIds))}` : '';
        
      navigate(`/invoice-confirmation?invoice=${encodeURIComponent(data.invoiceUrl || '')}${registrationIdsParam}`);
    } catch (error: any) {
      console.error('Error creating invoice:', error);
      setError(error.message || 'Une erreur est survenue lors de la création de la facture.');
    } finally {
      setIsLoading(false);
      setIsPayLaterModalOpen(false);
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
                      <Info className="text-green-600 mr-2 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-green-700">
                        Vous avez déclaré sur l'honneur que vos revenus sont inférieurs au seuil requis pour bénéficier du tarif réduit.
                      </p>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="space-y-4">
                <button
                  onClick={handleValidateInscriptions}
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
                      <FileText className="h-5 w-5 mr-2" />
                      Valider les inscriptions
                    </span>
                  )}
                </button>
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

      {/* Pay Later Confirmation Modal */}
      <PayLaterConfirmModal
        isOpen={isPayLaterModalOpen}
        onClose={() => {
          setIsPayLaterModalOpen(false);
          setIsLoading(false); // Reset loading state if modal is closed
        }}
        onConfirm={handlePayLaterConfirm}
        isLoading={isLoading}
      />
    </div>
  );
};

export default CheckoutPage;