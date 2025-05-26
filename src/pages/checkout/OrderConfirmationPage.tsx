import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCartStore } from '../../stores/cartStore';
import { CheckCircle, Calendar, Home, Loader2, AlertTriangle, FileText } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const OrderConfirmationPage = () => {
  const { clearCart } = useCartStore();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'immediate' | 'invoice'>('immediate');
  
  useEffect(() => {
    // Clear the cart on successful payment
    clearCart();
    
    // Fetch registrations
    const fetchRegistrations = async () => {
      try {
        setIsLoading(true);
        
        const { data, error } = await supabase
          .from('registrations')
          .select(`
            id,
            payment_status,
            amount_paid,
            price_type,
            invoice_id,
            kids!inner (
              prenom,
              nom
            ),
            session:activity_id(
              stage:stage_id(
                title
              ),
              start_date,
              end_date,
              center:center_id(
                name
              )
            )
          `)
          .order('created_at', { ascending: false })
          .limit(5);
        
        if (error) throw error;
        
        setRegistrations(data || []);
        
        // Determine payment method based on the first registration
        if (data && data.length > 0) {
          setPaymentMethod(data[0].invoice_id ? 'invoice' : 'immediate');
        }
      } catch (err) {
        console.error('Error fetching registrations:', err);
        setError('Une erreur est survenue lors du chargement des inscriptions.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchRegistrations();
  }, [clearCart]);
  
  return (
    <div className="container max-w-3xl mx-auto py-12 px-4 animate-fade-in">
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="p-8">
          <div className="flex justify-center mb-6">
            <div className="p-3 bg-green-100 rounded-full">
              <CheckCircle size={48} className="text-green-500" />
            </div>
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-4 text-center">
            {paymentMethod === 'immediate' 
              ? 'Merci pour votre commande !'
              : 'Votre inscription est confirmée !'}
          </h1>
          
          <p className="text-lg text-gray-600 mb-8 max-w-lg mx-auto text-center">
            {paymentMethod === 'immediate' 
              ? 'Votre paiement a été traité avec succès. Vous recevrez bientôt un email de confirmation avec tous les détails de votre inscription.'
              : 'Votre facture a été générée et vous sera envoyée par email. Vous avez 20 jours pour effectuer le paiement.'}
          </p>
          
          {isLoading ? (
            <div className="flex justify-center my-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            </div>
          ) : error ? (
            <div className="bg-red-50 p-4 rounded-lg mb-8">
              <div className="flex">
                <AlertTriangle className="h-5 w-5 text-red-500 mr-2" />
                <p className="text-red-700">{error}</p>
              </div>
            </div>
          ) : registrations.length > 0 ? (
            <div className="bg-gray-50 rounded-lg p-6 mb-8">
              <h2 className="text-xl font-semibold mb-4">Vos inscriptions récentes</h2>
              <div className="space-y-4">
                {registrations.map((reg) => (
                  <div key={reg.id} className="bg-white p-4 rounded-lg shadow-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium">{reg.session.stage.title}</h3>
                        <p className="text-sm text-gray-600">
                          {new Date(reg.session.start_date).toLocaleDateString('fr-FR')} - {new Date(reg.session.end_date).toLocaleDateString('fr-FR')}
                        </p>
                        <p className="text-sm text-gray-600">
                          Pour: {reg.kids.prenom} {reg.kids.nom}
                        </p>
                        <p className="text-sm text-gray-600">
                          Centre: {reg.session.center.name}
                        </p>
                      </div>
                      <div>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          reg.payment_status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {reg.payment_status === 'paid' ? 'Payé' : 'En attente'}
                        </span>
                        <p className="text-sm font-medium text-right mt-1">{reg.amount_paid} €</p>
                        {reg.price_type.includes('reduced') && (
                          <span className="inline-block text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded mt-1">
                            Tarif réduit
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          
          <div className="bg-primary-50 p-6 rounded-lg max-w-lg mx-auto mb-8">
            <h2 className="text-xl font-semibold text-primary-700 mb-4 text-center">Que se passe-t-il maintenant ?</h2>
            <div className="space-y-3 text-left">
              <div className="flex items-start">
                <div className="bg-white p-1.5 rounded-full mr-3 flex-shrink-0">
                  <span className="flex items-center justify-center h-5 w-5 bg-primary-500 text-white rounded-full text-xs font-bold">
                    1
                  </span>
                </div>
                <p className="text-sm text-primary-700">
                  {paymentMethod === 'immediate'
                    ? 'Un email de confirmation a été envoyé à votre adresse email'
                    : 'Une facture a été générée et vous sera envoyée par email'}
                </p>
              </div>
              <div className="flex items-start">
                <div className="bg-white p-1.5 rounded-full mr-3 flex-shrink-0">
                  <span className="flex items-center justify-center h-5 w-5 bg-primary-500 text-white rounded-full text-xs font-bold">
                    2
                  </span>
                </div>
                <p className="text-sm text-primary-700">
                  Vous pouvez consulter les détails de votre inscription dans votre tableau de bord
                </p>
              </div>
              <div className="flex items-start">
                <div className="bg-white p-1.5 rounded-full mr-3 flex-shrink-0">
                  <span className="flex items-center justify-center h-5 w-5 bg-primary-500 text-white rounded-full text-xs font-bold">
                    3
                  </span>
                </div>
                <p className="text-sm text-primary-700">
                  Quelques jours avant le début du stage, vous recevrez un email avec les informations pratiques
                </p>
              </div>
              {paymentMethod === 'invoice' && (
                <div className="flex items-start">
                  <div className="bg-white p-1.5 rounded-full mr-3 flex-shrink-0">
                    <span className="flex items-center justify-center h-5 w-5 bg-primary-500 text-white rounded-full text-xs font-bold">
                      4
                    </span>
                  </div>
                  <p className="text-sm text-primary-700">
                    Vous avez 20 jours pour effectuer le paiement de votre facture
                  </p>
                </div>
              )}
            </div>
          </div>
          
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