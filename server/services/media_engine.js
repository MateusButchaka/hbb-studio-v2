/**
 * media_engine.js — Motor de Composição de Imagem e Geração de Vídeo
 *
 * Usa Sharp para composição de imagens e fluent-ffmpeg para geração de vídeos com efeito Ken Burns.
 *
 * REQUISITO: O FFmpeg deve estar instalado no sistema (https://ffmpeg.org/download.html).
 *            No Linux: `sudo apt-get install ffmpeg`
 *            No macOS: `brew install ffmpeg`
 *            No Windows: baixe o executável e adicione ao PATH.
 */

'use strict';

const sharp = require('sharp');
const { createCanvas, loadImage } = require('canvas');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const ART_WIDTH = 1080;
const ART_HEIGHT = 1440;
const VIDEO_DURATION = 15; // segundos
const VIDEO_FPS = 30;

// Diretórios de saída (relativos à raiz do projeto)
const ROOT_DIR = path.join(__dirname, '..', '..');
const OUTPUTS_ARTS_DIR = path.join(ROOT_DIR, 'outputs', 'arts');
const OUTPUTS_VIDEOS_DIR = path.join(ROOT_DIR, 'outputs', 'videos');
const ASSETS_MUSIC_DIR = path.join(ROOT_DIR, 'assets', 'music');

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

/**
 * Garante que um diretório existe, criando-o recursivamente se necessário.
 * @param {string} dir - Caminho do diretório.
 */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log('📁 Diretório criado:', dir);
  }
}

// ---------------------------------------------------------------------------
// Função: removeBackground
// ---------------------------------------------------------------------------

/**
 * Remove ou isola o produto do fundo usando Sharp.
 *
 * Estratégia:
 *  1. Se a imagem já tiver canal alpha (PNG com transparência), mantém e retorna.
 *  2. Se for JPG ou PNG sem alpha, aplica threshold para criar uma máscara do fundo
 *     branco/claro e adiciona transparência, depois retorna com `ensureAlpha()`.
 *  3. Fallback: se qualquer etapa falhar, retorna a imagem original redimensionada
 *     centralizada (máximo 600×600) com alpha adicionado.
 *
 * @param {string} productImagePath - Caminho local da foto do produto.
 * @returns {Promise<Buffer>} Buffer PNG com transparência (canal alpha).
 */
async function removeBackground(productImagePath) {
  console.log('✂️  Iniciando remoção de fundo:', productImagePath);

  try {
    const image = sharp(productImagePath);
    const metadata = await image.metadata();

    console.log(`ℹ️  Formato: ${metadata.format}, canais: ${metadata.channels}, tem alpha: ${metadata.hasAlpha}`);

    // --- Caso 1: imagem já possui canal alpha ---
    if (metadata.hasAlpha) {
      console.log('✅ Imagem já possui canal alpha — mantendo transparência original');
      const buffer = await sharp(productImagePath)
        .resize({ width: 600, height: 600, fit: 'inside', withoutEnlargement: true })
        .png()
        .toBuffer();
      return buffer;
    }

    // --- Caso 2: sem alpha — tenta remover fundo branco/claro via threshold + mask ---
    console.log('🔧 Aplicando técnica de remoção de fundo claro/branco...');

    // Gera máscara em tons de cinza: pixels claros (fundo) → preto; pixels escuros (produto) → branco
    const { data: rawData, info } = await sharp(productImagePath)
      .resize({ width: 600, height: 600, fit: 'inside', withoutEnlargement: true })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const { width, height } = info;

    // Cria máscara invertida: fundo branco (>200) vira transparente (0), resto vira opaco (255)
    const alphaData = Buffer.alloc(width * height);
    for (let i = 0; i < rawData.length; i++) {
      alphaData[i] = rawData[i] > 200 ? 0 : 255;
    }

    // Obtém os pixels RGB da imagem redimensionada
    const { data: rgbData } = await sharp(productImagePath)
      .resize({ width, height, fit: 'fill' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    // Monta buffer RGBA combinando RGB + alpha mask
    const rgbaData = Buffer.alloc(width * height * 4);
    for (let i = 0; i < width * height; i++) {
      rgbaData[i * 4 + 0] = rgbData[i * 3 + 0]; // R
      rgbaData[i * 4 + 1] = rgbData[i * 3 + 1]; // G
      rgbaData[i * 4 + 2] = rgbData[i * 3 + 2]; // B
      rgbaData[i * 4 + 3] = alphaData[i];        // A
    }

    const buffer = await sharp(rgbaData, {
      raw: { width, height, channels: 4 },
    })
      .png()
      .toBuffer();

    console.log('✅ Remoção de fundo concluída');
    return buffer;
  } catch (error) {
    console.error('❌ Erro na remoção de fundo, usando fallback:', error.message);

    // Fallback: redimensiona e adiciona alpha sem modificações
    try {
      const buffer = await sharp(productImagePath)
        .resize({ width: 600, height: 600, fit: 'inside', withoutEnlargement: true })
        .ensureAlpha()
        .png()
        .toBuffer();
      console.log('⚠️  Fallback aplicado: imagem original redimensionada com alpha');
      return buffer;
    } catch (fallbackError) {
      console.error('❌ Erro no fallback de remoção de fundo:', fallbackError.message);
      throw fallbackError;
    }
  }
}

// ---------------------------------------------------------------------------
// Função: addTextOverlay
// ---------------------------------------------------------------------------

/**
 * Cria um overlay de texto/logo transparente usando Canvas.
 *
 * @param {Object} opts
 * @param {number}      opts.width          - Largura do canvas (px).
 * @param {number}      opts.height         - Altura do canvas (px).
 * @param {string}      opts.productName    - Nome do produto.
 * @param {string}      opts.price          - Preço (ex: "R$ 49,90").
 * @param {string}      opts.primaryColor   - Cor primária do cliente (hex).
 * @param {string}      opts.secondaryColor - Cor secundária do cliente (hex).
 * @param {string}      opts.fontStyle      - Estilo de fonte (ex: "Montserrat").
 * @param {string|null} opts.logoPath       - Caminho do logo ou null.
 * @returns {Promise<Buffer>} Buffer PNG do overlay (fundo transparente).
 */
async function addTextOverlay({
  width,
  height,
  productName,
  price,
  primaryColor,
  secondaryColor,
  fontStyle,
  logoPath,
}) {
  console.log('✍️  Criando overlay de texto...');

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Canvas totalmente transparente
  ctx.clearRect(0, 0, width, height);

  const fontFamily = fontStyle || 'Arial';

  // --- Nome do produto (topo) ---
  ctx.save();
  ctx.font = `bold 52px ${fontFamily}, sans-serif`;
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  // Sombra para legibilidade
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;

  // Suporta nome longo quebrando em múltiplas linhas (max largura 900px)
  const maxTextWidth = width - 120;
  const lines = wrapText(ctx, productName || '', maxTextWidth);
  lines.forEach((line, index) => {
    ctx.fillText(line, width / 2, 60 + index * 64);
  });
  ctx.restore();

  // --- Badge de preço (rodapé) ---
  if (price) {
    const badgeWidth = 420;
    const badgeHeight = 90;
    const badgeX = (width - badgeWidth) / 2;
    const badgeY = height - 160;

    // Fundo semi-transparente com bordas arredondadas
    ctx.save();
    ctx.globalAlpha = 0.82;
    ctx.fillStyle = secondaryColor || '#0D1B2A';
    roundRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, 18);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Borda dourada
    ctx.strokeStyle = primaryColor || '#C9A84C';
    ctx.lineWidth = 3;
    roundRect(ctx, badgeX, badgeY, badgeWidth, badgeHeight, 18);
    ctx.stroke();

    // Texto do preço
    ctx.font = `bold 46px ${fontFamily}, sans-serif`;
    ctx.fillStyle = primaryColor || '#C9A84C';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 6;
    ctx.fillText(price, width / 2, badgeY + badgeHeight / 2);
    ctx.restore();
  }

  // --- Logo (canto superior direito) ---
  if (logoPath && fs.existsSync(logoPath)) {
    try {
      console.log('🖼️  Carregando logo:', logoPath);
      const logoImg = await loadImage(logoPath);
      const logoMaxSize = 140;
      const logoAspect = logoImg.width / logoImg.height;
      const logoW = logoAspect >= 1 ? logoMaxSize : logoMaxSize * logoAspect;
      const logoH = logoAspect >= 1 ? logoMaxSize / logoAspect : logoMaxSize;
      const logoX = width - logoW - 30;
      const logoY = 30;

      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.drawImage(logoImg, logoX, logoY, logoW, logoH);
      ctx.restore();
      console.log('✅ Logo adicionado ao overlay');
    } catch (logoError) {
      console.warn('⚠️  Não foi possível carregar o logo:', logoError.message);
    }
  }

  const buffer = canvas.toBuffer('image/png');
  console.log('✅ Overlay de texto criado');
  return buffer;
}

// ---------------------------------------------------------------------------
// Função: composeArt
// ---------------------------------------------------------------------------

/**
 * Composição final da arte: fundo DALL-E + produto centralizado + overlay de texto.
 *
 * @param {string} backgroundPath      - Caminho da imagem de fundo gerada pelo DALL-E.
 * @param {string} productImagePath    - Caminho da foto original do produto.
 * @param {Object} options
 * @param {string}      options.productName           - Nome do produto.
 * @param {string}      options.price                 - Preço (ex: "R$ 49,90").
 * @param {Object}      options.clientData            - Dados do cliente.
 * @param {string}      options.clientData.primary_color
 * @param {string}      options.clientData.secondary_color
 * @param {string}      options.clientData.font_style
 * @param {string}      options.clientData.brand_tone
 * @param {string|null} options.clientData.logo_path
 * @returns {Promise<string>} Caminho absoluto da arte final salva em outputs/arts/.
 */
async function composeArt(backgroundPath, productImagePath, options) {
  console.log('🎨 Iniciando composição da arte...');
  console.log('  📍 Fundo:', backgroundPath);
  console.log('  📍 Produto:', productImagePath);

  const { productName, price, clientData = {} } = options;
  const {
    primary_color: primaryColor = '#C9A84C',
    secondary_color: secondaryColor = '#0D1B2A',
    font_style: fontStyle = 'Arial',
    logo_path: logoPath = null,
  } = clientData;

  ensureDir(OUTPUTS_ARTS_DIR);

  // --- Passo 1: Carregar e redimensionar o fundo para 1080x1440 ---
  console.log('🔄 Redimensionando fundo para 1080x1440...');
  const bgBuffer = await sharp(backgroundPath)
    .resize({ width: ART_WIDTH, height: ART_HEIGHT, fit: 'cover' })
    .png()
    .toBuffer();

  // --- Passo 2: Processar o produto (remoção de fundo + resize) ---
  console.log('🔄 Processando imagem do produto...');
  const productBuffer = await removeBackground(productImagePath);

  // Redimensiona para caber no centro (máx 600x600, fit inside)
  const productResized = await sharp(productBuffer)
    .resize({ width: 600, height: 600, fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer();

  // Obtém dimensões reais do produto após resize para centralizar
  const productMeta = await sharp(productResized).metadata();
  const productLeft = Math.round((ART_WIDTH - productMeta.width) / 2);
  const productTop = Math.round((ART_HEIGHT - productMeta.height) / 2);
  console.log(`📐 Produto posicionado em: left=${productLeft}, top=${productTop}`);

  // --- Passo 3: Criar overlay de texto via Canvas ---
  console.log('🔄 Criando overlay de texto com Canvas...');
  const textOverlayBuffer = await addTextOverlay({
    width: ART_WIDTH,
    height: ART_HEIGHT,
    productName,
    price,
    primaryColor,
    secondaryColor,
    fontStyle,
    logoPath,
  });

  // --- Passo 4: Composição final com Sharp ---
  console.log('🔄 Compondo arte final...');
  const timestamp = Date.now();
  const filename = `art_${timestamp}_${uuidv4()}.png`;
  const outputPath = path.join(OUTPUTS_ARTS_DIR, filename);

  await sharp(bgBuffer)
    .composite([
      {
        input: productResized,
        left: productLeft,
        top: productTop,
      },
      {
        input: textOverlayBuffer,
        left: 0,
        top: 0,
      },
    ])
    .png()
    .toFile(outputPath);

  console.log('✅ Arte final salva em:', outputPath);
  return outputPath;
}

// ---------------------------------------------------------------------------
// Função: getDefaultMusicTrack
// ---------------------------------------------------------------------------

/**
 * Procura na pasta assets/music/ por arquivos .mp3 e retorna o caminho do primeiro encontrado.
 *
 * @returns {string|null} Caminho do arquivo .mp3 ou null se não houver nenhum.
 */
function getDefaultMusicTrack() {
  try {
    if (!fs.existsSync(ASSETS_MUSIC_DIR)) {
      console.log('ℹ️  Pasta assets/music/ não encontrada');
      return null;
    }

    const files = fs.readdirSync(ASSETS_MUSIC_DIR).filter((f) => f.toLowerCase().endsWith('.mp3'));

    if (files.length === 0) {
      console.log('ℹ️  Nenhuma trilha .mp3 encontrada em assets/music/');
      return null;
    }

    const track = path.join(ASSETS_MUSIC_DIR, files[0]);
    console.log('🎵 Trilha sonora encontrada:', track);
    return track;
  } catch (error) {
    console.warn('⚠️  Erro ao buscar trilha sonora:', error.message);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Função: createVideo
// ---------------------------------------------------------------------------

/**
 * Gera um vídeo MP4 de 15 segundos a partir de uma imagem de arte com efeito Ken Burns.
 *
 * @param {string} artImagePath - Caminho da arte final (PNG 1080x1440).
 * @param {Object} options
 * @param {'elegante'|'dinâmico'} options.style     - Estilo do vídeo.
 * @param {string|null}           options.musicTrack - Caminho do arquivo .mp3 ou null.
 * @param {string|null}           options.outputDir  - Diretório de saída personalizado ou null.
 * @returns {Promise<string>} Caminho absoluto do vídeo gerado.
 */
function createVideo(artImagePath, options = {}) {
  const { style = 'elegante', musicTrack = null, outputDir = null } = options;

  const videoOutputDir = outputDir || OUTPUTS_VIDEOS_DIR;
  ensureDir(videoOutputDir);

  const timestamp = Date.now();
  const filename = `video_${timestamp}_${uuidv4()}.mp4`;
  const outputPath = path.join(videoOutputDir, filename);

  console.log('🎬 Iniciando geração de vídeo...');
  console.log('  📍 Arte:', artImagePath);
  console.log('  🎨 Estilo:', style);

  // --- Parâmetros do Ken Burns por estilo ---
  let zoompanFilter;
  if (style === 'dinâmico') {
    // Zoom mais agressivo com pan lateral suave
    zoompanFilter =
      `zoompan=z='min(zoom+0.002,1.3)':` +
      `x='if(gte(zoom,1.15),iw/2-(iw/zoom/2)+sin(on/30)*50,iw/2-(iw/zoom/2))':` +
      `y='ih/2-(ih/zoom/2)':` +
      `d=${VIDEO_DURATION * VIDEO_FPS}:s=${ART_WIDTH}x${ART_HEIGHT}:fps=${VIDEO_FPS}`;
    console.log('⚡ Estilo dinâmico: zoom rápido 1.0→1.3 com pan lateral');
  } else {
    // Elegante: zoom lento e suave
    zoompanFilter =
      `zoompan=z='min(zoom+0.001,1.15)':` +
      `x='iw/2-(iw/zoom/2)':` +
      `y='ih/2-(ih/zoom/2)':` +
      `d=${VIDEO_DURATION * VIDEO_FPS}:s=${ART_WIDTH}x${ART_HEIGHT}:fps=${VIDEO_FPS}`;
    console.log('✨ Estilo elegante: zoom suave 1.0→1.15');
  }

  // --- Trilha sonora ---
  const audioTrack = musicTrack || getDefaultMusicTrack();
  if (audioTrack) {
    console.log('🎵 Trilha sonora:', audioTrack);
  } else {
    console.log('🔇 Sem trilha sonora — gerando vídeo mudo');
  }

  return new Promise((resolve, reject) => {
    const command = ffmpeg()
      // Input: imagem estática em loop
      .input(artImagePath)
      .inputOptions(['-loop 1'])
      // Filtro de vídeo: efeito Ken Burns
      .videoFilters(zoompanFilter)
      // Codec de vídeo
      .videoCodec('libx264')
      .outputOptions([
        '-preset medium',
        '-crf 23',
        `-t ${VIDEO_DURATION}`,
        '-pix_fmt yuv420p',
      ]);

    // Adiciona trilha de áudio se disponível
    if (audioTrack) {
      command
        .input(audioTrack)
        .audioCodec('aac')
        .outputOptions(['-shortest']);
    }

    command
      .output(outputPath)
      .on('start', (cmd) => {
        console.log('▶️  FFmpeg iniciado:', cmd);
      })
      .on('progress', (progress) => {
        if (progress.percent) {
          console.log(`⏳ Progresso: ${Math.round(progress.percent)}%`);
        }
      })
      .on('end', () => {
        console.log('✅ Vídeo gerado com sucesso:', outputPath);
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('❌ Erro no FFmpeg:', err.message);
        reject(err);
      })
      .run();
  });
}

// ---------------------------------------------------------------------------
// Utilitários de Canvas
// ---------------------------------------------------------------------------

/**
 * Quebra um texto longo em linhas que cabem dentro de maxWidth.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} maxWidth
 * @returns {string[]}
 */
function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [''];
}

/**
 * Desenha um retângulo com bordas arredondadas no contexto Canvas.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 * @param {number} radius
 */
function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  removeBackground,
  composeArt,
  addTextOverlay,
  createVideo,
};
