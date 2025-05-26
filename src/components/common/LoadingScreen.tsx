import { Loader2 } from 'lucide-react';

const LoadingScreen = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <Loader2 className="h-12 w-12 text-primary-600 animate-spin" />
      <p className="mt-4 text-lg text-gray-600">Chargement en cours...</p>
    </div>
  );
};

export default LoadingScreen;