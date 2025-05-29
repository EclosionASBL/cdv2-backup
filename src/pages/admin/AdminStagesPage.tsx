import { useState, useEffect } from 'react';
import { useAdminStore } from '../../stores/adminStore';
import { Plus, Pencil, Trash2, AlertTriangle, Loader2, Upload } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { optimizeImageIfNeeded } from '../../utils/imageUtils';

interface Stage {
  id: string;
  title: string;
  description: string;
  age_min: number;
  age_max: number;
  base_price: number;
  image_url: string | null;
  active: boolean;
}

const AdminStagesPage = () => {
  const { stages, isLoading, error, fetchStages, createStage, updateStage, deleteStage } = useAdminStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStage, setEditingStage] = useState<any>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    age_min: '',
    age_max: '',
    base_price: ''
  });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});

  useEffect(() => {
    fetchStages();
  }, [fetchStages]);

  const validateAgeInput = (value: string): boolean => {
    const num = parseFloat(value);
    return !isNaN(num) && num >= 2 && num <= 18;
  };

  const handleOpenModal = (stage?: any) => {
    if (stage) {
      setEditingStage(stage);
      setFormData({
        title: stage.title,
        description: stage.description,
        age_min: stage.age_min.toString(),
        age_max: stage.age_max.toString(),
        base_price: stage.base_price.toString()
      });
      if (stage.image_url) {
        setImagePreview(stage.image_url);
      }
    } else {
      setEditingStage(null);
      setFormData({
        title: '',
        description: '',
        age_min: '',
        age_max: '',
        base_price: ''
      });
      setImageFile(null);
      setImagePreview(null);
    }
    setIsModalOpen(true);
    setFormErrors({});
  };

  const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('L\'image ne doit pas dépasser 5Mo');
      return;
    }

    if (!file.type.startsWith('image/')) {
      alert('Veuillez sélectionner une image');
      return;
    }

    try {
      // Optimiser l'image avant de la définir
      const optimizedFile = await optimizeImageIfNeeded(file, 800);
      setImageFile(optimizedFile);
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(optimizedFile);
    } catch (error) {
      console.error('Erreur lors de l\'optimisation de l\'image:', error);
      alert('Erreur lors du traitement de l\'image');
    }
  };

  const uploadImage = async (stageId: string): Promise<string | null> => {
    if (!imageFile) return null;

    try {
      setUploadingImage(true);
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${stageId}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('stages')
        .upload(fileName, imageFile, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('stages')
        .getPublicUrl(fileName);

      return data.publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form data
    const errors: {[key: string]: string} = {};
    
    if (!validateAgeInput(formData.age_min)) {
      errors.age_min = 'L\'âge minimum doit être entre 2 et 18 ans';
    }
    if (!validateAgeInput(formData.age_max)) {
      errors.age_max = 'L\'âge maximum doit être entre 2 et 18 ans';
    }
    if (parseFloat(formData.age_max) < parseFloat(formData.age_min)) {
      errors.age_max = 'L\'âge maximum doit être supérieur à l\'âge minimum';
    }
    
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      const stageData = {
        title: formData.title,
        description: formData.description,
        age_min: parseFloat(formData.age_min),
        age_max: parseFloat(formData.age_max),
        base_price: parseFloat(formData.base_price),
        active: true
      };

      if (editingStage) {
        if (imageFile) {
          const imageUrl = await uploadImage(editingStage.id);
          await updateStage(editingStage.id, {
            ...stageData,
            image_url: imageUrl || editingStage.image_url
          });
        } else {
          await updateStage(editingStage.id, stageData);
        }
      } else {
        const newStage = await createStage(stageData);
        if (imageFile && newStage?.id) {
          const imageUrl = await uploadImage(newStage.id);
          if (imageUrl) {
            await updateStage(newStage.id, { image_url: imageUrl });
          }
        }
      }

      setIsModalOpen(false);
      setImageFile(null);
      setImagePreview(null);
      setFormErrors({});
    } catch (error: any) {
      console.error('Error saving stage:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteStage(id);
      setDeleteId(null);
    } catch (error) {
      console.error('Error deleting stage:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestion des stages</h1>
          <p className="text-gray-600 mt-1">Gérez le catalogue des stages disponibles</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="btn-primary flex items-center"
        >
          <Plus className="h-5 w-5 mr-2" />
          Nouveau stage
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg flex items-start">
          <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Image
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Titre
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Description
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Âge
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Prix de base
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {stages.map((stage) => (
                <tr key={stage.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="h-10 w-10 rounded-lg bg-gray-100 overflow-hidden">
                      {stage.image_url ? (
                        <img
                          src={stage.image_url}
                          alt={stage.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          <Upload className="h-5 w-5 text-gray-400" />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {stage.title}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-md truncate overflow-hidden">
                    {stage.description}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {stage.age_min} - {stage.age_max} ans
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {stage.base_price} €
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleOpenModal(stage)}
                      className="text-primary-600 hover:text-primary-900 mr-4"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeleteId(stage.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stage Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
            <h2 className="text-xl font-semibold mb-4">
              {editingStage ? 'Modifier le stage' : 'Nouveau stage'}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Image
                </label>
                <div className="flex items-center space-x-4">
                  <div className="h-24 w-24 rounded-lg bg-gray-100 overflow-hidden">
                    {imagePreview ? (
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <Upload className="h-8 w-8 text-gray-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="btn-outline inline-flex items-center cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                      />
                      <Upload className="h-4 w-4 mr-2" />
                      Choisir une image
                    </label>
                    <p className="text-xs text-gray-500 mt-1">
                      Format accepté : JPG, PNG. Taille maximum : 5 Mo
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Titre
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="mt-1 form-input"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="mt-1 form-input"
                  rows={3}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Âge minimum
                  </label>
                  <input
                    type="number"
                    value={formData.age_min}
                    onChange={(e) => setFormData({ ...formData, age_min: e.target.value })}
                    className={`mt-1 form-input ${formErrors.age_min ? 'border-red-500' : ''}`}
                    step="0.5"
                    min="2"
                    max="18"
                    required
                  />
                  {formErrors.age_min && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.age_min}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Âge maximum
                  </label>
                  <input
                    type="number"
                    value={formData.age_max}
                    onChange={(e) => setFormData({ ...formData, age_max: e.target.value })}
                    className={`mt-1 form-input ${formErrors.age_max ? 'border-red-500' : ''}`}
                    step="0.5"
                    min="2"
                    max="18"
                    required
                  />
                  {formErrors.age_max && (
                    <p className="mt-1 text-sm text-red-600">{formErrors.age_max}</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Prix de base
                </label>
                <input
                  type="number"
                  value={formData.base_price}
                  onChange={(e) => setFormData({ ...formData, base_price: e.target.value })}
                  className="mt-1 form-input"
                  min="0"
                  step="0.01"
                  required
                />
              </div>

              <div className="flex justify-end space-x-3 mt-6 pt-6 border-t">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-outline"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={isLoading || uploadingImage}
                >
                  {(isLoading || uploadingImage) ? (
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
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center mb-4">
              <div className="bg-red-100 rounded-full p-2 mr-3">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">
                Confirmer la suppression
              </h3>
            </div>
            
            <p className="text-gray-600 mb-6">
              Êtes-vous sûr de vouloir supprimer ce stage ? Cette action est irréversible.
            </p>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeleteId(null)}
                className="btn-outline"
              >
                Annuler
              </button>
              <button
                onClick={() => handleDelete(deleteId)}
                className="btn-primary bg-red-600 hover:bg-red-700"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminStagesPage;