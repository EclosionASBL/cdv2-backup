import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuthStore } from '../../stores/authStore';
import { Loader2 } from 'lucide-react';

interface RegisterFormData {
  email: string;
  password: string;
  confirmPassword: string;
}

const RegisterPage = () => {
  const [registerError, setRegisterError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { signUp, isLoading } = useAuthStore();
  
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterFormData>();
  
  const password = watch('password');
  
  const onSubmit = async (data: RegisterFormData) => {
    try {
      setRegisterError(null);
      await signUp(data.email, data.password);
      navigate('/dashboard');
    } catch (error: any) {
      if (error?.message?.includes('user_already_exists') || error?.message?.includes('User already registered')) {
        setRegisterError('Cette adresse email est déjà utilisée. Veuillez vous connecter ou utiliser une autre adresse email.');
      } else {
        setRegisterError("Une erreur est survenue lors de l'inscription. Veuillez réessayer plus tard.");
      }
    }
  };
  
  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Créer un compte</h2>
      
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
          <label htmlFor="password" className="form-label">
            Mot de passe
          </label>
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
        
        <div>
          <label htmlFor="confirmPassword" className="form-label">
            Confirmer le mot de passe
          </label>
          <input
            id="confirmPassword"
            type="password"
            className={`form-input ${errors.confirmPassword ? 'border-red-500 focus:ring-red-500' : ''}`}
            {...register('confirmPassword', {
              required: 'Veuillez confirmer votre mot de passe',
              validate: (value) => value === password || 'Les mots de passe ne correspondent pas',
            })}
          />
          {errors.confirmPassword && (
            <p className="form-error">{errors.confirmPassword.message}</p>
          )}
        </div>
        
        {registerError && (
          <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm">
            {registerError}
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
              Inscription en cours...
            </span>
          ) : (
            "S'inscrire"
          )}
        </button>
      </form>
      
      <div className="mt-6 text-center">
        <p className="text-gray-600">
          Déjà un compte ?{' '}
          <Link to="/login" className="text-primary-600 hover:text-primary-800 font-medium">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;