import { Dialog } from '@headlessui/react';
import { ShoppingCart, Plus, ArrowRight } from 'lucide-react';

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
                className="w-full btn-primary py-3 flex items-center justify-center"
              >
                <ShoppingCart className="h-5 w-5 mr-2" />
                Procéder au paiement
                <ArrowRight className="h-4 w-4 ml-2" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
};