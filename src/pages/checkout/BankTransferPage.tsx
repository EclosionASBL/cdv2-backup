import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { useCartStore } from '../../stores/cartStore';
import { CheckCircle, Copy, FileText, Home, Info } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

const BankTransferPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const { clearCart } = useCartStore();
  
  const [copySuccess, setCopySuccess] = useState(false);
  
  const invoiceId = searchParams.get('invoice_id');
  const amount = searchParams.get('amount');
  const communication = searchParams.get('communication');
  
  useEffect(() => {
    // Clear the cart on successful payment
    clearCart();
    
    // If no invoice data is present, redirect to dashboard
    if (!invoiceId || !amount || !communication) {
      navigate('/dashboard');
    }
  }, [clearCart, invoiceId, amount, communication, navigate]);
  
  const handleCopyCommunication = () => {
    if (communication) {
      navigator.clipboard.writeText(communication);
      setCopySuccess(true);
      toast.success('Communication copiée !');
      
      // Reset copy success after 3 seconds
      setTimeout(() => {
        setCopySuccess(false);
      }, 3000);
    }
  };
  
  if (!invoiceId || !amount || !communication) {
    return null; // Will redirect in useEffect
  }
  
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
            Votre inscription est confirmée !
          </h1>
          
          <p className="text-lg text-gray-600 mb-8 max-w-lg mx-auto text-center">
            Veuillez effectuer le virement bancaire en utilisant les informations ci-dessous.
          </p>
          
          <div className="bg-gray-50 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Informations de paiement</h2>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-500">Montant à payer</p>
                <p className="text-xl font-bold text-primary-600">{amount} €</p>
              </div>
              
              <div>
                <p className="text-sm text-gray-500">Numéro de facture</p>
                <p className="font-medium">{invoiceId}</p>
              </div>
              
              <div>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-gray-500">Communication structurée</p>
                  <button 
                    onClick={handleCopyCommunication}
                    className="text-primary-600 hover:text-primary-700 text-sm flex items-center"
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    {copySuccess ? 'Copié !' : 'Copier'}
                  </button>
                </div>
                <p className="font-medium font-mono">{communication}</p>
              </div>
              
              <div>
                <p className="text-sm text-gray-500">IBAN</p>
                <p className="font-medium font-mono">BE12 3456 7890 1234</p>
              </div>
              
              <div>
                <p className="text-sm text-gray-500">Bénéficiaire</p>
                <p className="font-medium">Éclosion ASBL</p>
              </div>
            </div>
          </div>
          
          <div className="bg-yellow-50 p-4 rounded-lg mb-8">
            <div className="flex items-start">
              <Info className="h-5 w-5 text-yellow-500 mr-2 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-yellow-700 font-medium">Important</p>
                <p className="text-sm text-yellow-700">
                  Veuillez effectuer le paiement dans les 20 jours. Votre inscription sera confirmée dès réception du paiement.
                </p>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 justify-center">
            <Link
              to="/dashboard"
              className="btn-primary flex items-center justify-center"
            >
              <FileText size={18} className="mr-2" />
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
      <Toaster position="top-right" />
    </div>
  );
};

export default BankTransferPage;