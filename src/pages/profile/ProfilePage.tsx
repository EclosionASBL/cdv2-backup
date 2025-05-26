import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useAuthStore, AccountType } from '../../stores/authStore';
import { Loader2, User, Upload, CheckCircle, Info } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { validateBelgianNRN } from '../../utils/validateBelgianNRN';
import BelgianNRNInput from '../../components/common/BelgianNRNInput';
import clsx from 'clsx';

interface ProfileFormData {
  prenom: string;
  nom: string;
  adresse: string;
  cpostal: string;
  localite: string;
  telephone: string;
  telephone2: string;
  nnational: string;
  newsletter: boolean;
  account_type: AccountType;
  organisation_name: string;
  company_number: string;
  is_legal_guardian: boolean;
}

const ProfilePage = () => {
  const navigate = useNavigate();
  const { user, profile, updateProfile, isLoading, fetchProfile } = useAuthStore();
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  
  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors },
  } = useForm<ProfileFormData>();

  const accountType = watch('account_type', profile?.account_type || 'parent');
  const isLegalGuardian = watch('is_legal_guardian', profile?.is_legal_guardian !== false);

  useEffect(() => {
    if (user && !profile) {
      fetchProfile();
    }
  }, [user, profile, fetchProfile]);

  useEffect(() => {
    if (profile) {
      const cleanNN = ['EMPTY', '000', 'NULL'].includes(profile.nnational || '') 
        ? '' 
        : profile.nnational || '';
        
      reset({
        prenom: profile.prenom || '',
        nom: profile.nom || '',
        adresse: profile.adresse || '',
        cpostal: profile.cpostal || '',
        localite: profile.localite || '',
        telephone: profile.telephone || '',
        telephone2: profile.telephone2 || '',
        nnational: cleanNN,
        newsletter: profile.newsletter || false,
        account_type: profile.account_type || 'parent',
        organisation_name: profile.organisation_name || '',
        company_number: profile.company_number || '',
        is_legal_guardian: profile.is_legal_guardian !== false,
      });
      setAvatarUrl(profile.avatar_url);
    }
  }, [profile, reset]);
  
  const onSubmit = async (data: ProfileFormData) => {
    try {
      // Validate based on account type
      if (data.account_type !== 'parent') {
        if (!data.organisation_name) {
          throw new Error('Le nom de l\'organisation est requis');
        }
        // Clear parent-specific fields
        data.nnational = '';
      }

      // Convert empty nnational to null
      const updatedData = {
        ...data,
        nnational: data.nnational === '' ? null : data.nnational
      };

      await updateProfile(updatedData);
      setUpdateSuccess(true);
      setTimeout(() => {
        navigate('/dashboard');
      }, 1500);
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };

  const uploadAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      
      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('You must select an image to upload.');
      }

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `avatars/${user?.id}-${Math.random()}.${fileExt}`;
      const filePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from('public')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage
        .from('public')
        .getPublicUrl(filePath);

      await updateProfile({ avatar_url: data.publicUrl });
      setAvatarUrl(data.publicUrl);
    } catch (error) {
      console.error('Error uploading avatar:', error);
    } finally {
      setUploading(false);
    }
  };
  
  if (!user || !profile) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }
  
  return (
    <div className="container max-w-3xl mx-auto py-12 px-4">
      <div className="flex items-center mb-8">
        <div className="relative group">
          <div className="h-20 w-20 bg-primary-100 rounded-full flex items-center justify-center overflow-hidden">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              <User className="h-10 w-10 text-primary-600" />
            )}
          </div>
          <label className="absolute bottom-0 right-0 bg-white rounded-full p-2 shadow-md cursor-pointer hover:bg-gray-50">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={uploadAvatar}
              disabled={uploading}
            />
            <Upload className="h-4 w-4 text-gray-600" />
          </label>
        </div>
        <div className="ml-6">
          <h1 className="text-3xl font-bold">Mon Profil</h1>
          <p className="text-gray-600">Gérez vos informations personnelles</p>
        </div>
      </div>
      
      <div className="bg-white rounded-xl shadow-md p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Account Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Type de compte
            </label>
            <div className="mt-2 space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="parent"
                  {...register('account_type')}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                />
                <span className="ml-2 text-gray-700">Parent</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="organisation"
                  {...register('account_type')}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                />
                <span className="ml-2 text-gray-700">Organisation</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="other"
                  {...register('account_type')}
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                />
                <span className="ml-2 text-gray-700">Autre</span>
              </label>
            </div>
          </div>

          {/* Organisation fields - only shown for organisation or other */}
          {(accountType === 'organisation' || accountType === 'other') && (
            <>
              <div>
                <label htmlFor="organisation_name" className="form-label">
                  Nom de l'organisation
                </label>
                <input
                  id="organisation_name"
                  type="text"
                  className={`form-input ${errors.organisation_name ? 'border-red-500' : ''}`}
                  {...register('organisation_name', { 
                    required: accountType !== 'parent' ? 'Ce champ est requis' : false 
                  })}
                />
                {errors.organisation_name && (
                  <p className="form-error">{errors.organisation_name.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="company_number" className="form-label">
                  Numéro d'entreprise (optionnel)
                </label>
                <input
                  id="company_number"
                  type="text"
                  className="form-input"
                  {...register('company_number')}
                />
              </div>
            </>
          )}

          {/* Personal info fields */}
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="prenom" className="form-label">
                {accountType === 'parent' ? 'Prénom' : 'Prénom du contact'}
              </label>
              <input
                id="prenom"
                type="text"
                className={`form-input ${errors.prenom ? 'border-red-500' : ''}`}
                {...register('prenom', { required: 'Ce champ est requis' })}
              />
              {errors.prenom && (
                <p className="form-error">{errors.prenom.message}</p>
              )}
            </div>
            
            <div>
              <label htmlFor="nom" className="form-label">
                {accountType === 'parent' ? 'Nom' : 'Nom du contact'}
              </label>
              <input
                id="nom"
                type="text"
                className={`form-input ${errors.nom ? 'border-red-500' : ''}`}
                {...register('nom', { required: 'Ce champ est requis' })}
              />
              {errors.nom && (
                <p className="form-error">{errors.nom.message}</p>
              )}
            </div>
          </div>
          
          <div>
            <label htmlFor="adresse" className="form-label">
              Adresse
            </label>
            <input
              id="adresse"
              type="text"
              className={`form-input ${errors.adresse ? 'border-red-500' : ''}`}
              {...register('adresse', { required: 'Ce champ est requis' })}
            />
            {errors.adresse && (
              <p className="form-error">{errors.adresse.message}</p>
            )}
          </div>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="cpostal" className="form-label">
                Code postal
              </label>
              <input
                id="cpostal"
                type="text"
                className={`form-input ${errors.cpostal ? 'border-red-500' : ''}`}
                {...register('cpostal', { required: 'Ce champ est requis' })}
              />
              {errors.cpostal && (
                <p className="form-error">{errors.cpostal.message}</p>
              )}
            </div>
            
            <div>
              <label htmlFor="localite" className="form-label">
                Localité
              </label>
              <input
                id="localite"
                type="text"
                className={`form-input ${errors.localite ? 'border-red-500' : ''}`}
                {...register('localite', { required: 'Ce champ est requis' })}
              />
              {errors.localite && (
                <p className="form-error">{errors.localite.message}</p>
              )}
            </div>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="telephone" className="form-label">
                Téléphone principal
              </label>
              <input
                id="telephone"
                type="tel"
                className={`form-input ${errors.telephone ? 'border-red-500' : ''}`}
                {...register('telephone', { required: 'Ce champ est requis' })}
              />
              {errors.telephone && (
                <p className="form-error">{errors.telephone.message}</p>
              )}
            </div>
            
            <div>
              <label htmlFor="telephone2" className="form-label">
                Téléphone secondaire
              </label>
              <input
                id="telephone2"
                type="tel"
                className={`form-input ${errors.telephone2 ? 'border-red-500' : ''}`}
                {...register('telephone2')}
              />
              {errors.telephone2 && (
                <p className="form-error">{errors.telephone2.message}</p>
              )}
            </div>
          </div>
          
          {/* National number - only shown for parents */}
          {accountType === 'parent' && (
            <div>
              <label htmlFor="nnational" className="form-label">
                Numéro national
              </label>
              <Controller
                control={control}
                name="nnational"
                rules={{
                  validate: value => {
                    if (!value) return true;
                    return validateBelgianNRN(value) || 'La clé de contrôle est invalide';
                  }
                }}
                render={({ field, fieldState }) => (
                  <BelgianNRNInput
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    error={fieldState.error?.message}
                  />
                )}
              />
            </div>
          )}

          {/* Legal guardian checkbox - only shown for parents */}
          {accountType === 'parent' && (
            <div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="is_legal_guardian"
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  {...register('is_legal_guardian')}
                />
                <label htmlFor="is_legal_guardian" className="ml-2 block text-sm text-gray-700">
                  Je suis le tuteur légal des enfants que j'inscris
                  <span className="ml-1 text-xs text-gray-500">(Requis pour l'attestation fiscale)</span>
                </label>
              </div>
              
              {/* Warning when parent but not legal guardian */}
              {accountType === 'parent' && !isLegalGuardian && (
                <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                  <div className="flex">
                    <Info className="h-5 w-5 text-yellow-500 mr-2 flex-shrink-0" />
                    <p className="text-sm text-yellow-700">
                      Vous ne recevrez PAS d'attestation fiscale pour les frais de garde. Si l'attestation doit être établie au nom du tuteur légal, veuillez fournir ses coordonnées ou demandez-lui de créer son propre compte.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex items-center">
            <input
              type="checkbox"
              id="newsletter"
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              {...register('newsletter')}
            />
            <label htmlFor="newsletter" className="ml-2 block text-sm text-gray-700">
              Je souhaite recevoir la newsletter
            </label>
          </div>
          
          {updateSuccess && (
            <div className="p-4 bg-green-50 text-green-600 rounded-md flex items-center">
              <CheckCircle className="h-5 w-5 mr-2" />
              Profil mis à jour avec succès ! Redirection...
            </div>
          )}
          
          <button
            type="submit"
            className="btn-primary w-full"
            disabled={isLoading || uploading}
          >
            {isLoading ? (
              <span className="flex items-center justify-center">
                <Loader2 className="animate-spin mr-2 h-4 w-4" />
                Mise à jour en cours...
              </span>
            ) : (
              'Mettre à jour le profil'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ProfilePage;