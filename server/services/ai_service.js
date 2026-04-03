const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

if (!process.env.OPENAI_API_KEY) {
  console.warn('⚠️  OPENAI_API_KEY não está definida. As funções de IA não funcionarão corretamente.');
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Analyzes a product image using GPT-4o Vision and returns structured JSON.
 * @param {string} imagePath - Local path to the product image file.
 * @returns {Promise<Object>} Analysis result with mood, dominant_colors, suggested_background,
 *                            product_category, and key_benefits.
 */
async function analyzeProduct(imagePath) {
  console.log('🔍 Iniciando análise do produto:', imagePath);

  try {
    // Sanitize: reject paths containing traversal sequences
    if (typeof imagePath !== 'string' || imagePath.includes('..') || imagePath.includes('\0')) {
      throw new Error('Caminho de imagem inválido.');
    }

    // Validate that imagePath resolves within the project's uploads/outputs directories
    const projectRoot = path.resolve(__dirname, '..', '..');
    const allowedDirs = [
      path.join(projectRoot, 'uploads'),
      path.join(projectRoot, 'outputs'),
    ];
    const resolvedPath = path.resolve(imagePath);
    const matchedDir = allowedDirs.find(dir => resolvedPath.startsWith(dir + path.sep) || resolvedPath === dir);
    if (!matchedDir) {
      throw new Error('Caminho de imagem fora do diretório permitido.');
    }

    // Reconstruct the path using only the trusted base and the validated relative segment
    const relativePart = resolvedPath.slice(matchedDir.length);
    const safePath = path.join(matchedDir, relativePart);

    const imageData = fs.readFileSync(safePath);
    const base64Image = imageData.toString('base64');
    const extension = path.extname(safePath).slice(1).toLowerCase();
    const mimeType = extension === 'jpg' ? 'image/jpeg' : `image/${extension}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analise esta foto de produto e retorne um JSON com exatamente estas chaves:
- "mood": string — tom/clima do produto (ex: "saúde", "tecnologia", "beleza", "luxo", "esporte")
- "dominant_colors": array de strings — cores predominantes no produto em hex (ex: ["#FF5733", "#FFFFFF"])
- "suggested_background": string — descrição detalhada de um cenário ideal para o fundo desta foto de produto
- "product_category": string — categoria do produto
- "key_benefits": array de até 3 strings — benefícios-chave visuais percebidos no produto

Responda APENAS com o JSON, sem texto adicional.`,
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
                detail: 'high',
              },
            },
          ],
        },
      ],
    });

    const result = JSON.parse(response.choices[0].message.content);
    console.log('✅ Análise do produto concluída:', JSON.stringify(result, null, 2));
    return result;
  } catch (error) {
    console.error('❌ Erro ao analisar produto:', error.message);
    return {
      mood: 'geral',
      dominant_colors: ['#FFFFFF', '#000000'],
      suggested_background: 'Fundo neutro e limpo com iluminação suave',
      product_category: 'produto',
      key_benefits: ['qualidade', 'design moderno', 'exclusividade'],
    };
  }
}

/**
 * Generates a background image using DALL-E 3 based on client identity and product analysis.
 * @param {Object} clientData - Client data from the database (name, segment, primary_color,
 *                              secondary_color, font_style, brand_tone).
 * @param {Object} analysis - Result from analyzeProduct().
 * @returns {Promise<Object>} Object with localPath and originalUrl of the generated background.
 */
async function generateBackground(clientData, analysis) {
  console.log('🎨 Iniciando geração de fundo para o cliente:', clientData.name);

  const { primary_color, secondary_color, brand_tone, segment } = clientData;
  const { mood, suggested_background, dominant_colors } = analysis;

  const prompt = `Crie um cenário fotográfico profissional para composição de arte de Instagram no formato vertical (1080x1440px).

Identidade visual da marca:
- Tom da marca: ${brand_tone}
- Segmento: ${segment || 'geral'}
- Cor primária: ${primary_color}
- Cor secundária: ${secondary_color}

Análise do produto:
- Clima/mood: ${mood}
- Cenário sugerido: ${suggested_background}
- Cores do produto: ${(dominant_colors || []).join(', ')}

Instruções obrigatórias:
- Gere APENAS o cenário de fundo, SEM texto e SEM produtos no cenário
- O fundo deve complementar as cores ${primary_color} e ${secondary_color} da marca
- Estilo visual: ${brand_tone} — aplique esse tom em toda a composição do cenário
- Iluminação e atmosfera devem refletir o mood "${mood}" do produto
- O cenário deve ter área central neutra para posicionamento do produto
- Formato vertical 1024x1792px, alta qualidade fotográfica, composição profissional`;

  try {
    const imageResponse = await openai.images.generate({
      model: 'dall-e-3',
      prompt,
      size: '1024x1792',
      quality: 'hd',
      n: 1,
    });

    const imageUrl = imageResponse.data[0].url;
    console.log('✅ Imagem gerada pelo DALL-E 3:', imageUrl);

    const timestamp = Date.now();
    const filename = `bg_${timestamp}_${uuidv4()}.png`;
    const outputDir = path.join(__dirname, '..', '..', 'outputs', 'backgrounds');
    const outputPath = path.join(outputDir, filename);

    await downloadImage(imageUrl, outputPath);
    console.log('💾 Fundo salvo em:', outputPath);

    return {
      localPath: outputPath,
      originalUrl: imageUrl,
    };
  } catch (error) {
    console.error('❌ Erro ao gerar fundo:', error.message);
    throw error;
  }
}

/**
 * Downloads an image from a URL and saves it to the specified output path.
 * Creates the destination directory if it does not exist.
 * This is an internal helper used by generateBackground.
 * @param {string} url - URL of the image to download.
 * @param {string} outputPath - Local file path where the image will be saved.
 * @returns {Promise<string>} The outputPath of the saved file.
 */
async function downloadImage(url, outputPath) {
  const dir = path.dirname(outputPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  console.log('⬇️  Baixando imagem de:', url);

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Falha ao baixar imagem: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(outputPath, buffer);
  } catch (error) {
    console.error('❌ Erro ao baixar imagem:', error.message);
    throw error;
  }

  return outputPath;
}

module.exports = {
  analyzeProduct,
  generateBackground,
};
