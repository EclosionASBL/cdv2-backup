import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';

interface InclusionFormData {
  has_needs: boolean;
  situation_details?: string;
  impact_details?: string;
  needs_dedicated_staff?: 'yes' | 'no' | 'sometimes';
  staff_details?: string;
  strategies?: string;
  assistive_devices?: string;
  stress_signals?: string;
  strengths?: string;
  previous_experience?: string;
}

interface InclusionFormProps {
  onComplete: (data: InclusionFormData) => void;
  initialData?: InclusionFormData;
}

const InclusionForm = ({ onComplete, initialData }: InclusionFormProps) => {
  const navigate = useNavigate();
  const [showDetails, setShowDetails] = useState(initialData?.has_needs || false);
  
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<InclusionFormData>({
    defaultValues: initialData || {
      has_needs: false,
    },
  });

  const needsDedicatedStaff = watch('needs_dedicated_staff');
  const hasNeeds = watch('has_needs');

  useEffect(() => {
    if (!hasNeeds) {
      // Clear all detail fields when toggling off
      setValue('situation_details', '');
      setValue('impact_details', '');
      setValue('needs_dedicated_staff', undefined);
      setValue('staff_details', '');
      setValue('strategies', '');
      setValue('assistive_devices', '');
      setValue('stress_signals', '');
      setValue('strengths', '');
      setValue('previous_experience', '');
    }
    setShowDetails(hasNeeds);
  }, [hasNeeds, setValue]);

  const onSubmit = (data: InclusionFormData) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    onComplete(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Inclusion et besoins spécifiques</h2>
        
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="has_needs"
              {...register('has_needs')}
              className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <label htmlFor="has_needs" className="text-sm font-medium text-gray-700">
              Mon enfant est porteur d'un handicap ou a des besoins spécifiques
            </label>
          </div>

          <div className={`space-y-6 transition-all duration-300 ${showDetails ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0 overflow-hidden'}`}>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Quelle(s) situation(s) de handicap, trouble(s) ou besoin(s) spécifique(s) concernent votre enfant ?
              </label>
              <textarea
                {...register('situation_details', { 
                  required: hasNeeds ? 'Ce champ est requis' : false 
                })}
                className={`mt-1 block w-full rounded-md shadow-sm ${
                  errors.situation_details ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-primary-500 focus:ring-primary-500'
                }`}
                rows={3}
              />
              {errors.situation_details && (
                <p className="mt-1 text-sm text-red-600">{errors.situation_details.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Quelles répercussions concrètes cela a-t-il dans sa vie quotidienne ?
              </label>
              <p className="text-sm text-gray-500 mb-2">
                (mobilité, communication, autonomie, fatigue, gestion sensorielle…)
              </p>
              <textarea
                {...register('impact_details', { 
                  required: hasNeeds ? 'Ce champ est requis' : false 
                })}
                className={`mt-1 block w-full rounded-md shadow-sm ${
                  errors.impact_details ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-primary-500 focus:ring-primary-500'
                }`}
                rows={3}
              />
              {errors.impact_details && (
                <p className="mt-1 text-sm text-red-600">{errors.impact_details.message}</p>
              )}
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-medium text-gray-700">
                Votre enfant a-t-il besoin d'un·e accompagnateur·rice dédié·e pendant l'activité ?
              </label>
              <div className="space-y-2">
                {['yes', 'no', 'sometimes'].map((value) => (
                  <div key={value} className="flex items-center">
                    <input
                      type="radio"
                      id={`needs_dedicated_staff_${value}`}
                      value={value}
                      {...register('needs_dedicated_staff', {
                        required: hasNeeds ? 'Ce champ est requis' : false
                      })}
                      className="h-4 w-4 border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <label htmlFor={`needs_dedicated_staff_${value}`} className="ml-3 block text-sm font-medium text-gray-700">
                      {value === 'yes' ? 'Oui' : value === 'no' ? 'Non' : 'Par moments'}
                    </label>
                  </div>
                ))}
              </div>
              {errors.needs_dedicated_staff && (
                <p className="mt-1 text-sm text-red-600">{errors.needs_dedicated_staff.message}</p>
              )}
            </div>

            {(needsDedicatedStaff === 'yes' || needsDedicatedStaff === 'sometimes') && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Précisez
                </label>
                <input
                  type="text"
                  {...register('staff_details', {
                    required: hasNeeds ? 'Ce champ est requis' : false
                  })}
                  className={`mt-1 block w-full rounded-md shadow-sm ${
                    errors.staff_details ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:border-primary-500 focus:ring-primary-500'
                  }`}
                />
                {errors.staff_details && (
                  <p className="mt-1 text-sm text-red-600">{errors.staff_details.message}</p>
                )}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Quelles stratégies, aménagements ou bonnes pratiques facilitent son bien-être et sa participation ?
              </label>
              <textarea
                {...register('strategies')}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Aides techniques ou matériel utilisé habituellement (fauteuil, casque anti-bruit, pictogrammes, tablette de CAA…) ?
              </label>
              <textarea
                {...register('assistive_devices')}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Signes d'inconfort ou de stress à surveiller et manière d'y répondre efficacement ?
              </label>
              <textarea
                {...register('stress_signals')}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Centres d'intérêt, forces ou passions de votre enfant que nous pourrions valoriser ?
              </label>
              <textarea
                {...register('strengths')}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                rows={3}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Votre enfant a-t-il déjà participé à des activités similaires ? Quels éléments ont bien fonctionné ?
              </label>
              <textarea
                {...register('previous_experience')}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
                rows={3}
              />
            </div>
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
          Terminer
        </button>
      </div>
    </form>
  );
};

export default InclusionForm;