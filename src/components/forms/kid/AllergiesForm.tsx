import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface AllergiesFormData {
  hasAllergies: boolean;
  allergiesDetails: string;
  allergiesConsequences: string;
  specialDiet: boolean;
  dietDetails: string;
}

interface AllergiesFormProps {
  onComplete: (data: AllergiesFormData) => void;
  initialData?: AllergiesFormData;
}

const AllergiesForm = ({ onComplete, initialData }: AllergiesFormProps) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<AllergiesFormData>({
    hasAllergies: initialData?.hasAllergies || false,
    allergiesDetails: initialData?.allergiesDetails || '',
    allergiesConsequences: initialData?.allergiesConsequences || '',
    specialDiet: initialData?.specialDiet || false,
    dietDetails: initialData?.dietDetails || '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof AllergiesFormData, string>>>({});

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof AllergiesFormData, string>> = {};

    if (formData.hasAllergies && !formData.allergiesDetails.trim()) {
      newErrors.allergiesDetails = 'Veuillez décrire les allergies';
    }

    if (formData.hasAllergies && !formData.allergiesConsequences.trim()) {
      newErrors.allergiesConsequences = 'Veuillez décrire les conséquences des allergies';
    }

    if (formData.specialDiet && !formData.dietDetails.trim()) {
      newErrors.dietDetails = 'Veuillez décrire le régime alimentaire spécial';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      onComplete(formData);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Allergies et régime alimentaire</h2>
        
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="hasAllergies"
              checked={formData.hasAllergies}
              onChange={(e) => setFormData(prev => ({ ...prev, hasAllergies: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <label htmlFor="hasAllergies" className="font-medium text-gray-700">
              Mon enfant a des allergies
            </label>
          </div>

          {formData.hasAllergies && (
            <>
              <div>
                <label htmlFor="allergiesDetails" className="block text-sm font-medium text-gray-700">
                  Description des allergies
                </label>
                <textarea
                  id="allergiesDetails"
                  value={formData.allergiesDetails}
                  onChange={(e) => setFormData(prev => ({ ...prev, allergiesDetails: e.target.value }))}
                  className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 ${errors.allergiesDetails ? 'border-red-300' : ''}`}
                  rows={3}
                />
                {errors.allergiesDetails && (
                  <p className="mt-1 text-sm text-red-600">{errors.allergiesDetails}</p>
                )}
              </div>

              <div>
                <label htmlFor="allergiesConsequences" className="block text-sm font-medium text-gray-700">
                  Conséquences des allergies
                </label>
                <textarea
                  id="allergiesConsequences"
                  value={formData.allergiesConsequences}
                  onChange={(e) => setFormData(prev => ({ ...prev, allergiesConsequences: e.target.value }))}
                  className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 ${errors.allergiesConsequences ? 'border-red-300' : ''}`}
                  rows={3}
                />
                {errors.allergiesConsequences && (
                  <p className="mt-1 text-sm text-red-600">{errors.allergiesConsequences}</p>
                )}
              </div>
            </>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="specialDiet"
              checked={formData.specialDiet}
              onChange={(e) => setFormData(prev => ({ ...prev, specialDiet: e.target.checked }))}
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <label htmlFor="specialDiet" className="font-medium text-gray-700">
              Mon enfant a un régime alimentaire spécial
            </label>
          </div>

          {formData.specialDiet && (
            <div>
              <label htmlFor="dietDetails" className="block text-sm font-medium text-gray-700">
                Description du régime alimentaire
              </label>
              <textarea
                id="dietDetails"
                value={formData.dietDetails}
                onChange={(e) => setFormData(prev => ({ ...prev, dietDetails: e.target.value }))}
                className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 ${errors.dietDetails ? 'border-red-300' : ''}`}
                rows={3}
              />
              {errors.dietDetails && (
                <p className="mt-1 text-sm text-red-600">{errors.dietDetails}</p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between mt-6 pt-6 border-t">
        <button
          type="button"
          onClick={() => navigate('/kids')}
          className="btn-outline"
        >
          Annuler
        </button>
        <div className="flex space-x-4">
          <button type="submit" className="btn-primary">
            Suivant
          </button>
        </div>
      </div>
    </form>
  );
};

export default AllergiesForm;