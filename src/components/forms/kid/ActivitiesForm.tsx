import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface ActivitiesFormData {
  canParticipate: boolean;
  restrictionDetails: string;
  swimLevel: 'pas du tout' | 'difficilement' | 'bien' | 'très bien';
  waterFear: boolean;
  otherInfo: string;
}

interface ActivitiesFormProps {
  onComplete: (data: ActivitiesFormData) => void;
  initialData?: ActivitiesFormData;
}

const ActivitiesForm = ({ onComplete, initialData }: ActivitiesFormProps) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState<ActivitiesFormData>({
    canParticipate: initialData?.canParticipate ?? true,
    restrictionDetails: initialData?.restrictionDetails ?? '',
    swimLevel: initialData?.swimLevel ?? 'pas du tout',
    waterFear: initialData?.waterFear ?? false,
    otherInfo: initialData?.otherInfo ?? '',
  });

  const [errors, setErrors] = useState<Partial<Record<keyof ActivitiesFormData, string>>>({});

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData]);

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof ActivitiesFormData, string>> = {};

    if (!formData.canParticipate && !formData.restrictionDetails) {
      newErrors.restrictionDetails = 'Veuillez préciser les restrictions';
    }

    if (!formData.swimLevel) {
      newErrors.swimLevel = 'Veuillez sélectionner un niveau de natation';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validateForm()) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      onComplete(formData);
    }
  };

  const showWaterFear = ['pas du tout', 'difficilement'].includes(formData.swimLevel);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Activités et natation</h2>
        
        <div className="space-y-4">
          <div>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={formData.canParticipate}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  canParticipate: e.target.checked
                }))}
                className="form-checkbox"
              />
              <span>L'enfant peut participer à toutes les activités proposées</span>
            </label>
          </div>

          {!formData.canParticipate && (
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Précisez les restrictions
              </label>
              <textarea
                value={formData.restrictionDetails}
                onChange={(e) => setFormData(prev => ({
                  ...prev,
                  restrictionDetails: e.target.value
                }))}
                className={`mt-1 form-textarea ${errors.restrictionDetails ? 'border-red-500' : ''}`}
                rows={4}
              />
              {errors.restrictionDetails && (
                <p className="mt-1 text-sm text-red-600">{errors.restrictionDetails}</p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Niveau de natation
            </label>
            <select
              value={formData.swimLevel}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                swimLevel: e.target.value as typeof formData.swimLevel
              }))}
              className={`mt-1 form-select ${errors.swimLevel ? 'border-red-500' : ''}`}
              required
            >
              <option value="pas du tout">Pas du tout</option>
              <option value="difficilement">Difficilement</option>
              <option value="bien">Bien</option>
              <option value="très bien">Très bien</option>
            </select>
            {errors.swimLevel && (
              <p className="mt-1 text-sm text-red-600">{errors.swimLevel}</p>
            )}
          </div>

          {showWaterFear && (
            <div className="space-y-2">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={formData.waterFear}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    waterFear: e.target.checked
                  }))}
                  className="form-checkbox"
                />
                <span>L'enfant a peur de l'eau</span>
              </label>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Autres informations importantes
            </label>
            <textarea
              value={formData.otherInfo}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                otherInfo: e.target.value
              }))}
              className="mt-1 form-textarea"
              rows={3}
              placeholder="Port de lunettes, appareil dentaire, orthèse..."
            />
          </div>
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
        <button type="submit" className="btn-primary">
          Suivant
        </button>
      </div>
    </form>
  );
};

export default ActivitiesForm;