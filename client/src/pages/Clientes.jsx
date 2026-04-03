import { useState, useEffect } from 'react';
import { Users, Plus, Edit2, Trash2, Save, X, Loader2 } from 'lucide-react';
import { clientsApi } from '../services/api';

const BRAND_TONES = ['luxo', 'moderno', 'divertido', 'profissional', 'minimalista'];

const capitalize = (str) => str.charAt(0).toUpperCase() + str.slice(1);

const DEFAULT_FORM = {
  name: '',
  segment: '',
  primary_color: '#C9A84C',
  secondary_color: '#0D1B2A',
  font_style: 'Montserrat',
  brand_tone: 'luxo',
  arts_limit: 15,
};

export default function Clientes() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const fetchClients = async () => {
    try {
      const res = await clientsApi.getAll();
      setClients(res.data.data || res.data || []);
    } catch {
      setError('Erro ao carregar clientes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm(DEFAULT_FORM);
    setError(null);
    setShowModal(true);
  };

  const openEdit = (client) => {
    setEditingId(client.id);
    setForm({
      name: client.name || '',
      segment: client.segment || '',
      primary_color: client.primary_color || '#C9A84C',
      secondary_color: client.secondary_color || '#0D1B2A',
      font_style: client.font_style || 'Montserrat',
      brand_tone: client.brand_tone || 'luxo',
      arts_limit: client.arts_limit ?? 15,
    });
    setError(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setError(null);
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError('O campo Nome é obrigatório.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = { ...form, arts_limit: Number(form.arts_limit) };
      if (editingId) {
        await clientsApi.update(editingId, payload);
      } else {
        await clientsApi.create(payload);
      }
      await fetchClients();
      closeModal();
    } catch (err) {
      setError(err.response?.data?.error || 'Erro ao salvar cliente.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await clientsApi.delete(id);
      setClients((prev) => prev.filter((c) => c.id !== id));
    } catch {
      setError('Erro ao deletar cliente.');
    } finally {
      setDeleteConfirm(null);
    }
  };

  const formatDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('pt-BR');
  };

  return (
    <div className="p-8 min-h-screen bg-primary">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center">
            <Users size={20} className="text-gold" />
          </div>
          <div>
            <h1 className="text-white text-2xl font-bold">Clientes</h1>
            <p className="text-gray-400 text-sm">Gerencie seus clientes e marcas</p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-gold hover:bg-gold-light text-primary font-semibold px-5 py-2.5 rounded-lg transition-all duration-200 text-sm"
        >
          <Plus size={16} />
          Novo Cliente
        </button>
      </div>

      {/* Error banner */}
      {error && !showModal && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2">
          <X size={16} />
          {error}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={32} className="animate-spin text-gold" />
        </div>
      ) : clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
            <Users size={28} className="text-gray-600" />
          </div>
          <p className="text-gray-400 font-medium">Nenhum cliente cadastrado</p>
          <p className="text-gray-600 text-sm mt-1">Clique em "Novo Cliente" para começar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {clients.map((client) => (
            <div
              key={client.id}
              className="bg-secondary rounded-xl border border-white/5 p-5 flex flex-col gap-4 hover:border-gold/20 transition-colors duration-200"
            >
              {/* Color preview strip */}
              <div className="flex gap-2">
                <div
                  className="w-8 h-8 rounded-lg border border-white/10 shrink-0"
                  style={{ backgroundColor: client.primary_color || '#C9A84C' }}
                  title={`Cor primária: ${client.primary_color}`}
                />
                <div
                  className="w-8 h-8 rounded-lg border border-white/10 shrink-0"
                  style={{ backgroundColor: client.secondary_color || '#0D1B2A' }}
                  title={`Cor secundária: ${client.secondary_color}`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm truncate">{client.name}</p>
                  <p className="text-gray-500 text-xs truncate">{client.segment || 'Sem segmento'}</p>
                </div>
              </div>

              {/* Details */}
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Tom de voz</span>
                  <span className="px-2 py-0.5 rounded-full bg-gold/10 text-gold border border-gold/20 capitalize">
                    {client.brand_tone || '—'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Fonte</span>
                  <span className="text-gray-300">{client.font_style || 'Montserrat'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Limite de artes</span>
                  <span className="text-gray-300">{client.arts_limit ?? 15}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Criado em</span>
                  <span className="text-gray-300">{formatDate(client.created_at)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-auto pt-2 border-t border-white/5">
                <button
                  onClick={() => openEdit(client)}
                  className="flex-1 flex items-center justify-center gap-1.5 border border-white/10 text-gray-400 hover:text-white hover:border-white/30 py-2 rounded-lg text-xs transition-colors duration-200"
                >
                  <Edit2 size={13} />
                  Editar
                </button>
                <button
                  onClick={() => setDeleteConfirm(client.id)}
                  className="flex items-center justify-center gap-1.5 border border-red-500/20 text-red-400 hover:bg-red-500/10 px-3 py-2 rounded-lg text-xs transition-colors duration-200"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-secondary rounded-xl border border-white/10 p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-white font-semibold text-lg mb-2">Confirmar exclusão</h3>
            <p className="text-gray-400 text-sm mb-6">
              Tem certeza que deseja remover este cliente? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 border border-white/10 text-gray-400 hover:text-white py-2.5 rounded-lg text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 py-2.5 rounded-lg text-sm transition-colors"
              >
                Deletar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-secondary rounded-xl border border-white/10 p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white font-bold text-lg">
                {editingId ? 'Editar Cliente' : 'Novo Cliente'}
              </h2>
              <button
                onClick={closeModal}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Error in modal */}
            {error && (
              <div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2">
                <X size={14} />
                {error}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                  Nome <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  placeholder="Ex: Marca Premium"
                  className="w-full bg-primary border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-gray-500 focus:border-gold focus:ring-1 focus:ring-gold/50 outline-none transition-all duration-200"
                />
              </div>

              {/* Segment */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Segmento</label>
                <input
                  type="text"
                  value={form.segment}
                  onChange={(e) => handleChange('segment', e.target.value)}
                  placeholder="Ex: Cosméticos, Moda, Alimentação"
                  className="w-full bg-primary border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-gray-500 focus:border-gold focus:ring-1 focus:ring-gold/50 outline-none transition-all duration-200"
                />
              </div>

              {/* Colors */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Cor Primária</label>
                  <div className="flex items-center gap-3 bg-primary border border-white/10 rounded-lg px-4 py-3">
                    <input
                      type="color"
                      value={form.primary_color}
                      onChange={(e) => handleChange('primary_color', e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
                    />
                    <span className="text-white text-sm font-mono">{form.primary_color}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Cor Secundária</label>
                  <div className="flex items-center gap-3 bg-primary border border-white/10 rounded-lg px-4 py-3">
                    <input
                      type="color"
                      value={form.secondary_color}
                      onChange={(e) => handleChange('secondary_color', e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer border-0 bg-transparent"
                    />
                    <span className="text-white text-sm font-mono">{form.secondary_color}</span>
                  </div>
                </div>
              </div>

              {/* Color preview */}
              <div
                className="w-full h-10 rounded-lg border border-white/10 flex items-center justify-center text-xs font-medium"
                style={{
                  background: `linear-gradient(135deg, ${form.primary_color} 0%, ${form.secondary_color} 100%)`,
                  color: '#ffffff',
                }}
              >
                Preview das cores
              </div>

              {/* Font */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Fonte</label>
                <input
                  type="text"
                  value={form.font_style}
                  onChange={(e) => handleChange('font_style', e.target.value)}
                  placeholder="Montserrat"
                  className="w-full bg-primary border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-gray-500 focus:border-gold focus:ring-1 focus:ring-gold/50 outline-none transition-all duration-200"
                />
              </div>

              {/* Brand tone */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Tom de Voz</label>
                <select
                  value={form.brand_tone}
                  onChange={(e) => handleChange('brand_tone', e.target.value)}
                  className="w-full bg-primary border border-white/10 rounded-lg px-4 py-3 text-white focus:border-gold focus:ring-1 focus:ring-gold/50 outline-none transition-all duration-200 appearance-none cursor-pointer"
                >
                  {BRAND_TONES.map((tone) => (
                    <option key={tone} value={tone}>
                      {capitalize(tone)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Arts limit */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Limite de Artes</label>
                <input
                  type="number"
                  min={1}
                  value={form.arts_limit}
                  onChange={(e) => handleChange('arts_limit', e.target.value)}
                  className="w-full bg-primary border border-white/10 rounded-lg px-4 py-3 text-white focus:border-gold focus:ring-1 focus:ring-gold/50 outline-none transition-all duration-200"
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="flex-1 border border-white/10 text-gray-400 hover:text-white hover:border-white/30 py-3 rounded-lg text-sm transition-colors duration-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 bg-gold hover:bg-gold-light text-primary font-semibold py-3 rounded-lg text-sm transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      {editingId ? 'Atualizar' : 'Cadastrar'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
