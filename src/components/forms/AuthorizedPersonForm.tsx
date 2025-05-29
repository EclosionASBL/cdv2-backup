import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAuthStore } from '../../stores/authStore';
import { useAuthorizedPersonsStore } from '../../stores/authorizedPersonsStore';
import { Loader2, Upload } from 'lucide-react';
import { optimizeImageIfNeeded } from '../../utils/imageUtils';

interface AuthorizedPersonFormData {
  first_name: string;
  last_name: string;
  phone_number: string;
  relationship: string;
}

interface AuthorizedPersonFormProps {
  initialData?: {
    id: string;
    first_name: string;
    last_name: string;
    phone_number: string;
    relationship: string;
    photo_url?: string | null;
  };
  onComplete: () => void;
}

const AuthorizedPersonForm = ({ initialData, onComplete }: AuthorizedPersonFormProps) => {
  const { user } = useAuthStore();
  const { addPerson, updatePerson, uploadPhoto } = useAuthorizedPersonsStore();
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(initialData?.photo_url || null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<AuthorizedPersonFormData>({
    defaultValues: initialData
  });

  const handlePhotoChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      // Optimiser l'image avant de la définir
      const optimizedFile = await optimizeImageIfNeeded(file);
      setPhotoFile(optimizedFile);
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(optimizedFile);
    } catch (error) {
      console.error('Erreur lors de l\'optimisation de l\'image:', error);
      alert('Erreur lors du traitement de l\'image');
    }
  };

  const onSubmit = async (data: AuthorizedPersonFormData) => {
    if (!user) return;
    
    try {
      setIsSubmitting(true);

      if (initialData?.id) {
        // Update existing person
        await updatePerson(initialData.id, {
          ...data,
          user_id: user.id
        });

        if (photoFile) {
          await uploadPhoto(initialData.id, photoFile);
        }
      } else {
        // Create new person
        const person = await addPerson({
          ...data,
          user_id: user.id,
          photo_url: null
        });

        if (photoFile && person.id) {
          await uploadPhoto(person.id, photoFile);
        }
      }

      onComplete();
    } catch (error) {
      console.error('Error saving authorized person:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="flex justify-center mb-6">
        <div className="relative">
          <div className="h-32 w-32 rounded-full overflow-hidden bg-gray-100">
            {photoPreview ? (
              <img 
                src={photoPreview}
                alt="Preview"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center bg-gray-100">
                <Upload className="h-8 w-8 text-gray-400" />
              </div>
            )}
          </div>
          <label className="absolute bottom-0 right-0 bg-white rounded-full p-2 shadow-md cursor-pointer hover:bg-gray-50">
            <input
              type="file"
              accept="image/*"
              onChange={handlePhotoChange}
              className="hidden"
            />
            <Upload className="h-4 w-4 text-gray-600" />
          </label>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="form-label">Prénom</label>
          <input
            type="text"
            className={`form-input ${errors.first_name ? 'border-red-500' : ''}`}
            {...register('first_name', { required: 'Ce champ est requis' })}
          />
          {errors.first_name && (
            <p className="form-error">{errors.first_name.message}</p>
          )}
        </div>

        <div>
          <label className="form-label">Nom</label>
          <input
            type="text"
            className={`form-input ${errors.last_name ? 'border-red-500' : ''}`}
            {...register('last_name', { required: 'Ce champ est requis' })}
          />
          {errors.last_name && (
            <p className="form-error">{errors.last_name.message}</p>
          )}
        </div>
      </div>

      <div>
        <label className="form-label">Numéro de téléphone</label>
        <input
          type="tel"
          className={`form-input ${errors.phone_number ? 'border-red-500' : ''}`}
          {...register('phone_number', { required: 'Ce champ est requis' })}
        />
        {errors.phone_number && (
          <p className="form-error">{errors.phone_number.message}</p>
        )}
      </div>

      <div>
        <label className="form-label">Lien avec l'enfant</label>
        <input
          type="text"
          className={`form-input ${errors.relationship ? 'border-red-500' : ''}`}
          placeholder="Ex: grand-parent, oncle, voisin..."
          {...register('relationship', { required: 'Ce champ est requis' })}
        />
        {errors.relationship && (
          <p className="form-error">{errors.relationship.message}</p>
        )}
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <button
          type="submit"
          className="btn-primary"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <span className="flex items-center">
              <Loader2 className="animate-spin mr-2 h-4 w-4" />
              Enregistrement...
            </span>
          ) : (
            'Enregistrer'
          )}
        </button>
      </div>
    </form>
  );
};

export default AuthorizedPersonForm;