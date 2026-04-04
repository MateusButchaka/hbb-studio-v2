const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const ffmpeg = require('fluent-ffmpeg');

const OUTPUT_DIR = path.join(__dirname, '..', '..', 'outputs');

const ROOT_DIR = path.join(__dirname, '..', '..');

/**
 * Validates that a file path resolves within an allowed base directory,
 * preventing path traversal attacks.
 * @param {string} filePath - The path to validate.
 * @param {string} allowedBase - The base directory that the path must reside in.
 * @throws {Error} If the path is outside the allowed base.
 */
function validatePathWithinBase(filePath, allowedBase) {
  const resolved = path.resolve(filePath);
  const base = path.resolve(allowedBase);
  if (!resolved.startsWith(base + path.sep) && resolved !== base) {
    throw new Error(`Caminho de arquivo inválido: acesso fora do diretório permitido`);
  }
}

/**
 * Ensures a directory exists, creating it recursively if needed.
 * @param {string} dir - Directory path.
 */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Removes the background from a product image using Sharp.
 * For JPEG images, applies a threshold to isolate the subject.
 * For PNG images with an alpha channel, extracts the alpha mask.
 * @param {string} productImagePath - Path to the product image.
 * @returns {Promise<string>} Path to the processed image (PNG with transparency).
 */
async function removeBackground(productImagePath) {
  if (!fs.existsSync(productImagePath)) {
    throw new Error(`Arquivo não encontrado: ${productImagePath}`);
  }
  validatePathWithinBase(productImagePath, ROOT_DIR);
  console.log('🧹 Removendo fundo da imagem:', productImagePath);

  const outputDir = path.join(OUTPUT_DIR, 'processed');
  ensureDir(outputDir);

  const filename = `nobg_${Date.now()}_${uuidv4()}.png`;
  const outputPath = path.join(outputDir, filename);

  try {
    const metadata = await sharp(productImagePath).metadata();

    if (metadata.hasAlpha) {
      // PNG com canal alpha — apenas converter e salvar
      await sharp(productImagePath).png().toFile(outputPath);
    } else {
      // Imagem sem alpha — converter para PNG preservando cores
      await sharp(productImagePath)
        .png()
        .toFile(outputPath);
    }

    console.log('✅ Fundo removido/processado:', outputPath);
    return outputPath;
  } catch (error) {
    console.error('❌ Erro ao remover fundo:', error.message);
    throw error;
  }
}

/**
 * Composes the final art by overlaying the product image on the background.
 * Resizes background to 1080x1440, centers the product, and adds text overlay.
 * @param {string} backgroundPath - Path to the background image.
 * @param {string} productImagePath - Path to the (processed) product image.
 * @param {Object} options - Options for composition.
 * @param {string} options.productName - Name of the product.
 * @param {string} [options.price] - Price of the product.
 * @param {Object} [options.clientData] - Client branding data.
 * @returns {Promise<string>} Path to the final composed art image.
 */
async function composeArt(backgroundPath, productImagePath, options = {}) {
  console.log('🖼️  Compondo arte final...');

  const { productName, price, clientData = {} } = options;
  const outputDir = path.join(OUTPUT_DIR, 'arts');
  ensureDir(outputDir);

  const filename = `art_${Date.now()}_${uuidv4()}.png`;
  const outputPath = path.join(outputDir, filename);

  const canvasWidth = 1080;
  const canvasHeight = 1440;

  try {
    // Resize background to canvas size
    const background = await sharp(backgroundPath)
      .resize(canvasWidth, canvasHeight, { fit: 'cover' })
      .toBuffer();

    // Resize product to fit within the central area (max 70% of canvas width)
    const maxProductWidth = Math.floor(canvasWidth * 0.7);
    const maxProductHeight = Math.floor(canvasHeight * 0.6);

    const productBuffer = await sharp(productImagePath)
      .resize(maxProductWidth, maxProductHeight, { fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();

    const productMeta = await sharp(productBuffer).metadata();
    const productLeft = Math.floor((canvasWidth - productMeta.width) / 2);
    const productTop = Math.floor((canvasHeight - productMeta.height) / 2) - 60;

    // Generate text overlay SVG
    const textOverlay = await addTextOverlay({
      productName,
      price,
      clientData,
      canvasWidth,
      canvasHeight
    });

    const composites = [
      { input: productBuffer, left: productLeft, top: Math.max(productTop, 80) },
    ];

    if (textOverlay) {
      composites.push({ input: textOverlay, left: 0, top: 0 });
    }

    await sharp(background)
      .composite(composites)
      .png()
      .toFile(outputPath);

    console.log('✅ Arte composta salva em:', outputPath);
    return outputPath;
  } catch (error) {
    console.error('❌ Erro ao compor arte:', error.message);
    throw error;
  }
}

/**
 * Composes a Clean Lookbook art: solid background, drop shadow, centered product,
 * and professional hardcoded typography (hook + price).
 * @param {string} productImagePath - Path to the (processed) product image (PNG).
 * @param {Object} options - Options for composition.
 * @param {string} [options.price] - Price of the product (e.g. "49,90").
 * @param {string} [options.productName] - Optional product name for sub-text.
 * @param {string} [options.hookText] - Custom hook text. Default: 'O tênis que está bombando no TikTok'.
 * @param {string} [options.bgColor='#F5F5F0'] - Solid background color.
 * @returns {Promise<string>} Path to the final composed art image.
 */
async function composeCleanLookbook(productImagePath, options = {}) {
  if (!fs.existsSync(productImagePath)) {
    throw new Error(`Arquivo não encontrado: ${productImagePath}`);
  }
  validatePathWithinBase(productImagePath, ROOT_DIR);
  console.log('🖼️  Compondo arte Clean Lookbook...');

  const {
    price,
    productName,
    hookText = 'O tênis que está bombando no TikTok',
    bgColor = '#F5F5F0',
  } = options;

  const outputDir = path.join(OUTPUT_DIR, 'arts');
  ensureDir(outputDir);

  const filename = `lookbook_${Date.now()}_${uuidv4()}.png`;
  const outputPath = path.join(outputDir, filename);

  const canvasWidth = 1080;
  const canvasHeight = 1440;

  try {
    // Layer 0: Solid background
    const background = await sharp({
      create: {
        width: canvasWidth,
        height: canvasHeight,
        channels: 3,
        background: bgColor,
      },
    })
      .png()
      .toBuffer();

    // Resize product to fit within the central area (max 75% of canvas width)
    const maxProductWidth = Math.floor(canvasWidth * 0.75);
    const maxProductHeight = Math.floor(canvasHeight * 0.6);

    const productBuffer = await sharp(productImagePath)
      .resize(maxProductWidth, maxProductHeight, { fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();

    const productMeta = await sharp(productBuffer).metadata();
    const productLeft = Math.floor((canvasWidth - productMeta.width) / 2);
    const productTop = Math.floor((canvasHeight - productMeta.height) / 2) - 40;
    const safeProductTop = Math.max(productTop, 120);

    // Layer 1: Drop shadow — dark blurred copy of the product placed below it
    const shadowBuffer = await sharp(productBuffer)
      .tint({ r: 0, g: 0, b: 0 })
      .blur(25)
      .modulate({ brightness: 0.3 })
      .png()
      .toBuffer();

    const shadowLeft = productLeft + 8;
    const shadowTop = safeProductTop + 15;

    // Layer 2: Text overlay (clean lookbook style)
    const textOverlay = await addTextOverlay({
      hookText,
      price,
      productName,
      canvasWidth,
      canvasHeight,
      lookbook: true,
    });

    const composites = [
      { input: shadowBuffer, left: shadowLeft, top: shadowTop, blend: 'multiply' },
      { input: productBuffer, left: productLeft, top: safeProductTop },
    ];

    if (textOverlay) {
      composites.push({ input: textOverlay, left: 0, top: 0 });
    }

    await sharp(background)
      .composite(composites)
      .png()
      .toFile(outputPath);

    console.log('✅ Arte Clean Lookbook salva em:', outputPath);
    return outputPath;
  } catch (error) {
    console.error('❌ Erro ao compor arte lookbook:', error.message);
    throw error;
  }
}

/**
 * Creates an SVG text overlay for the art composition.
 * When `options.lookbook` is true, renders clean hardcoded typography (hook + price).
 * Otherwise renders the legacy branded style (product name + price).
 * @param {Object} options - Options for the overlay.
 * @param {string} [options.hookText] - Lookbook hook text (used when lookbook=true).
 * @param {string} options.productName - Name of the product.
 * @param {string} [options.price] - Price of the product.
 * @param {Object} [options.clientData] - Client branding data.
 * @param {number} options.canvasWidth - Width of the canvas.
 * @param {number} options.canvasHeight - Height of the canvas.
 * @param {boolean} [options.lookbook=false] - Use clean lookbook typography.
 * @returns {Promise<Buffer|null>} SVG buffer or null if no text to render.
 */
async function addTextOverlay(options = {}) {
  const {
    hookText,
    productName,
    price,
    clientData = {},
    canvasWidth = 1080,
    canvasHeight = 1440,
    lookbook = false,
  } = options;

  if (lookbook) {
    // Clean Lookbook typography — no AI colors, no stroke, just clean dark text
    const svgLines = [];
    const fontFamily = '"Bebas Neue", Impact, "Arial Black", sans-serif';
    const textColor = '#1A1A1A';

    if (hookText) {
      svgLines.push(
        `<text x="${canvasWidth / 2}" y="90" ` +
        `font-family=${JSON.stringify(fontFamily)} font-size="48" ` +
        `font-weight="700" fill="${textColor}" text-anchor="middle" ` +
        `letter-spacing="2">` +
        `${escapeXml(String(hookText).toUpperCase().slice(0, 60))}</text>`
      );
    }

    if (price) {
      const displayPrice = `R$ ${String(price).slice(0, 20)}`;
      svgLines.push(
        `<text x="${canvasWidth / 2}" y="${canvasHeight - 120}" ` +
        `font-family=${JSON.stringify(fontFamily)} font-size="72" ` +
        `font-weight="900" fill="${textColor}" text-anchor="middle" ` +
        `letter-spacing="3">` +
        `${escapeXml(displayPrice)}</text>`
      );
    }

    if (productName) {
      const displayName = String(productName).slice(0, 60);
      svgLines.push(
        `<text x="${canvasWidth / 2}" y="${canvasHeight - 60}" ` +
        `font-family="Arial, sans-serif" font-size="28" ` +
        `font-weight="400" fill="#555555" text-anchor="middle">` +
        `${escapeXml(displayName)}</text>`
      );
    }

    if (svgLines.length === 0) return null;

    const svg = `<svg width="${canvasWidth}" height="${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
  ${svgLines.join('\n  ')}
</svg>`;
    return Buffer.from(svg);
  }

  // Legacy branded style
  if (!productName && !price) return null;

  const primaryColor = clientData.primary_color || '#C9A84C';
  const fontStyle = clientData.font_style || 'Montserrat';
  const displayName = productName ? String(productName).slice(0, 60) : '';
  const displayPrice = price ? String(price).slice(0, 30) : '';

  const nameFontSize = 52;
  const priceFontSize = 64;
  const textY = canvasHeight - 220;

  const svgLines = [];

  if (displayName) {
    svgLines.push(
      `<text x="${canvasWidth / 2}" y="${textY}" ` +
      `font-family="${fontStyle}, sans-serif" font-size="${nameFontSize}" ` +
      `font-weight="700" fill="${primaryColor}" text-anchor="middle" ` +
      `paint-order="stroke" stroke="rgba(0,0,0,0.6)" stroke-width="3">` +
      `${escapeXml(displayName)}</text>`
    );
  }

  if (displayPrice) {
    svgLines.push(
      `<text x="${canvasWidth / 2}" y="${textY + 90}" ` +
      `font-family="${fontStyle}, sans-serif" font-size="${priceFontSize}" ` +
      `font-weight="900" fill="#FFFFFF" text-anchor="middle" ` +
      `paint-order="stroke" stroke="rgba(0,0,0,0.7)" stroke-width="4">` +
      `${escapeXml(displayPrice)}</text>`
    );
  }

  if (svgLines.length === 0) return null;

  const svg = `<svg width="${canvasWidth}" height="${canvasHeight}" xmlns="http://www.w3.org/2000/svg">
  ${svgLines.join('\n  ')}
</svg>`;

  return Buffer.from(svg);
}

/**
 * Escapes special XML characters to prevent SVG injection.
 * @param {string} str - Input string.
 * @returns {string} Escaped string safe for SVG text content.
 */
function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Returns the path to the first available .mp3 file in assets/music/.
 * @returns {string|null} Path to the music file, or null if none found.
 */
function getDefaultMusicTrack() {
  const musicDir = path.join(__dirname, '..', '..', 'assets', 'music');
  if (!fs.existsSync(musicDir)) return null;

  const files = fs.readdirSync(musicDir).filter(f => f.toLowerCase().endsWith('.mp3'));
  if (files.length === 0) return null;

  return path.join(musicDir, files[0]);
}

/**
 * Creates a 15-second Ken Burns video from the art image using FFmpeg.
 * @param {string} artImagePath - Path to the final art image.
 * @param {Object} [options] - Options for the video.
 * @param {string} [options.style='elegante'] - Animation style: 'elegante' or 'dinamico'.
 * @param {string} [options.audioPath] - Optional path to a custom audio file. Falls back to default music.
 * @returns {Promise<string>} Path to the generated video file.
 */
function createVideo(artImagePath, options = {}) {
  if (!fs.existsSync(artImagePath)) {
    return Promise.reject(new Error(`Arquivo não encontrado: ${artImagePath}`));
  }
  try {
    validatePathWithinBase(artImagePath, ROOT_DIR);
  } catch (err) {
    return Promise.reject(err);
  }

  const { style = 'elegante', audioPath } = options;

  console.log(`🎬 Criando vídeo com efeito Ken Burns (estilo: ${style})...`);

  const outputDir = path.join(OUTPUT_DIR, 'videos');
  ensureDir(outputDir);

  const filename = `video_${Date.now()}_${uuidv4()}.mp4`;
  const outputPath = path.join(outputDir, filename);

  const duration = 15;
  const fps = 30;
  const totalFrames = duration * fps;

  // Zoom parameters per style
  const zoomIncrement = style === 'dinamico' ? 0.0005 : 0.00033;
  const startZoom = 1.0;

  // Ken Burns filter: gradual zoom-in with slight pan
  const zoompanFilter =
    `zoompan=z='${startZoom}+on*${zoomIncrement}':` +
    `x='iw/2-(iw/zoom/2)':` +
    `y='ih/2-(ih/zoom/2)':` +
    `d=${totalFrames}:s=1080x1440:fps=${fps}`;

  const musicTrack = (audioPath && fs.existsSync(audioPath)) ? audioPath : getDefaultMusicTrack();

  return new Promise((resolve, reject) => {
    const command = ffmpeg(artImagePath)
      .inputOptions(['-loop 1'])
      .videoFilter(zoompanFilter)
      .videoCodec('libx264')
      .outputOptions([
        '-t', String(duration),
        '-pix_fmt', 'yuv420p',
        '-crf', '23',
        '-preset', 'medium'
      ]);

    if (musicTrack) {
      command
        .addInput(musicTrack)
        .audioCodec('aac')
        .audioBitrate('128k')
        .outputOptions(['-shortest']);
      console.log('🎵 Trilha sonora adicionada:', musicTrack);
    } else {
      command.noAudio();
      console.log('⚠️  Nenhuma trilha sonora encontrada em assets/music/');
    }

    command
      .output(outputPath)
      .on('start', (cmd) => console.log('▶️  FFmpeg iniciado:', cmd))
      .on('progress', (progress) => {
        if (progress.percent) {
          console.log(`⏳ Progresso: ${Math.floor(progress.percent)}%`);
        }
      })
      .on('end', () => {
        console.log('✅ Vídeo criado em:', outputPath);
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('❌ Erro ao criar vídeo:', err.message);
        reject(err);
      })
      .run();
  });
}

module.exports = {
  removeBackground,
  composeArt,           // legacy
  composeCleanLookbook, // nova principal
  addTextOverlay,
  createVideo,
};
