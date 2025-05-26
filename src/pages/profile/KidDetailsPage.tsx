import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useKidStore } from '../../stores/kidStore';
import { useAuthorizedPersonsStore } from '../../stores/authorizedPersonsStore';
import { useSchoolStore } from '../../stores/schoolStore';
import LoadingScreen from '../../components/common/LoadingScreen';
import { 
  ArrowLeft, User, Phone, Heart, AlertTriangle, 
  CookingPot as SwimmingPool, DoorOpen, Sparkles,
  ChevronDown, ChevronUp, Plus, Upload, Loader2
} from 'lucide-react';
import { validateBelgianNRN } from '../../utils/validateBelgianNRN';
import { getAgeFromDate } from '../../utils/date';
import clsx from 'clsx';
import { toast, Toaster } from 'react-hot-toast';

const ImageWithFallback = ({ src, alt, className }: { src: string | null, alt: string, className?: string }) => {
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;

  const handleError = () => {
    if (retryCount < maxRetries) {
      const timeout = Math.pow(2, retryCount) * 1000;
      setTimeout(() => {
        setRetryCount(prev => prev + 1);
        setError(false);
      }, timeout);
    } else {
      setError(true);
    }
  };

  if (error || !src) {
    return (
      <div className={clsx("bg-gray-100 flex items-center justify-center", className)}>
        <User className="h-12 w-12 text-gray-400" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      onError={handleError}
      key={retryCount}
    />
  );
};

interface SectionProps {
  title: string;
  icon: React.ReactNode;
  isExpanded: boolean;
  onToggle: () => void;
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  summary?: React.ReactNode;
  children: React.ReactNode;
}

const Section = ({
  title,
  icon,
  isExpanded,
  onToggle,
  isEditing,
  onEdit,
  onSave,
  onCancel,
  summary,
  children
}: SectionProps) => (
  <div className="bg-white shadow rounded-lg overflow-hidden mb-6">
    <button
      onClick={onToggle}
      className="w-full px-6 py-4 flex items-center justify-between bg-white hover:bg-gray-50"
    >
      <div className="flex items-center">
        <div className="p-2 bg-primary-50 rounded-lg mr-3">{icon}</div>
        <div className="text-left">
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          {!isExpanded && summary && (
            <p className="text-sm text-gray-600 mt-1">{summary}</p>
          )}
        </div>
      </div>
      {isExpanded ? (
        <ChevronUp className="h-5 w-5" />
      ) : (
        <ChevronDown className="h-5 w-5" />
      )}
    </button>

    {isExpanded && (
      <div className="px-6 py-4 border-t">
        <div className="flex justify-end mb-4">
          {!isEditing ? (
            <button
              onClick={onEdit}
              className="text-primary-600 hover:text-primary-700 font-medium text-sm"
            >
              Modifier
            </button>
          ) : (
            <div className="flex space-x-3">
              <button
                onClick={onCancel}
                className="text-gray-600 hover:text-gray-700 font-medium text-sm"
              >
                Annuler
              </button>
              <button
                onClick={onSave}
                className="text-primary-600 hover:text-primary-700 font-medium text-sm"
              >
                Enregistrer
              </button>
            </div>
          )}
        </div>
        {children}
      </div>
    )}
  </div>
);

interface FieldProps {
  label: string;
  value: any;
  isEditing?: boolean;
  onChange?: (value: any) => void;
  type?: 'text' | 'tel' | 'email' | 'date' | 'select' | 'textarea' | 'boolean';
  options?: { value: string; label: string }[];
  error?: string;
}

const Field = ({
  label,
  value,
  isEditing,
  onChange,
  type = 'text',
  options = [],
  error
}: FieldProps) => (
  <div className="mb-4">
    <dt className="text-sm font-medium text-gray-500">{label}</dt>
    <dd className="mt-1">
      {isEditing ? (
        <div>
          {type === 'textarea' ? (
            <textarea
              value={value || ''}
              onChange={e => onChange?.(e.target.value)}
              className="form-textarea w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
              rows={4}
            />
          ) : type === 'select' ? (
            <select
              value={value || ''}
              onChange={e => onChange?.(e.target.value)}
              className="form-select w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            >
              {options.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          ) : type === 'boolean' ? (
            <div className="flex items-center space-x-4">
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  checked={value === true}
                  onChange={() => onChange?.(true)}
                  className="form-radio text-primary-600"
                />
                <span className="ml-2">Oui</span>
              </label>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  checked={value === false}
                  onChange={() => onChange?.(false)}
                  className="form-radio text-primary-600"
                />
                <span className="ml-2">Non</span>
              </label>
            </div>
          ) : (
            <input
              type={type}
              value={value || ''}
              onChange={e => onChange?.(e.target.value)}
              className="form-input w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500"
            />
          )}
          {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        </div>
      ) : (
        <div className="text-sm text-gray-900">
          {type === 'boolean' ? (value ? 'Oui' : 'Non') : value || 'Non renseigné'}
        </div>
      )}
    </dd>
  </div>
);

const KidDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const {
    kids,
    fetchKid,
    getPhotoUrl,
    updateKid,
    uploadPhoto,
    refreshPhotoUrl,
    isUploadingPhoto
  } = useKidStore();
  const { persons, fetchPersons } = useAuthorizedPersonsStore();
  const { schools, fetchSchools } = useSchoolStore();

  // state pour forcer le cache busting de l'URL
  const [photoTimestamp, setPhotoTimestamp] = useState(Date.now());

  const kid = kids.find(k => k.id === id);
  const basePhotoUrl = kid ? getPhotoUrl(kid.id) : null;
  const photoUrl = useMemo(() => {
    if (!basePhotoUrl) return null;
    const sep = basePhotoUrl.includes('?') ? '&' : '?';
    return `${basePhotoUrl}${sep}t=${photoTimestamp}`;
  }, [basePhotoUrl, photoTimestamp]);

  // refs et états d'édition
  const nrnInputRef = useRef<HTMLInputElement | null>(null);
  const [customSchoolName, setCustomSchoolName] = useState('');
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [editingSections, setEditingSections] = useState<Record<string, boolean>>({});
  const [editedData, setEditedData] = useState<Record<string, any>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, any>>({});

  useEffect(() => {
    if (id) {
      fetchKid(id);
      fetchPersons();
      fetchSchools();
    }
  }, [id, fetchKid, fetchPersons, fetchSchools]);

  useEffect(() => {
    if (kid) {
      setEditedData({
        personal: {
          prenom: kid.prenom,
          nom: kid.nom,
          date_naissance: kid.date_naissance,
          n_national: kid.n_national,
          adresse: kid.adresse,
          cpostal: kid.cpostal,
          localite: kid.localite,
          ecole: kid.ecole
        },
        health: kid.health || {},
        allergies: kid.allergies || {},
        activities: kid.activities || {},
        departure: kid.departure || {},
        inclusion: kid.inclusion || {}
      });
    }
  }, [kid]);

  if (!kid || !editedData.personal) {
    return <LoadingScreen />;
  }

  const isPersonalInfoIncomplete = !editedData.personal.n_national;

  const toggleSection = (section: string) => {
    setExpandedSection(prev => (prev === section ? null : section));
  };

  const startEditing = (section: string) => {
    setEditingSections(prev => ({ ...prev, [section]: true }));
  };

  const cancelEditing = (section: string) => {
    setEditingSections(prev => ({ ...prev, [section]: false }));
    // reset du bloc
    setEditedData(prev => ({
      ...prev,
      [section]:
        section === 'personal'
          ? {
              prenom: kid.prenom,
              nom: kid.nom,
              date_naissance: kid.date_naissance,
              n_national: kid.n_national,
              adresse: kid.adresse,
              cpostal: kid.cpostal,
              localite: kid.localite,
              ecole: kid.ecole
            }
          : kid[section] || {}
    }));
    setValidationErrors(prev => ({ ...prev, [section]: {} }));
  };

  const saveSection = async (section: string) => {
    const data = editedData[section];
    const errors: Record<string, string> = {};

    if (section === 'personal') {
      if (!data.prenom) errors.prenom = 'Le prénom est requis';
      if (!data.nom) errors.nom = 'Le nom est requis';
      if (!data.date_naissance) errors.date_naissance = 'La date de naissance est requise';
      if (!data.n_national) {
        errors.n_national = 'Le numéro national est requis';
      } else if (!validateBelgianNRN(data.n_national.replace(/\D/g, ''))) {
        errors.n_national = 'Numéro national invalide';
      }
    }

    if (Object.keys(errors).length > 0) {
      setValidationErrors(prev => ({ ...prev, [section]: errors }));
      if (errors.n_national && nrnInputRef.current) {
        nrnInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        nrnInputRef.current.focus();
      }
      return;
    }

    try {
      if (section === 'personal') {
        const ecoleValue = data.ecole === 'other' ? customSchoolName : data.ecole;
        await updateKid(kid.id, {
          ...data,
          ecole: ecoleValue,
          ...(data.n_national
            ? { is_national_number_valid: validateBelgianNRN(data.n_national.replace(/\D/g, '')) }
            : {})
        });
      } else {
        const { supabase } = await import('../../lib/supabase');
        await supabase.from(`kid_${section}`).upsert({ kid_id: kid.id, ...data });
      }
      setEditingSections(prev => ({ ...prev, [section]: false }));
      setValidationErrors(prev => ({ ...prev, [section]: {} }));
      fetchKid(kid.id);
    } catch (err) {
      console.error(`Error saving ${section}`, err);
      setValidationErrors(prev => ({
        ...prev,
        [section]: { submit: "Une erreur s'est produite lors de la sauvegarde" }
      }));
    }
  };

  const updateField = (section: string, field: string, val: any) => {
    setEditedData(prev => ({
      ...prev,
      [section]: { ...prev[section], [field]: val }
    }));
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link to="/kids" className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6">
        <ArrowLeft className="h-5 w-5 mr-2" /> Retour à la liste
      </Link>

      {/* Header with photo */}
      <div className="flex items-center mb-8">
        <div className="h-24 w-24 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
          <div className="relative group">
            <div className="h-24 w-24 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center">
              <ImageWithFallback
                src={photoUrl}
                alt={`${kid.prenom} ${kid.nom}`}
                className="h-full w-full object-cover"
              />
            </div>
            <label className="absolute inset-0 bg-black/30 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 cursor-pointer transition">
              {isUploadingPhoto ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                <>
                  <Upload className="h-6 w-6" />
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    className="hidden"
                    onChange={async e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 5 * 1024 * 1024) return alert('Max 5 Mo');
                      if (!['image/jpeg','image/png'].includes(file.type)) return alert('JPG/PNG seulement');
                      try {
                        await uploadPhoto(kid.id, file);
                        await refreshPhotoUrl(kid.id);
                        setPhotoTimestamp(Date.now());
                        toast.success('Photo mise à jour !');
                      } catch {
                        alert("Erreur lors de l'upload");
                      }
                    }}
                  />
                </>
              )}
            </label>
          </div>
        </div>
        <div className="ml-6">
          <h1 className="text-3xl font-bold text-gray-900">
            {kid.prenom} {kid.nom}
          </h1>
          <p
            className="text-gray-600 mt-1"
            title={`Né(e) le ${new Date(kid.date_naissance).toLocaleDateString('fr-BE')}`}
          >
            {getAgeFromDate(kid.date_naissance)} ans
          </p>
        </div>
      </div>

      {/* Sections */}
      <Section
        title={
          <div className="flex items-center space-x-2">
            <span>Informations personnelles</span>
            {expandedSection !== 'personal' && isPersonalInfoIncomplete && (
              <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-medium">Incomplet</span>
            )}
          </div>
        }
        icon={<User className="h-5 w-5 text-primary-600" />}
        isExpanded={expandedSection === 'personal'}
        onToggle={() => toggleSection('personal')}
        isEditing={editingSections.personal}
        onEdit={() => startEditing('personal')}
        onSave={() => saveSection('personal')}
        onCancel={() => cancelEditing('personal')}
        summary={`${kid.prenom} ${kid.nom} • ${
          kid.ecole === 'other'
            ? 'École non-listée'
            : schools.find(s => s.id === kid.ecole)
            ? `${schools.find(s => s.id === kid.ecole)?.name} (${schools.find(s => s.id === kid.ecole)?.code_postal})`
            : 'École non renseignée'
        }`}
      >
        <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          <Field
            label="Prénom"
            value={editedData.personal.prenom}
            isEditing={editingSections.personal}
            onChange={v => updateField('personal','prenom',v)}
            error={validationErrors.personal?.prenom}
          />
          <Field
            label="Nom"
            value={editedData.personal.nom}
            isEditing={editingSections.personal}
            onChange={v => updateField('personal','nom',v)}
            error={validationErrors.personal?.nom}
          />
          <Field
            label="Date de naissance"
            value={editedData.personal.date_naissance}
            isEditing={editingSections.personal}
            onChange={v => updateField('personal','date_naissance',v)}
            type="date"
          />
          <Field
            label={
              <div className="flex items-center justify-between">
                <span>Numéro national</span>
                {!editedData.personal.n_national && (
                  <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full font-medium">
                    Incomplet
                  </span>
                )}
              </div>
            }
            value={editedData.personal.n_national}
            isEditing={editingSections.personal}
            onChange={v => updateField('personal','n_national',v)}
            error={validationErrors.personal?.n_national}
            ref={el => {
              if (editingSections.personal) nrnInputRef.current = el;
            }}
          />
          <Field
            label="École"
            value={
              editingSections.personal
                ? editedData.personal.ecole
                : editedData.personal.ecole === 'other'
                ? 'École non-listée'
                : schools.find(s => s.id === editedData.personal.ecole)
                ? `${schools.find(s => s.id === editedData.personal.ecole)?.name} (${schools.find(s => s.id === editedData.personal.ecole)?.code_postal})`
                : 'Non renseigné'
            }
            isEditing={editingSections.personal}
            type="select"
            options={[
              ...schools.map(s => ({ value: s.id, label: `${s.name} (${s.code_postal})` })),
              { value: 'other', label: 'Autre / École non listée' }
            ]}
            onChange={v => {
              updateField('personal','ecole',v);
              if (v === 'other') setCustomSchoolName('');
            }}
          />
          {editingSections.personal && editedData.personal.ecole === 'other' && (
            <Field
              label="Nom de l'école (autre)"
              value={customSchoolName}
              isEditing={editingSections.personal}
              onChange={v => setCustomSchoolName(v)}
            />
          )}
          <Field
            label="Adresse"
            value={editedData.personal.adresse}
            isEditing={editingSections.personal}
            onChange={v => updateField('personal','adresse',v)}
          />
          <Field
            label="Code postal"
            value={editedData.personal.cpostal}
            isEditing={editingSections.personal}
            onChange={v => updateField('personal','cpostal',v)}
          />
          <Field
            label="Localité"
            value={editedData.personal.localite}
            isEditing={editingSections.personal}
            onChange={v => updateField('personal','localite',v)}
          />
        </dl>
      </Section>

      {/* Santé */}
      <Section
        title="Santé"
        icon={<Heart className="h-5 w-5 text-primary-600" />}
        isExpanded={expandedSection === 'health'}
        onToggle={() => toggleSection('health')}
        isEditing={editingSections.health}
        onEdit={() => startEditing('health')}
        onSave={() => saveSection('health')}
        onCancel={() => cancelEditing('health')}
        summary={
          kid.health?.specific_medical
            ? 'Informations médicales renseignées'
            : 'Aucune information médicale'
        }
      >
        <dl className="grid grid-cols-1 gap-y-4">
          <Field
            label="Informations médicales"
            value={editedData.health.specific_medical}
            type="textarea"
            isEditing={editingSections.health}
            onChange={v => updateField('health','specific_medical',v)}
          />
          <Field
            label="Antécédents médicaux"
            value={editedData.health.past_medical}
            type="textarea"
            isEditing={editingSections.health}
            onChange={v => updateField('health','past_medical',v)}
          />
          <Field
            label="Médicaments"
            value={editedData.health.medication}
            type="boolean"
            isEditing={editingSections.health}
            onChange={v => updateField('health','medication',v)}
          />
          {editedData.health.medication && (
            <>
              <Field
                label="Détails de la médication"
                value={editedData.health.medication_details}
                type="textarea"
                isEditing={editingSections.health}
                onChange={v => updateField('health','medication_details',v)}
              />
              <Field
                label="Autonomie médicaments"
                value={editedData.health.medication_autonomy}
                type="boolean"
                isEditing={editingSections.health}
                onChange={v => updateField('health','medication_autonomy',v)}
              />
            </>
          )}
          <Field
            label="Tétanos"
            value={editedData.health.tetanus}
            type="boolean"
            isEditing={editingSections.health}
            onChange={v => updateField('health','tetanus',v)}
          />
          <Field
            label="Médecin traitant"
            value={editedData.health.doctor_name}
            isEditing={editingSections.health}
            onChange={v => updateField('health','doctor_name',v)}
          />
          <Field
            label="Téléphone médecin"
            value={editedData.health.doctor_phone}
            type="tel"
            isEditing={editingSections.health}
            onChange={v => updateField('health','doctor_phone',v)}
          />
        </dl>
      </Section>

      {/* Allergies */}
      <Section
        title="Allergies"
        icon={<AlertTriangle className="h-5 w-5 text-primary-600" />}
        isExpanded={expandedSection === 'allergies'}
        onToggle={() => toggleSection('allergies')}
        isEditing={editingSections.allergies}
        onEdit={() => startEditing('allergies')}
        onSave={() => saveSection('allergies')}
        onCancel={() => cancelEditing('allergies')}
        summary={kid.allergies?.has_allergies ? 'Allergies signalées' : 'Aucune allergie'}
      >
        <dl className="grid grid-cols-1 gap-y-4">
          <Field
            label="Allergies"
            value={editedData.allergies.has_allergies}
            type="boolean"
            isEditing={editingSections.allergies}
            onChange={v => updateField('allergies','has_allergies',v)}
          />
          {editedData.allergies.has_allergies && (
            <>
              <Field
                label="Détails des allergies"
                value={editedData.allergies.allergies_details}
                type="textarea"
                isEditing={editingSections.allergies}
                onChange={v => updateField('allergies','allergies_details',v)}
              />
              <Field
                label="Conséquences"
                value={editedData.allergies.allergies_consequences}
                type="textarea"
                isEditing={editingSections.allergies}
                onChange={v => updateField('allergies','allergies_consequences',v)}
              />
            </>
          )}
          <Field
            label="Régime alimentaire spécial"
            value={editedData.allergies.special_diet}
            type="boolean"
            isEditing={editingSections.allergies}
            onChange={v => updateField('allergies','special_diet',v)}
          />
          {editedData.allergies.special_diet && (
            <Field
              label="Détails du régime"
              value={editedData.allergies.diet_details}
              type="textarea"
              isEditing={editingSections.allergies}
              onChange={v => updateField('allergies','diet_details',v)}
            />
          )}
        </dl>
      </Section>

      {/* Activités */}
      <Section
        title="Activités"
        icon={<SwimmingPool className="h-5 w-5 text-primary-600" />}
        isExpanded={expandedSection === 'activities'}
        onToggle={() => toggleSection('activities')}
        isEditing={editingSections.activities}
        onEdit={() => startEditing('activities')}
        onSave={() => saveSection('activities')}
        onCancel={() => cancelEditing('activities')}
        summary={`Natation: ${kid.activities?.swim_level || 'Non renseigné'}`}
      >
        <dl className="grid grid-cols-1 gap-y-4">
          <Field
            label="Peut participer aux activités"
            value={editedData.activities.can_participate}
            type="boolean"
            isEditing={editingSections.activities}
            onChange={v => updateField('activities','can_participate',v)}
          />
          {!editedData.activities.can_participate && (
            <Field
              label="Restrictions"
              value={editedData.activities.restriction_details}
              type="textarea"
              isEditing={editingSections.activities}
              onChange={v => updateField('activities','restriction_details',v)}
            />
          )}
          <Field
            label="Niveau de natation"
            value={editedData.activities.swim_level}
            type="select"
            options={[
              { value: 'pas du tout', label: 'Pas du tout' },
              { value: 'difficilement', label: 'Difficilement' },
              { value: 'bien', label: 'Bien' },
              { value: 'très bien', label: 'Très bien' }
            ]}
            isEditing={editingSections.activities}
            onChange={v => updateField('activities','swim_level',v)}
          />
          <Field
            label="Peur de l'eau"
            value={editedData.activities.water_fear}
            type="boolean"
            isEditing={editingSections.activities}
            onChange={v => updateField('activities','water_fear',v)}
          />
          <Field
            label="Informations complémentaires"
            value={editedData.activities.other_info}
            type="textarea"
            isEditing={editingSections.activities}
            onChange={v => updateField('activities','other_info',v)}
          />
        </dl>
      </Section>

      {/* Départs */}
      <Section
        title="Départs"
        icon={<DoorOpen className="h-5 w-5 text-primary-600" />}
        isExpanded={expandedSection === 'departure'}
        onToggle={() => toggleSection('departure')}
        isEditing={editingSections.departure}
        onEdit={() => startEditing('departure')}
        onSave={() => saveSection('departure')}
        onCancel={() => cancelEditing('departure')}
        summary={kid.departure?.leaves_alone ? 'Départ autonome autorisé' : 'Départ accompagné'}
      >
        <dl className="grid grid-cols-1 gap-y-4">
          <Field
            label="Peut partir seul"
            value={editedData.departure.leaves_alone}
            type="boolean"
            isEditing={editingSections.departure}
            onChange={v => updateField('departure','leaves_alone',v)}
          />
          {editedData.departure.leaves_alone && (
            <Field
              label="Heure de départ"
              value={editedData.departure.departure_time}
              type="text"
              isEditing={editingSections.departure}
              onChange={v => updateField('departure','departure_time',v)}
            />
          )}
          <div className="mt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Personnes autorisées</h3>
            {editingSections.departure ? (
              <div className="space-y-2">
                {persons.map(p => (
                  <label key={p.id} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={(editedData.departure.pickup_people_ids || []).includes(p.id)}
                      onChange={e => {
                        const arr = editedData.departure.pickup_people_ids || [];
                        const next = e.target.checked
                          ? [...arr, p.id]
                          : arr.filter(id => id !== p.id);
                        updateField('departure','pickup_people_ids', next);
                      }}
                      className="form-checkbox text-primary-600"
                    />
                    <span>{p.first_name} {p.last_name}</span>
                  </label>
                ))}
                <Link to="/authorized-persons/new" className="inline-flex items-center text-primary-600 hover:text-primary-700 mt-2">
                  <Plus className="h-4 w-4 mr-1" /> Ajouter une personne
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {(editedData.departure.pickup_people_ids || []).map(pid => {
                  const per = persons.find(x => x.id === pid);
                  if (!per) return null;
                  return (
                    <div key={pid} className="bg-gray-50 p-3 rounded-lg">
                      <div className="font-medium">{per.first_name} {per.last_name}</div>
                      <div className="text-sm text-gray-600 flex items-center mt-1">
                        <Phone className="h-4 w-4 mr-1" />
                        {per.phone_number} • {per.relationship}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </dl>
      </Section>

      {/* Inclusion */}
      <Section
        title="Inclusion"
        icon={<Sparkles className="h-5 w-5 text-primary-600" />}
        isExpanded={expandedSection === 'inclusion'}
        onToggle={() => toggleSection('inclusion')}
        isEditing={editingSections.inclusion}
        onEdit={() => startEditing('inclusion')}
        onSave={() => saveSection('inclusion')}
        onCancel={() => cancelEditing('inclusion')}
        summary={kid.inclusion?.has_needs ? 'Besoins spécifiques signalés' : 'Pas de besoins spécifiques'}
      >
        <dl className="grid grid-cols-1 gap-y-4">
          <Field
            label="Besoins spécifiques"
            value={editedData.inclusion.has_needs}
            type="boolean"
            isEditing={editingSections.inclusion}
            onChange={v => updateField('inclusion','has_needs',v)}
          />
          {editedData.inclusion.has_needs && (
            <>
              <Field
                label="Situation"
                value={editedData.inclusion.situation_details}
                type="textarea"
                isEditing={editingSections.inclusion}
                onChange={v => updateField('inclusion','situation_details',v)}
              />
              <Field
                label="Impact au quotidien"
                value={editedData.inclusion.impact_details}
                type="textarea"
                isEditing={editingSections.inclusion}
                onChange={v => updateField('inclusion','impact_details',v)}
              />
              <Field
                label="Besoin d'accompagnement"
                value={editedData.inclusion.needs_dedicated_staff}
                type="select"
                options={[
                  { value: 'yes', label: 'Oui' },
                  { value: 'no', label: 'Non' },
                  { value: 'sometimes', label: 'Par moments' }
                ]}
                isEditing={editingSections.inclusion}
                onChange={v => updateField('inclusion','needs_dedicated_staff',v)}
              />
              {editedData.inclusion.needs_dedicated_staff && editedData.inclusion.needs_dedicated_staff !== 'no' && (
                <Field
                  label="Détails accompagnement"
                  value={editedData.inclusion.staff_details}
                  type="textarea"
                  isEditing={editingSections.inclusion}
                  onChange={v => updateField('inclusion','staff_details',v)}
                />
              )}
              <Field
                label="Stratégies"
                value={editedData.inclusion.strategies}
                type="textarea"
                isEditing={editingSections.inclusion}
                onChange={v => updateField('inclusion','strategies',v)}
              />
              <Field
                label="Aides techniques"
                value={editedData.inclusion.assistive_devices}
                type="textarea"
                isEditing={editingSections.inclusion}
                onChange={v => updateField('inclusion','assistive_devices',v)}
              />
              <Field
                label="Signes de stress"
                value={editedData.inclusion.stress_signals}
                type="textarea"
                isEditing={editingSections.inclusion}
                onChange={v => updateField('inclusion','stress_signals',v)}
              />
              <Field
                label="Points forts"
                value={editedData.inclusion.strengths}
                type="textarea"
                isEditing={editingSections.inclusion}
                onChange={v => updateField('inclusion','strengths',v)}
              />
              <Field
                label="Expériences précédentes"
                value={editedData.inclusion.previous_experience}
                type="textarea"
                isEditing={editingSections.inclusion}
                onChange={v => updateField('inclusion','previous_experience',v)}
              />
            </>
          )}
        </dl>
      </Section>

      <Toaster position="top-right" />
    </div>
  );
};

export default KidDetailsPage;