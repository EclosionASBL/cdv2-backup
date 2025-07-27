import { Dialog } from '@headlessui/react';
import { ShoppingCart, Plus, ArrowRight } from 'lucide-react';
import { useState } from 'react';

interface AddMoreStagesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmProceed: () => void;
  onConfirmAddMore: () => void;
}

export const AddMoreStagesModal = ({ 
  isOpen, 
  onClose, 
  onConfirmProceed, 
  onConfirmAddMore 
}: AddMoreStagesModalProps) => {
  const [termsAccepted, setTermsAccepted] = useState(false);

  return (
    <Dialog open={isOpen} onClose={onClose} className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <Dialog.Overlay className="fixed inset-0 bg-black bg-opacity-30" />

        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-auto p-6">
          <Dialog.Title className="text-lg font-semibold mb-4">
            Souhaitez-vous ajouter d'autres stages ?
          </Dialog.Title>

          <div className="mt-2">
            <p className="text-sm text-gray-600">
              Vous pouvez ajouter d'autres stages à votre panier avant de finaliser votre inscription.
            </p>
            
            <div className="mt-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="ml-2 text-sm text-gray-700">
                  Je confirme avoir lu et j'accepte les{" "}
                  <a 
                    href="https://docs.google.com/document/d/1sIa4kp7SNU3_JDqW6TBiouEc9h0HEc2OMzJiQF7vElI/edit?usp=sharing" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary-600 hover:text-primary-800 underline"
                  >
                    conditions générales
                  </a>{" "}
                  de l'ASBL Éclosion
                </span>
              </label>
            </div>
            
            <div className="mt-6 space-y-4">
              <button
                onClick={onConfirmAddMore}
                className="w-full btn-outline py-3 flex items-center justify-center"
              >
                <Plus className="h-5 w-5 mr-2" />
                Ajouter d'autres stages
              </button>
              
              <button
                onClick={onConfirmProceed}
                disabled={!termsAccepted}
                className={`w-full btn-primary py-3 flex items-center justify-center ${!termsAccepted ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <ShoppingCart className="h-5 w-5 mr-2" />
                Passer à la prochaine étape
                <ArrowRight className="h-4 w-4 ml-2" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
};