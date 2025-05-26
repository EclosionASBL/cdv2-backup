import { Link } from 'react-router-dom';

interface SessionFormModalProps {
  isModalOpen: boolean;
  editingSession: any;
  formData: any;
  setFormData: (data: any) => void;
  handleSubmit: (event: React.FormEvent) => Promise<void>;
  setIsModalOpen: (open: boolean) => void;
  stages: { id: string; title: string }[];
  centers: { id: string; name: string }[];
  conditions: { id: string; label: string }[];
}

const PERIODES = ['Détente', 'Printemps', 'Été', 'Automne', 'Hiver'] as const;

const SessionFormModal = ({
  isModalOpen,
  editingSession,
  formData,
  setFormData,
  handleSubmit,
  setIsModalOpen,
  stages,
  centers,
  conditions,
}: SessionFormModalProps) => {
  if (!isModalOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
        <h2 className="text-xl font-semibold mb-4">
          {editingSession ? 'Modifier la session' : 'Nouvelle session'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Stage
              </label>
              <select
                value={formData.stage_id}
                onChange={(e) => setFormData({ ...formData, stage_id: e.target.value })}
                className="mt-1 form-input"
                required
              >
                <option value="">Sélectionner un stage</option>
                {stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Centre
              </label>
              <select
                value={formData.center_id}
                onChange={(e) => setFormData({ ...formData, center_id: e.target.value })}
                className="mt-1 form-input"
                required
              >
                <option value="">Sélectionner un centre</option>
                {centers.map((center) => (
                  <option key={center.id} value={center.id}>
                    {center.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Période
              </label>
              <select
                value={formData.periode}
                onChange={(e) => setFormData({ ...formData, periode: e.target.value as typeof PERIODES[number] })}
                className="mt-1 form-input"
                required
              >
                {PERIODES.map((periode) => (
                  <option key={periode} value={periode}>
                    {periode}
                  </option>
                ))}
              </select>
            </div>

            {formData.periode === 'Été' && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Semaine
                </label>
                <select
                  value={formData.semaine || ''}
                  onChange={(e) => setFormData({ ...formData, semaine: e.target.value })}
                  className="mt-1 form-input"
                >
                  <option value="">Sélectionner une semaine</option>
                  {Array.from({ length: 7 }, (_, i) => `S${i + 1}`).map((semaine) => (
                    <option key={semaine} value={semaine}>
                      {semaine}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Nombre de jours
              </label>
              <input
                type="number"
                value={formData.nombre_jours || ''}
                onChange={(e) => setFormData({ ...formData, nombre_jours: parseInt(e.target.value) })}
                className="mt-1 form-input"
                min="1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Date de début
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="mt-1 form-input"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Date de fin
              </label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                className="mt-1 form-input"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Places disponibles
            </label>
            <input
              type="number"
              value={formData.capacity}
              onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })}
              className="mt-1 form-input"
              min="1"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Prix normal
              </label>
              <input
                type="number"
                value={formData.prix_normal}
                onChange={(e) => setFormData({ ...formData, prix_normal: parseFloat(e.target.value) })}
                className="mt-1 form-input"
                min="0"
                step="0.01"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Prix réduit
              </label>
              <input
                type="number"
                value={formData.prix_reduit || ''}
                onChange={(e) => setFormData({ ...formData, prix_reduit: parseFloat(e.target.value) })}
                className="mt-1 form-input"
                min="0"
                step="0.01"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-gray-700">
                Condition tarifaire
              </label>
              <Link
                to="/admin/tarifs"
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                ➕ Créer une nouvelle condition
              </Link>
            </div>
            <select
              value={formData.tarif_condition_id || ''}
              onChange={(e) => setFormData({ ...formData, tarif_condition_id: e.target.value || undefined })}
              className="mt-1 form-input"
            >
              <option value="">Aucune condition spéciale</option>
              {conditions.map((condition) => (
                <option key={condition.id} value={condition.id}>
                  {condition.label}
                </option>
              ))}
            </select>
          </div>

          {formData.tarif_condition_id && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Prix local
                </label>
                <input
                  type="number"
                  value={formData.prix_local || ''}
                  onChange={(e) => setFormData({ ...formData, prix_local: parseFloat(e.target.value) })}
                  className="mt-1 form-input"
                  min="0"
                  step="0.01"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Prix local réduit
                </label>
                <input
                  type="number"
                  value={formData.prix_local_reduit || ''}
                  onChange={(e) => setFormData({ ...formData, prix_local_reduit: parseFloat(e.target.value) })}
                  className="mt-1 form-input"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Semaine
            </label>
            <select
              value={formData.semaine || ''}
              onChange={(e) => setFormData({ ...formData, semaine: e.target.value })}
              className="mt-1 form-input"
            >
              <option value="">Sélectionner une semaine</option>
              {Array.from({ length: 7 }, (_, i) => `S${i + 1}`).map((semaine) => (
                <option key={semaine} value={semaine}>
                  {semaine}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Remarques
            </label>
            <textarea
              value={formData.remarques || ''}
              onChange={(e) => setFormData({ ...formData, remarques: e.target.value })}
              className="mt-1 form-input"
              rows={3}
              placeholder="Informations complémentaires..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Visible à partir de
            </label>
            <input
              type="datetime-local"
              value={formData.visible_from || ''}
              onChange={(e) => setFormData({ ...formData, visible_from: e.target.value })}
              className="mt-1 form-input"
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
            >
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SessionFormModal;