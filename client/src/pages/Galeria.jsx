import { useState, useEffect } from 'react';
import { Image as ImageIcon, Download, Trash2, X, Loader2, Filter } from 'lucide-react';
import { artsApi, clientsApi } from '../services/api';

const STATUS_LABELS = {
  completed: { label: 'Concluída', classes: 'bg-green-500/10 text-green-400 border-green-500/20' },
  processing: { label: 'Processando', classes: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  failed: { label: 'Falhou', classes: 'bg-red-500/10 text-red-400 border-red-500/20' },
};

export default function Galeria() {
  const [arts, setArts] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterClient, setFilterClient] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (filterClient) params.client_id = filterClient;
      if (filterStatus) params.status = filterStatus;

      const [artsRes, clientsRes] = await Promise.all([
        artsApi.getAll(params),
        clientsApi.getAll(),
      ]);

      setArts(artsRes.data.data || artsRes.data || []);
      setClients(clientsRes.data.data || clientsRes.data || []);
    } catch {
      setError('Erro ao carregar galeria.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterClient, filterStatus]);

  const handleDelete = async (id) => {
    try {
      await artsApi.delete(id);
      setArts((prev) => prev.filter((a) => a.id !== id));
    } catch {
      setError('Erro ao deletar arte.');
    } finally {
      setDeleteConfirm(null);
    }
  };

  const handleDownload = (url, filename) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  };

  const formatDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('pt-BR');
  };

  return (
    <div className="p-8 min-h-screen bg-primary">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center">
          <ImageIcon size={20} className="text-gold" />
        </div>
        <div>
          <h1 className="text-white text-2xl font-bold">Galeria</h1>
          <p className="text-gray-400 text-sm">Artes geradas pela IA</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-8 items-center">
        <div className="flex items-center gap-2 text-gray-400 text-sm">
          <Filter size={15} />
          <span>Filtros:</span>
        </div>
        <select
          value={filterClient}
          onChange={(e) => setFilterClient(e.target.value)}
          className="bg-secondary border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:border-gold focus:ring-1 focus:ring-gold/50 outline-none transition-all duration-200 appearance-none cursor-pointer"
        >
          <option value="">Todos os clientes</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-secondary border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:border-gold focus:ring-1 focus:ring-gold/50 outline-none transition-all duration-200 appearance-none cursor-pointer"
        >
          <option value="">Todos os status</option>
          <option value="completed">Concluída</option>
          <option value="processing">Processando</option>
          <option value="failed">Falhou</option>
        </select>
        {(filterClient || filterStatus) && (
          <button
            onClick={() => { setFilterClient(''); setFilterStatus(''); }}
            className="flex items-center gap-1.5 text-gray-400 hover:text-white text-sm border border-white/10 hover:border-white/30 px-3 py-2 rounded-lg transition-colors duration-200"
          >
            <X size={13} />
            Limpar
          </button>
        )}
      </div>

      {/* Error banner */}
      {error && (
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
      ) : arts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
            <ImageIcon size={28} className="text-gray-600" />
          </div>
          <p className="text-gray-400 font-medium">Nenhuma arte encontrada</p>
          <p className="text-gray-600 text-sm mt-1">
            Gere sua primeira arte na página "Criar Arte"
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {arts.map((art) => {
            const status = STATUS_LABELS[art.status] || STATUS_LABELS.processing;
            return (
              <div
                key={art.id}
                className="bg-secondary rounded-xl border border-white/5 overflow-hidden hover:border-gold/20 transition-colors duration-200 flex flex-col"
              >
                {/* Image */}
                <div className="aspect-square bg-primary flex items-center justify-center overflow-hidden">
                  {art.image_url ? (
                    <img
                      src={art.image_url}
                      alt={art.product_name || 'Arte gerada'}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        e.currentTarget.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div
                    className="w-full h-full flex items-center justify-center"
                    style={{ display: art.image_url ? 'none' : 'flex' }}
                  >
                    <ImageIcon size={40} className="text-gray-700" />
                  </div>
                </div>

                {/* Info */}
                <div className="p-4 flex flex-col gap-3 flex-1">
                  <div>
                    <p className="text-white text-sm font-semibold truncate">
                      {art.product_name || 'Produto sem nome'}
                    </p>
                    <p className="text-gray-500 text-xs truncate mt-0.5">
                      {art.client_name || '—'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs border ${status.classes}`}
                    >
                      {status.label}
                    </span>
                    <span className="text-gray-600 text-xs">{formatDate(art.created_at)}</span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-auto">
                    {art.image_url && (
                      <button
                        onClick={() =>
                          handleDownload(art.image_url, `arte-${art.id}.png`)
                        }
                        className="flex-1 flex items-center justify-center gap-1.5 bg-gold/10 hover:bg-gold/20 border border-gold/20 text-gold py-2 rounded-lg text-xs transition-colors duration-200"
                      >
                        <Download size={13} />
                        Baixar
                      </button>
                    )}
                    <button
                      onClick={() => setDeleteConfirm(art.id)}
                      className="flex items-center justify-center border border-red-500/20 text-red-400 hover:bg-red-500/10 px-3 py-2 rounded-lg text-xs transition-colors duration-200"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-secondary rounded-xl border border-white/10 p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-white font-semibold text-lg mb-2">Confirmar exclusão</h3>
            <p className="text-gray-400 text-sm mb-6">
              Tem certeza que deseja remover esta arte? O arquivo também será deletado.
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
    </div>
  );
}
