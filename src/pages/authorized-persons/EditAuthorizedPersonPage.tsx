import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuthorizedPersonsStore } from '../../stores/authorizedPersonsStore';
import { useAuthStore } from '../../stores/authStore';
import { useForm } from 'react-hook-form';
import { Loader2, Upload, ArrowLeft } from 'lucide-react';

interface FormData {
  first_name: string;
  last_name: string;
  phone_number: string;
  relationship: string;
}

const EditAuthorizedPersonPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { updatePerson, uploadPhoto, isLoading, persons } = useAuthorizedPersonsStore();
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<FormData>();

  useEffect(() => {
    // Find the person to edit
    const person = persons.find(p => p.id === id);
    if (!person) {
      navigate('/authorized-persons');
      return;
    }

    // Set form data
    reset({
      first_name: person.first_name,
      last_name: person.last_name,
      phone_number: person.phone_number,
      relationship: person.relationship
    });

    // Set photo preview if exists
    if (person.photo_url) {
      setPhotoPreview(person.photo_url);
    }
  }, [id, persons, reset, navigate]);

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setPhotoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const onSubmit = async (data: FormData) => {
    if (!user || !id) return;

    try {
      const updates = {
        ...data,
        user_id: user.id
      };

      await updatePerson(id, updates);

      if (photoFile) {
        setUploadingPhoto(true);
        await uploadPhoto(id, photoFile);
      }

      navigate('/authorized-persons');
    } catch (error) {
      console.error('Error updating authorized person:', error);
    }
  };

  return (
    <div className="container max-w-2xl mx-auto px-4 py-8">
      <button 
        onClick={() => navigate('/authorized-persons')}
        className="mb-6 flex items-center text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-5 w-5 mr-2" />
        Retour
      </button>

      <h1 className="text-3xl font-bold mb-8">Modifier une personne autorisée</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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

        <div className="grid md:grid-cols-2 gap-6">
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

        <div className="flex justify-between pt-6">
          <button
            type="button"
            onClick={() => navigate('/authorized-persons')}
            className="btn-outline"
          >
            Annuler
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={isLoading || uploadingPhoto}
          >
            {(isLoading || uploadingPhoto) ? (
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
    </div>
  );
};

export default EditAuthorizedPersonPage;