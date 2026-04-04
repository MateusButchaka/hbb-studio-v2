import { useState, useEffect, useRef } from 'react';
import {
  Clapperboard,
  Upload,
  X,
  Image as ImageIcon,
  Download,
  RotateCcw,
  CheckCircle,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { clientsApi, lookbookApi } from '../services/api';

const GENERATION_STEPS = [
  { key: 'removing_bg', emoji: '✂️', label: 'Removendo fundo do produto...' },
  { key: 'composing', emoji: '🖼️', label: 'Compondo arte lookbook...' },
  { key: 'creating_video', emoji: '🎬', label: 'Criando vídeo...' },
];

const STEP_TIMING = [
  { key: 'removing_bg', delay: 0 },
  { key: 'composing', delay: 4000 },
  { key: 'creating_video', delay: 10000 },
];

export default function ContentFactory() {
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [productName, setProductName] = useState('');
  const [price, setPrice] = useState('');
  const [hookText, setHookText] = useState('');
  const [productImage, setProductImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateVideo, setGenerateVideo] = useState(false);
  const [videoStyle, setVideoStyle] = useState('elegante');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [generationStep, setGenerationStep] = useState(null);

  const fileInputRef = useRef(null);
  const stepTimersRef = useRef([]);

  useEffect(() => {
    clientsApi
      .getAll()
      .then((res) => {
        const data = res.data;
        setClients(data.data || data || []);
      })
      .catch(() => setClients([]));
  }, []);

  useEffect(() => {
    return () => stepTimersRef.current.forEach(clearTimeout);
  }, []);

  const handleFile = (file) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Formato inválido. Use JPG, PNG ou WebP.');
      return;
    }
    setProductImage(file);
    const objectUrl = URL.createObjectURL(file);
    if (objectUrl.startsWith('blob:')) {
      setImagePreview(objectUrl);
    }
    setError(null);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  };

  const handleDragEnter = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDragOver = (e) => { e.preventDefault(); };

  const removeImage = () => {
    setProductImage(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const startStepTimers = (withVideo) => {
    stepTimersRef.current.forEach(clearTimeout);
    stepTimersRef.current = [];
    const steps = withVideo ? STEP_TIMING : STEP_TIMING.filter((s) => s.key !== 'creating_video');
    steps.forEach(({ key, delay }) => {
      const t = setTimeout(() => setGenerationStep(key), delay);
      stepTimersRef.current.push(t);
    });
  };

  const isStepDone = (stepKey) => {
    const currentIdx = GENERATION_STEPS.findIndex((s) => s.key === generationStep);
    const stepIdx = GENERATION_STEPS.findIndex((s) => s.key === stepKey);
    return currentIdx > stepIdx;
  };

  const isStepActive = (stepKey) => generationStep === stepKey;

  const handleGenerate = async () => {
    setError(null);
    if (!productImage || !productName) {
      setError('Preencha os campos obrigatórios: imagem e nome do produto.');
      return;
    }

    setIsGenerating(true);
    setResult(null);
    setGenerationStep('removing_bg');
    startStepTimers(generateVideo);

    const formData = new FormData();
    formData.append('product_image', productImage);
    formData.append('product_name', productName);
    formData.append('price', price);
    if (hookText) formData.append('hook_text', hookText);
    if (selectedClient) formData.append('client_id', selectedClient);
    if (generateVideo) {
      formData.append('generate_video', 'true');
      formData.append('video_style', videoStyle);
    }

    try {
      const res = await lookbookApi.generate(formData);
      setResult(res.data.data || res.data);
      setGenerationStep('done');
    } catch (err) {
      setError(
        err.response?.data?.error || err.response?.data?.message || 'Erro ao gerar lookbook. Tente novamente.'
      );
    } finally {
      setIsGenerating(false);
      stepTimersRef.current.forEach(clearTimeout);
    }
  };

  const handleReset = () => {
    setResult(null);
    setGenerationStep(null);
    setSelectedClient('');
    setProductName('');
    setPrice('');
    setHookText('');
    removeImage();
    setGenerateVideo(false);
    setVideoStyle('elegante');
    setError(null);
  };

  const handleDownload = async (url, filename) => {
    if (!url || (!url.startsWith('/') && !url.startsWith('blob:'))) return;
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      // fallback: open in new tab
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const isFormValid = productImage && productName;

  const visibleSteps = generateVideo
    ? GENERATION_STEPS
    : GENERATION_STEPS.filter((s) => s.key !== 'creating_video');

  return (
    <div className="p-8 min-h-screen bg-primary">
      {/* Page title */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center">
          <Clapperboard size={20} className="text-gold" />
        </div>
        <div>
          <h1 className="text-white text-2xl font-bold">TikTok Content Factory</h1>
          <p className="text-gray-400 text-sm">Gere artes Clean Lookbook sem IA de fundo</p>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-2">
          <X size={16} />
          {error}
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* ── LEFT COLUMN: Form ── */}
        <div className="space-y-6">
          {/* Optional client selector */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Cliente <span className="text-gray-500 font-normal">(opcional)</span>
            </label>
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="w-full bg-secondary border border-white/10 rounded-lg px-4 py-3 text-white
                focus:border-gold focus:ring-1 focus:ring-gold/50 outline-none transition-all duration-200
                appearance-none cursor-pointer"
            >
              <option value="">Usar primeiro cliente disponível</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.segment ? ` (${c.segment})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Drag-and-drop zone */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Foto do Produto <span className="text-red-400">*</span>
            </label>
            {imagePreview ? (
              <div className="relative rounded-xl overflow-hidden border border-gold/30 bg-secondary">
                <img src={imagePreview} alt="Preview" className="w-full max-h-64 object-contain" />
                <button
                  onClick={removeImage}
                  className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-500/80 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ${
                  isDragging
                    ? 'border-gold bg-gold/5 scale-[1.01]'
                    : 'border-gold/30 bg-secondary hover:border-gold/60 hover:bg-gold/[0.03]'
                }`}
              >
                <Upload size={36} className={`mb-3 transition-colors ${isDragging ? 'text-gold' : 'text-gold/50'}`} />
                <p className="text-white font-medium text-sm">Arraste a foto do produto aqui</p>
                <p className="text-gray-500 text-xs mt-1">ou clique para selecionar</p>
                <p className="text-gray-600 text-xs mt-3">JPG, PNG, WebP</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => handleFile(e.target.files[0])}
            />
          </div>

          {/* Product name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Nome do Produto <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="Ex: Tênis Air Max Premium"
              className="w-full bg-secondary border border-white/10 rounded-lg px-4 py-3 text-white
                placeholder:text-gray-500 focus:border-gold focus:ring-1 focus:ring-gold/50
                outline-none transition-all duration-200"
            />
          </div>

          {/* Price */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Preço</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium text-sm">R$</span>
              <input
                type="text"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="199,90"
                className="w-full bg-secondary border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white
                  placeholder:text-gray-500 focus:border-gold focus:ring-1 focus:ring-gold/50
                  outline-none transition-all duration-200"
              />
            </div>
          </div>

          {/* Hook text */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Texto de Gancho <span className="text-gray-500 font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={hookText}
              onChange={(e) => setHookText(e.target.value)}
              placeholder="O tênis que está bombando no TikTok"
              className="w-full bg-secondary border border-white/10 rounded-lg px-4 py-3 text-white
                placeholder:text-gray-500 focus:border-gold focus:ring-1 focus:ring-gold/50
                outline-none transition-all duration-200"
            />
            <p className="text-gray-600 text-xs mt-1">
              Aparece no topo da arte. Deixe em branco para usar o padrão.
            </p>
          </div>

          {/* Video options */}
          <div className="bg-secondary rounded-xl p-5 border border-white/5">
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div
                onClick={() => setGenerateVideo((v) => !v)}
                className={`w-11 h-6 rounded-full transition-colors duration-200 flex items-center px-1 ${
                  generateVideo ? 'bg-gold' : 'bg-white/10'
                }`}
              >
                <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${generateVideo ? 'translate-x-5' : 'translate-x-0'}`} />
              </div>
              <span className="text-white text-sm font-medium">Gerar vídeo também</span>
            </label>

            {generateVideo && (
              <div className="mt-4">
                <label className="block text-xs font-medium text-gray-400 mb-2">Estilo do vídeo</label>
                <select
                  value={videoStyle}
                  onChange={(e) => setVideoStyle(e.target.value)}
                  className="w-full bg-primary border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm
                    focus:border-gold focus:ring-1 focus:ring-gold/50 outline-none transition-all duration-200"
                >
                  <option value="elegante">Elegante</option>
                  <option value="dinamico">Dinâmico</option>
                </select>
              </div>
            )}
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={!isFormValid || isGenerating}
            className="w-full bg-gold hover:bg-gold-light text-primary font-semibold px-6 py-4 rounded-lg
              transition-all duration-200 flex items-center justify-center gap-2
              disabled:opacity-50 disabled:cursor-not-allowed text-base"
          >
            {isGenerating ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                {GENERATION_STEPS.find((s) => s.key === generationStep)?.label || 'Gerando...'}
              </>
            ) : (
              <>
                <Sparkles size={18} />
                Gerar Lookbook
              </>
            )}
          </button>
        </div>

        {/* ── RIGHT COLUMN: Preview / Result ── */}
        <div>
          {isGenerating ? (
            <div className="space-y-4">
              <div className="w-full aspect-[3/4] rounded-xl skeleton" />
              <div className="skeleton h-4 rounded-full w-3/4" />
              <div className="skeleton h-4 rounded-full w-1/2" />
              <div className="bg-secondary rounded-xl p-5 border border-white/5 mt-4 space-y-3">
                <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-4">
                  Progresso da geração
                </p>
                {visibleSteps.map((step) => {
                  const done = isStepDone(step.key);
                  const active = isStepActive(step.key);
                  return (
                    <div
                      key={step.key}
                      className={`flex items-center gap-3 text-sm transition-all duration-300 ${
                        done ? 'text-green-400' : active ? 'text-gold font-semibold' : 'text-gray-600'
                      }`}
                    >
                      {done ? (
                        <CheckCircle size={16} className="shrink-0" />
                      ) : active ? (
                        <Loader2 size={16} className="animate-spin shrink-0" />
                      ) : (
                        <span className="w-4 h-4 rounded-full border border-gray-700 shrink-0" />
                      )}
                      <span>{step.emoji} {step.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : result ? (
            <div className="space-y-4">
              {result.art?.image_url && (
                <div className="rounded-xl overflow-hidden border border-gold/20">
                  <img
                    src={result.art.image_url}
                    alt="Arte lookbook gerada"
                    className="w-full object-contain"
                  />
                </div>
              )}

              {result.video?.video_path && (
                <video
                  src={`/${result.video.video_path}`}
                  controls
                  className="w-full rounded-xl border border-white/10"
                />
              )}

              <div className="flex flex-wrap gap-3">
                {result.art?.image_url && (
                  <button
                    onClick={() => handleDownload(result.art.image_url, 'lookbook-hbb.png')}
                    className="flex items-center gap-2 bg-gold hover:bg-gold-light text-primary font-semibold
                      px-5 py-2.5 rounded-lg transition-all duration-200 text-sm"
                  >
                    <Download size={16} />
                    Baixar Arte
                  </button>
                )}
                {result.video?.video_path && (
                  <button
                    onClick={() => handleDownload(`/${result.video.video_path}`, 'lookbook-video-hbb.mp4')}
                    className="flex items-center gap-2 border border-gold/40 text-gold hover:bg-gold/10
                      px-5 py-2.5 rounded-lg transition-all duration-200 text-sm"
                  >
                    <Download size={16} />
                    Baixar Vídeo
                  </button>
                )}
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 border border-white/10 text-gray-400 hover:text-white
                    hover:border-white/30 px-5 py-2.5 rounded-lg transition-all duration-200 text-sm"
                >
                  <RotateCcw size={16} />
                  Criar Outro
                </button>
              </div>
            </div>
          ) : (
            <div className="w-full aspect-[3/4] rounded-xl bg-secondary border border-white/5 flex flex-col items-center justify-center gap-4">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                <ImageIcon size={28} className="text-gray-600" />
              </div>
              <div className="text-center">
                <p className="text-gray-500 text-sm font-medium">Sua arte lookbook aparecerá aqui</p>
                <p className="text-gray-600 text-xs mt-1">
                  Fundo sólido • Produto centralizado • Tipografia limpa
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
