import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { useSchoolStore } from '../../../stores/schoolStore';
import { Loader2, Upload } from 'lucide-react';
import { validateBelgianNRN } from '../../../utils/validateBelgianNRN';
import BelgianNRNInput from '../../common/BelgianNRNInput';

interface PersonalInfoFormData {
  nom: string;
  prenom: string;
  dateNaissance: string;
  nNational: string | null;
  adresse: string;
  cPostal: string;
  localite: string;
  ecole: string;
  photoFile?: File;
  photoConsent: boolean;
}

interface PersonalInfoFormProps {
  onComplete: (data: PersonalInfoFormData) => void;
  initialData?: PersonalInfoFormData;
}

const PersonalInfoForm = ({ onComplete, initialData }: PersonalInfoFormProps) => {
  const navigate = useNavigate();
  const { schools, isLoading: isLoadingSchools, fetchSchools } = useSchoolStore();
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [customSchoolName, setCustomSchoolName] = useState('');
  
  const {
    register,
    handleSubmit,
    control,
    formState: { errors }
  } = useForm<PersonalInfoFormData>({
    defaultValues: {
      ...initialData,
      photoConsent: initialData?.photoConsent || false
    }
  });

  useEffect(() => {
    fetchSchools();
  }, [fetchSchools]);

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setPhotoFile(null);
      setPhotoPreview(null);
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert('La taille du fichier ne doit pas dépasser 5 Mo');
      return;
    }

    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      alert('Seuls les formats JPG et PNG sont acceptés');
      return;
    }

    setPhotoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const onSubmit = async (data: PersonalInfoFormData) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    onComplete({ ...data, photoFile: photoFile || undefined });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="nom" className="form-label">
            Nom de l'enfant
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

        <div>
          <label htmlFor="prenom" className="form-label">
            Prénom de l'enfant
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
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="dateNaissance" className="form-label">
            Date de naissance
          </label>
          <input
            id="dateNaissance"
            type="date"
            className={`form-input ${errors.dateNaissance ? 'border-red-500' : ''}`}
            {...register('dateNaissance', { required: 'Ce champ est requis' })}
          />
          {errors.dateNaissance && (
            <p className="form-error">{errors.dateNaissance.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="nNational" className="form-label">
            Numéro de registre national
          </label>
          <Controller
            control={control}
            name="nNational"
            rules={{
              validate: value => {
                if (!value) return true; // Allow null/empty values
                return validateBelgianNRN(value) || 'La clé de contrôle est invalide';
              }
            }}
            render={({ field: { onChange, value }, fieldState }) => (
              <BelgianNRNInput
                value={value || ''}
                onChange={(newValue) => {
                  // Convert empty string to null
                  onChange(newValue.trim() === '' ? null : newValue);
                }}
                error={fieldState.error?.message}
              />
            )}
          />
          <p className="mt-1 text-sm text-gray-500">
            Vous pourrez renseigner ce numéro plus tard si besoin&nbsp;– mais sans lui nous ne pourrons pas éditer les attestations fiscales.
          </p>
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
          <label htmlFor="cPostal" className="form-label">
            Code postal
          </label>
          <input
            id="cPostal"
            type="text"
            className={`form-input ${errors.cPostal ? 'border-red-500' : ''}`}
            {...register('cPostal', { required: 'Ce champ est requis' })}
          />
          {errors.cPostal && (
            <p className="form-error">{errors.cPostal.message}</p>
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

      <div>
        <label htmlFor="ecole" className="form-label">
          École
        </label>
        <select
          id="ecole"
          className={`form-input ${errors.ecole ? 'border-red-500' : ''}`}
          {...register('ecole', { required: 'Ce champ est requis' })}
        >
          <option value="">Sélectionner une école</option>
          {isLoadingSchools ? (
            <option disabled>Chargement des écoles...</option>
          ) : (
            <>
              {schools.map(school => (
                <option key={school.id} value={school.id}>
                  {school.name} ({school.code_postal})
                </option>
              ))}
              <option value="other">Autre / École non listée</option>
            </>
          )}
        </select>
        {errors.ecole && (
          <p className="form-error">{errors.ecole.message}</p>
        )}
      </div>

      <div>
        <label className="form-label">Photo de l'enfant</label>
        <div className="mt-1 flex items-center space-x-4">
          <div className="relative">
            <div className="h-24 w-24 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden">
              {photoPreview ? (
                <img 
                  src={photoPreview}
                  alt="Aperçu"
                  className="h-full w-full object-cover"
                />
              ) : (
                <Upload className="h-8 w-8 text-gray-400" />
              )}
            </div>
            <label className="absolute bottom-0 right-0 bg-white rounded-full p-2 shadow-md cursor-pointer hover:bg-gray-50">
              <input
                type="file"
                accept="image/jpeg,image/png"
                onChange={handlePhotoChange}
                className="hidden"
              />
              <Upload className="h-4 w-4 text-gray-600" />
            </label>
          </div>
          <div className="flex-1">
            <p className="text-xs text-gray-500">
              Format accepté : JPG, PNG. Taille maximum : 5 Mo
            </p>
          </div>
        </div>
      </div>

      <div>
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            className="form-checkbox"
            {...register('photoConsent')}
          />
          <span className="text-sm text-gray-700">
            J'autorise l'association à photographier/filmer mon enfant et à utiliser ces images dans ses supports de communication (site, réseaux sociaux, rapport annuel) – non nominatif.
          </span>
        </label>
      </div>

      <div className="flex justify-between mt-6">
        <button
          type="button"
          onClick={() => navigate('/kids')}
          className="btn-outline"
        >
          Annuler
        </button>
        <button 
          type="submit" 
          className="btn-primary"
        >
          Suivant
        </button>
      </div>
    </form>
  );
};

export default PersonalInfoForm;