import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuthStore } from '../../stores/authStore';
import { Loader2, CheckCircle, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ResetPasswordFormData {
  email: string;
}

interface NewPasswordFormData {
  password: string;
  confirmPassword: string;
}

const ResetPasswordPage = () => {
  const [isSuccess, setIsSuccess] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [isPasswordUpdated, setIsPasswordUpdated] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { resetPassword, isLoading } = useAuthStore();
  
  const {
    register: registerReset,
    handleSubmit: handleSubmitReset,
    formState: { errors: errorsReset },
  } = useForm<ResetPasswordFormData>();
  
  const {
    register: registerNewPassword,
    handleSubmit: handleSubmitNewPassword,
    watch: watchNewPassword,
    formState: { errors: errorsNewPassword },
  } = useForm<NewPasswordFormData>();
  
  const newPassword = watchNewPassword('password');
  
  useEffect(() => {
    // Check if we're in password recovery mode (from email link)
    const checkPasswordRecovery = async () => {
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Error checking session:', error);
        return;
      }
      
      if (data?.session?.user?.email) {
        setIsPasswordRecovery(true);
      }
    };
    
    checkPasswordRecovery();
  }, []);
  
  const onSubmitReset = async (data: ResetPasswordFormData) => {
    try {
      setResetError(null);
      const origin = window.location.origin;
      await resetPassword(data.email, { redirectTo: origin });
      setIsSuccess(true);
    } catch (error: any) {
      setResetError("Une erreur est survenue lors de l'envoi de l'email");
    }
  };
  
  const onSubmitNewPassword = async (data: NewPasswordFormData) => {
    try {
      setResetError(null);
      
      const { error } = await supabase.auth.updateUser({
        password: data.password
      });
      
      if (error) throw error;
      
      setIsPasswordUpdated(true);
      setTimeout(() => {
        navigate('/login');
      }, 3000);
    } catch (error: any) {
      setResetError("Une erreur est survenue lors de la mise à jour du mot de passe");
    }
  };
  
  if (isPasswordUpdated) {
    return (
      <div className="animate-fade-in text-center">
        <div className="flex justify-center mb-6">
          <CheckCircle className="h-16 w-16 text-green-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Mot de passe mis à jour</h2>
        <p className="text-gray-600 mb-6">
          Votre mot de passe a été mis à jour avec succès. Vous allez être redirigé vers la page de connexion.
        </p>
        <Link
          to="/login"
          className="btn-primary inline-block"
        >
          Aller à la connexion
        </Link>
      </div>
    );
  }
  
  if (isPasswordRecovery) {
    return (
      <div className="animate-fade-in">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Définir un nouveau mot de passe</h2>
        <p className="text-gray-600 mb-6">
          Veuillez entrer votre nouveau mot de passe ci-dessous.
        </p>
        
        <form onSubmit={handleSubmitNewPassword(onSubmitNewPassword)} className="space-y-4">
          <div>
            <label htmlFor="password" className="form-label">
              Nouveau mot de passe
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                className={`form-input pr-10 ${errorsNewPassword.password ? 'border-red-500 focus:ring-red-500' : ''}`}
                {...registerNewPassword('password', {
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
            {errorsNewPassword.password && (
              <p className="form-error">{errorsNewPassword.password.message}</p>
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
                className={`form-input pr-10 ${errorsNewPassword.confirmPassword ? 'border-red-500 focus:ring-red-500' : ''}`}
                {...registerNewPassword('confirmPassword', {
                  required: 'Veuillez confirmer votre mot de passe',
                  validate: (value) => value === newPassword || 'Les mots de passe ne correspondent pas',
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
            {errorsNewPassword.confirmPassword && (
              <p className="form-error">{errorsNewPassword.confirmPassword.message}</p>
            )}
          </div>
          
          {resetError && (
            <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm">
              {resetError}
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
                Mise à jour en cours...
              </span>
            ) : (
              'Mettre à jour le mot de passe'
            )}
          </button>
        </form>
      </div>
    );
  }
  
  if (isSuccess) {
    return (
      <div className="animate-fade-in text-center">
        <div className="flex justify-center mb-6">
          <CheckCircle className="h-16 w-16 text-green-500" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Email envoyé</h2>
        <p className="text-gray-600 mb-6">
          Si un compte existe avec cette adresse email, vous recevrez un lien pour réinitialiser votre mot de passe.
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
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Réinitialiser le mot de passe</h2>
      <p className="text-gray-600 mb-6">
        Entrez votre adresse email et nous vous enverrons un lien pour réinitialiser votre mot de passe.
      </p>
      
      <form onSubmit={handleSubmitReset(onSubmitReset)} className="space-y-4">
        <div>
          <label htmlFor="email" className="form-label">
            Email
          </label>
          <input
            id="email"
            type="email"
            className={`form-input ${errorsReset.email ? 'border-red-500 focus:ring-red-500' : ''}`}
            {...registerReset('email', {
              required: 'Email requis',
              pattern: {
                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                message: 'Email invalide',
              },
            })}
          />
          {errorsReset.email && (
            <p className="form-error">{errorsReset.email.message}</p>
          )}
        </div>
        
        {resetError && (
          <div className="p-3 bg-red-50 text-red-600 rounded-md text-sm">
            {resetError}
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
              Envoi en cours...
            </span>
          ) : (
            'Envoyer le lien de réinitialisation'
          )}
        </button>
      </form>
      
      <div className="mt-6 text-center">
        <p className="text-gray-600">
          <Link to="/login" className="text-primary-600 hover:text-primary-800 font-medium">
            Retour à la connexion
          </Link>
        </p>
      </div>
    </div>
  );
};

export default ResetPasswordPage;