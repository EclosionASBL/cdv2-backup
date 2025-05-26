import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuthStore } from '../../stores/authStore';
import { Loader2 } from 'lucide-react';

interface LoginFormData {
  email: string;
  password: string;
}

const LoginPage = () => {
  const [loginError, setLoginError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { signIn, isLoading, profile, isAdmin } = useAuthStore();
  
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>();
  
  const onSubmit = async (data: LoginFormData) => {
    try {
      setLoginError(null);
      const { error } = await signIn(data.email, data.password);
      
      if (error) {
        setLoginError('Email ou mot de passe incorrect');
        return;
      }

      // Navigate based on user role
      if (isAdmin()) {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }
    } catch (error: any) {
      setLoginError('Une erreur est survenue lors de la connexion');
    }
  };
  
  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Connexion</h2>
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label htmlFor="email" className="form-label">
            Email
          </label>
          <input
            id="email"
            type="email"
            className={`form-input ${errors.email ? 'border-red-500 focus:ring-red-500' : ''}`}
            {...register('email', {
              required: 'Email requis',
              pattern: {
                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                message: 'Email invalide',
              },
            })}
          />
          {errors.email && (
            <p className="form-error">{errors.email.message}</p>
          )}
        </div>
        
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="form-label">
              Mot de passe
            </label>
            <Link
              to="/reset-password"
              className="text-sm text-primary-600 hover:text-primary-800"
            >
              Mot de passe oublié?
            </Link>
          </div>
          <input
            id="password"
            type="password"
            className={`form-input ${errors.password ? 'border-red-500 focus:ring-red-500' : ''}`}
            {...register('password', {
              required: 'Mot de passe requis',
              minLength: {
                value: 6,
                message: 'Le mot de passe doit contenir au moins 6 caractères',
              },
            })}
          />
          {errors.password && (
            <p className="form-error">{errors.password.message}</p>
          )}
        </div>
        
        {loginError && (
          <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm">
            {loginError}
          </div>
        )}
        
        <button
          type="submit"
          className="btn-primary w-full py-2.5"
          disabled={isLoading}
        >
          {isLoading ? (
            <span className="flex items-center justify-center">
              <Loader2 className="animate-spin mr-2 h-4 w-4" />
              Connexion en cours...
            </span>
          ) : (
            'Se connecter'
          )}
        </button>
      </form>
      
      <div className="mt-6 text-center">
        <p className="text-gray-600">
          Pas encore de compte ?{' '}
          <Link to="/register" className="text-primary-600 hover:text-primary-800 font-medium">
            S'inscrire
          </Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;