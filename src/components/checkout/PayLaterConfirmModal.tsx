import { Dialog } from '@headlessui/react';
import { Info, Loader2 } from 'lucide-react';
import { useState } from 'react';

interface PayLaterConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isLoading: boolean;
}

export const PayLaterConfirmModal = ({ isOpen, onClose, onConfirm, isLoading }: PayLaterConfirmModalProps) => {
  const [isConfirmed, setIsConfirmed] = useState(false);

  const handleConfirm = () => {
    if (!isConfirmed || isLoading) return;
    onConfirm();
  };

  return (
    <Dialog open={isOpen} onClose={onClose} className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center p-4">
        <Dialog.Overlay className="fixed inset-0 bg-black bg-opacity-30" />

        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-auto p-6">
          <div className="flex items-start mb-4">
            <div className="flex-shrink-0">
              <Info className="h-6 w-6 text-primary-600" />
            </div>
            <div className="ml-3">
              <Dialog.Title className="text-lg font-semibold text-gray-900">
                Confirmation d'inscription
              </Dialog.Title>
            </div>
          </div>

          <div className="mt-2">
            <p className="text-sm text-gray-600">
              Vous recevrez la facture par email et vous aurez 20 jours pour la payer. 
            </p>
            
            <div className="mt-4 p-4 bg-primary-50 rounded-lg">
              <p className="text-sm text-primary-800">
                En cliquant sur 'Valider l'inscription', vous vous engagez à payer dans le délai imparti.
              </p>
            </div>

            <div className="mt-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={isConfirmed}
                  onChange={(e) => setIsConfirmed(e.target.checked)}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <span className="ml-2 text-sm text-gray-700">
                  J'accepte de payer la facture dans les 20 jours
                </span>
              </label>
            </div>
          </div>

          <div className="mt-6 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className={`btn-outline ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!isConfirmed || isLoading}
              className={`btn-primary ${(!isConfirmed || isLoading) ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isLoading ? (
                <span className="flex items-center">
                  <Loader2 className="animate-spin mr-2 h-4 w-4" />
                  Traitement en cours...
                </span>
              ) : (
                'Valider l\'inscription'
              )}
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  );
};