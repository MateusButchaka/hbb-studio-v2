import { useState, useEffect } from 'react';
import { LayoutDashboard, Users, Image as ImageIcon, Film, Palette, TrendingUp, Loader2 } from 'lucide-react';
import { dashboardApi, artsApi } from '../services/api';

const STATUS_LABELS = {
  completed: { label: 'Concluída', classes: 'bg-green-500/10 text-green-400 border-green-500/20' },
  processing: { label: 'Processando', classes: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
  failed: { label: 'Falhou', classes: 'bg-red-500/10 text-red-400 border-red-500/20' },
};

const METRIC_CARDS = [
  { key: 'total_clients', label: 'Clientes', icon: Users, color: 'text-blue-400', bg: 'bg-blue-500/10' },
  { key: 'total_arts', label: 'Artes Geradas', icon: Palette, color: 'text-gold', bg: 'bg-gold/10' },
  { key: 'total_videos', label: 'Vídeos', icon: Film, color: 'text-purple-400', bg: 'bg-purple-500/10' },
  { key: 'arts_this_month', label: 'Artes este mês', icon: TrendingUp, color: 'text-green-400', bg: 'bg-green-500/10' },
];

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [recentArts, setRecentArts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, artsRes] = await Promise.all([
          dashboardApi.getData(),
          artsApi.getAll(),
        ]);
        setStats(statsRes.data.data || statsRes.data);
        const allArts = artsRes.data.data || artsRes.data || [];
        setRecentArts(allArts.slice(0, 8));
      } catch {
        setError('Erro ao carregar dados do dashboard.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const formatDate = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('pt-BR');
  };

  return (
    <div className="p-8 min-h-screen bg-primary">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center">
          <LayoutDashboard size={20} className="text-gold" />
        </div>
        <div>
          <h1 className="text-white text-2xl font-bold">Dashboard</h1>
          <p className="text-gray-400 text-sm">Visão geral do HBB Studio</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 size={32} className="animate-spin text-gold" />
        </div>
      ) : error ? (
        <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      ) : (
        <>
          {/* Metric cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-10">
            {METRIC_CARDS.map(({ key, label, icon: Icon, color, bg }) => (
              <div
                key={key}
                className="bg-secondary rounded-xl border border-white/5 p-5 flex items-center gap-4 hover:border-gold/20 transition-colors duration-200"
              >
                <div className={`w-12 h-12 rounded-xl ${bg} flex items-center justify-center shrink-0`}>
                  <Icon size={22} className={color} />
                </div>
                <div>
                  <p className="text-gray-400 text-xs font-medium">{label}</p>
                  <p className="text-white text-2xl font-bold mt-0.5">
                    {stats?.[key] ?? 0}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Recent arts */}
          <div>
            <div className="flex items-center gap-2 mb-5">
              <ImageIcon size={16} className="text-gold" />
              <h2 className="text-white font-semibold">Últimas Artes Geradas</h2>
            </div>

            {recentArts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center bg-secondary rounded-xl border border-white/5">
                <div className="w-14 h-14 rounded-full bg-white/5 flex items-center justify-center mb-4">
                  <ImageIcon size={24} className="text-gray-600" />
                </div>
                <p className="text-gray-400 font-medium text-sm">Nenhuma arte gerada ainda</p>
                <p className="text-gray-600 text-xs mt-1">
                  Vá para "Criar Arte" para gerar sua primeira arte com IA
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {recentArts.map((art) => {
                  const status = STATUS_LABELS[art.status] || STATUS_LABELS.processing;
                  return (
                    <div
                      key={art.id}
                      className="bg-secondary rounded-xl border border-white/5 overflow-hidden hover:border-gold/20 transition-colors duration-200"
                    >
                      {/* Thumbnail */}
                      <div className="aspect-square bg-primary flex items-center justify-center overflow-hidden">
                        {art.image_url ? (
                          <img
                            src={art.image_url}
                            alt={art.product_name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        ) : (
                          <ImageIcon size={32} className="text-gray-700" />
                        )}
                      </div>

                      <div className="p-3 space-y-2">
                        <p className="text-white text-xs font-semibold truncate">
                          {art.product_name || '—'}
                        </p>
                        <p className="text-gray-500 text-xs truncate">{art.client_name || '—'}</p>
                        <div className="flex items-center justify-between">
                          <span className={`px-2 py-0.5 rounded-full text-xs border ${status.classes}`}>
                            {status.label}
                          </span>
                          <span className="text-gray-600 text-xs">{formatDate(art.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
