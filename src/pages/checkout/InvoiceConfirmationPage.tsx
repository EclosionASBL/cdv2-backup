import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCartStore } from '../../stores/cartStore';
import { CheckCircle, Calendar, Home, Loader2, AlertTriangle, FileText, ExternalLink } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const InvoiceConfirmationPage = () => {
  const { clearCart } = useCartStore();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const invoiceUrl = searchParams.get('invoice');
  const registrationIdsParam = searchParams.get('registrationIds');
  
  useEffect(() => {
    // Clear the cart on successful payment
    clearCart();
    
    // Fetch registrations
    const fetchRegistrations = async () => {
      try {
        setIsLoading(true);
        
        let query = supabase
          .from('registrations')
          .select(`
            id,
            payment_status,
            amount_paid,
            price_type,
            invoice_id,
            invoice_url,
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
          .eq('payment_status', 'pending')
          .order('created_at', { ascending: false });
        
        // If we have specific registration IDs, use them
        if (registrationIdsParam) {
          try {
            const registrationIds = JSON.parse(registrationIdsParam);
            if (Array.isArray(registrationIds) && registrationIds.length > 0) {
              query = query.in('id', registrationIds);
            }
          } catch (parseError) {
            console.error('Error parsing registration IDs:', parseError);
          }
        } else {
          // If no specific IDs, limit to recent ones
          query = query.limit(5);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        
        setRegistrations(data || []);
      } catch (err) {
        console.error('Error fetching registrations:', err);
        setError('Une erreur est survenue lors du chargement des inscriptions.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchRegistrations();
  }, [clearCart, registrationIdsParam]);
  
  return (
    <div className="container max-w-3xl mx-auto py-12 px-4 animate-fade-in">
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="p-8">
          <div className="flex justify-center mb-6">
            <div className="p-3 bg-primary-100 rounded-full">
              <FileText size={48} className="text-primary-600" />
            </div>
          </div>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-4 text-center">
            Votre facture a été créée !
          </h1>
          
          <p className="text-lg text-gray-600 mb-8 max-w-lg mx-auto text-center">
            Votre facture a été générée et vous sera envoyée par email. Vous avez 20 jours pour effectuer le paiement.
          </p>

          {invoiceUrl && (
            <div className="flex justify-center mb-8">
              <a 
                href={invoiceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary flex items-center"
              >
                <FileText className="h-5 w-5 mr-2" />
                Voir ma facture
                <ExternalLink className="h-4 w-4 ml-1" />
              </a>
            </div>
          )}
          
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
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          <FileText className="h-4 w-4 mr-1" />
                          Facture en attente
                        </span>
                        <p className="text-sm font-medium text-right mt-1">{reg.amount_paid} €</p>
                        {reg.price_type.includes('reduced') && (
                          <span className="inline-block text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded mt-1">
                            Tarif réduit
                          </span>
                        )}
                        
                        {reg.invoice_url && (
                          <a 
                            href={reg.invoice_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center text-xs text-primary-600 hover:text-primary-700 mt-2"
                          >
                            <FileText className="h-3 w-3 mr-1" />
                            Voir la facture
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-yellow-50 p-4 rounded-lg mb-8">
              <div className="flex">
                <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2" />
                <p className="text-yellow-700">Aucune inscription en attente trouvée.</p>
              </div>
            </div>
          )}
          
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

export default InvoiceConfirmationPage;