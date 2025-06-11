import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';

const NewsletterSection = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      setError('Veuillez entrer une adresse email');
      return;
    }

    // Simple email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Veuillez entrer une adresse email valide');
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Call the Supabase Edge Function
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/subscribe-newsletter`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(session?.access_token 
              ? { 'Authorization': `Bearer ${session.access_token}` }
              : {}),
          },
          body: JSON.stringify({ email }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Une erreur est survenue');
      }

      setSuccess(data.message || 'Vous êtes maintenant inscrit à notre newsletter');
      setEmail(''); // Clear the input on success
    } catch (err) {
      console.error('Error subscribing to newsletter:', err);
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="py-16 bg-primary-50">
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="grid md:grid-cols-2">
            <div className="p-8 md:p-12">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-4">
                Restez informé !
              </h2>
              <p className="text-gray-600 mb-6">
                Inscrivez-vous à notre newsletter pour être informé des nouveaux stages et offres spéciales.
              </p>
              
              {success ? (
                <div className="bg-green-50 p-4 rounded-lg flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
                  <p className="text-green-700">{success}</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="email"
                    placeholder="Votre adresse email"
                    className="form-input flex-grow"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <button
                    type="submit"
                    className="btn-primary whitespace-nowrap"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <span className="flex items-center">
                        <Loader2 className="animate-spin mr-2 h-4 w-4" />
                        Inscription...
                      </span>
                    ) : (
                      "S'inscrire"
                    )}
                  </button>
                </form>
              )}
              
              {error && (
                <div className="mt-4 bg-red-50 p-3 rounded-lg flex items-start">
                  <AlertCircle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
                  <p className="text-red-700">{error}</p>
                </div>
              )}
            </div>
            <div className="hidden md:block">
              <img
                src="https://images.pexels.com/photos/3905856/pexels-photo-3905856.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=2"
                alt="Enfants jouant ensemble"
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default NewsletterSection;