import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuthStore } from '../../stores/authStore';
import { Loader2, Eye, EyeOff, CheckCircle, Mail } from 'lucide-react';

interface RegisterFormData {
  email: string;
  password: string;
  confirmPassword: string;
}

const RegisterPage = () => {
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
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
      const { user, error } = await signUp(data.email, data.password);
      
      if (error) {
        if (error?.message?.includes('user_already_exists') || error?.message?.includes('User already registered')) {
          setRegisterError('Cette adresse email est déjà utilisée. Veuillez vous connecter ou utiliser une autre adresse email.');
        } else {
          setRegisterError("Une erreur est survenue lors de l'inscription. Veuillez réessayer plus tard.");
        }
        return;
      }
      
      // Check if email confirmation is required
      if (user && !user.email_confirmed_at) {
        setEmailSent(true);
      } else {
        navigate('/dashboard');
      }
    } catch (error: any) {
      if (error?.message?.includes('user_already_exists') || error?.message?.includes('User already registered')) {
        setRegisterError('Cette adresse email est déjà utilisée. Veuillez vous connecter ou utiliser une autre adresse email.');
      } else {
        setRegisterError("Une erreur est survenue lors de l'inscription. Veuillez réessayer plus tard.");
      }
    }
  };
  
  if (emailSent) {
    return (
      <div className="animate-fade-in text-center">
        <div className="flex justify-center mb-6">
          <Mail className="h-16 w-16 text-primary-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Vérifiez votre email</h2>
        <p className="text-gray-600 mb-6">
          Un email de confirmation a été envoyé à votre adresse email. Veuillez cliquer sur le lien dans cet email pour activer votre compte.
        </p>
        <p className="text-gray-600 mb-6">
          Si vous ne recevez pas l'email dans les prochaines minutes, vérifiez votre dossier de spam.
        </p>
        <Link
          to="/login"
          className="btn-primary inline-block"
        >
          Retour à la connexion
        </Link>
      </div>
    );
  }
  
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
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              className={`form-input pr-10 ${errors.password ? 'border-red-500 focus:ring-red-500' : ''}`}
              {...register('password', {
                required: 'Mot de passe requis',
                minLength: {
                  value: 6,
                  message: 'Le mot de passe doit contenir au moins 6 caractères',
                },
              })}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          {errors.password && (
            <p className="form-error">{errors.password.message}</p>
          )}
        </div>
        
        <div>
          <label htmlFor="confirmPassword" className="form-label">
            Confirmer le mot de passe
          </label>
          <div className="relative">
            <input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              className={`form-input pr-10 ${errors.confirmPassword ? 'border-red-500 focus:ring-red-500' : ''}`}
              {...register('confirmPassword', {
                required: 'Veuillez confirmer votre mot de passe',
                validate: (value) => value === password || 'Les mots de passe ne correspondent pas',
              })}
            />
            <button
              type="button"
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
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