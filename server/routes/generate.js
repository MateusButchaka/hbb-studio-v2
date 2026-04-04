const express = require('express');
const path = require('path');
const fs = require('fs');
const db = require('../db/setup');
const { analyzeProduct, generateBackground } = require('../services/ai_service');
const { removeBackground, composeArt, composeCleanLookbook, createVideo } = require('../services/media_engine');
const { uploadProduct } = require('../middleware/upload');

const router = express.Router();

// POST /api/generate-art — Pipeline principal de geração de arte
router.post('/generate-art', uploadProduct.single('product_image'), async (req, res) => {
  let artId = null;

  try {
    const { client_id, product_name, price, generate_video = 'false', video_style = 'elegante' } = req.body;

    // 1. Validar campos obrigatórios
    if (!client_id || !product_name || !req.file) {
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatórios: client_id, product_name e product_image (arquivo)'
      });
    }

    // 2. Buscar dados do cliente
    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(client_id);
    if (!client) {
      return res.status(404).json({ success: false, error: 'Cliente não encontrado' });
    }

    // 3. Verificar limite de artes
    const artCount = db.prepare("SELECT COUNT(*) as count FROM arts WHERE client_id = ?").get(client_id).count;
    if (artCount >= client.arts_limit) {
      return res.status(403).json({
        success: false,
        error: `Limite de artes atingido (${client.arts_limit}). Atualize seu plano para continuar.`
      });
    }

    const uploadedFilePath = req.file.path;

    // 4. Inserir registro inicial com status 'processing'
    const insertResult = db.prepare(
      `INSERT INTO arts (client_id, product_name, price, status) VALUES (?, ?, ?, 'processing')`
    ).run(client_id, product_name, price || null);
    artId = insertResult.lastInsertRowid;

    console.log(`🎨 Iniciando pipeline para arte ID ${artId} — produto: ${product_name}`);

    // 5. Analisar produto com GPT-4o Vision
    const analysis = await analyzeProduct(uploadedFilePath);

    // 6. Gerar cenário de fundo com DALL-E 3
    const backgroundResult = await generateBackground(client, analysis);

    // 7. Compor arte final (fundo + produto + textos)
    const processedProductPath = await removeBackground(uploadedFilePath);
    const artFinalPath = await composeArt(backgroundResult.localPath, processedProductPath, {
      productName: product_name,
      price,
      clientData: client
    });

    // Gerar image_url relativa para servir como estático
    const imageUrl = '/' + path.relative(path.join(__dirname, '..', '..'), artFinalPath).replace(/\\/g, '/');

    // 8. Atualizar registro na tabela arts
    db.prepare(
      `UPDATE arts SET final_path=?, image_url=?, status='completed' WHERE id=?`
    ).run(artFinalPath, imageUrl, artId);

    const artRecord = db.prepare('SELECT * FROM arts WHERE id = ?').get(artId);

    let videoRecord = null;

    // 9. Gerar vídeo se solicitado
    if (generate_video === 'true') {
      console.log('🎬 Iniciando geração de vídeo...');
      const videoPath = await createVideo(artFinalPath, { style: video_style });

      const videoInsert = db.prepare(
        `INSERT INTO videos (client_id, product_name, video_path, style) VALUES (?, ?, ?, ?)`
      ).run(client_id, product_name, videoPath, video_style);

      videoRecord = db.prepare('SELECT * FROM videos WHERE id = ?').get(videoInsert.lastInsertRowid);
      console.log('✅ Vídeo criado e salvo no banco, ID:', videoRecord.id);
    }

    console.log(`✅ Arte ID ${artId} gerada com sucesso!`);

    res.json({
      success: true,
      data: {
        art: artRecord,
        video: videoRecord,
        analysis
      },
      message: 'Arte gerada com sucesso!'
    });
  } catch (error) {
    console.error('❌ Erro no pipeline de geração:', error.message);

    // Atualizar status para 'failed' se o registro já foi criado
    if (artId) {
      try {
        db.prepare("UPDATE arts SET status='failed' WHERE id=?").run(artId);
      } catch (dbError) {
        console.error('❌ Erro ao atualizar status de falha:', dbError.message);
      }
    }

    res.status(500).json({ success: false, error: error.message || 'Erro ao gerar arte' });
  }
});

// GET /api/arts — Listar todas as artes geradas
router.get('/arts', (req, res) => {
  try {
    const { client_id, status } = req.query;

    let query = `SELECT arts.*, clients.name as client_name
                 FROM arts
                 LEFT JOIN clients ON arts.client_id = clients.id`;

    const params = [];
    const conditions = [];

    if (client_id) {
      conditions.push('arts.client_id = ?');
      params.push(client_id);
    }
    if (status) {
      conditions.push('arts.status = ?');
      params.push(status);
    }
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY arts.created_at DESC';

    const arts = db.prepare(query).all(...params);
    res.json({ success: true, data: arts });
  } catch (error) {
    console.error('❌ Erro ao listar artes:', error.message);
    res.status(500).json({ success: false, error: 'Erro ao listar artes' });
  }
});

// GET /api/arts/:id — Buscar arte por ID
router.get('/arts/:id', (req, res) => {
  try {
    const art = db.prepare(
      `SELECT arts.*, clients.name as client_name
       FROM arts
       LEFT JOIN clients ON arts.client_id = clients.id
       WHERE arts.id = ?`
    ).get(req.params.id);

    if (!art) {
      return res.status(404).json({ success: false, error: 'Arte não encontrada' });
    }

    res.json({ success: true, data: art });
  } catch (error) {
    console.error('❌ Erro ao buscar arte:', error.message);
    res.status(500).json({ success: false, error: 'Erro ao buscar arte' });
  }
});

// DELETE /api/arts/:id — Remover arte
router.delete('/arts/:id', (req, res) => {
  try {
    const art = db.prepare('SELECT * FROM arts WHERE id = ?').get(req.params.id);
    if (!art) {
      return res.status(404).json({ success: false, error: 'Arte não encontrada' });
    }

    // Deletar arquivo físico se existir
    if (art.final_path && fs.existsSync(art.final_path)) {
      fs.unlinkSync(art.final_path);
      console.log('🗑️  Arquivo físico removido:', art.final_path);
    }

    db.prepare('DELETE FROM arts WHERE id = ?').run(req.params.id);
    console.log('🗑️  Arte removida do banco, ID:', req.params.id);
    res.json({ success: true, message: 'Arte removida com sucesso' });
  } catch (error) {
    console.error('❌ Erro ao remover arte:', error.message);
    res.status(500).json({ success: false, error: 'Erro ao remover arte' });
  }
});

// GET /api/videos — Listar todos os vídeos
router.get('/videos', (req, res) => {
  try {
    const { client_id } = req.query;

    let query = `SELECT videos.*, clients.name as client_name
                 FROM videos
                 LEFT JOIN clients ON videos.client_id = clients.id`;

    const params = [];
    if (client_id) {
      query += ' WHERE videos.client_id = ?';
      params.push(client_id);
    }
    query += ' ORDER BY videos.created_at DESC';

    const videos = db.prepare(query).all(...params);
    res.json({ success: true, data: videos });
  } catch (error) {
    console.error('❌ Erro ao listar vídeos:', error.message);
    res.status(500).json({ success: false, error: 'Erro ao listar vídeos' });
  }
});

// GET /api/dashboard — Dados do dashboard
router.get('/dashboard', (req, res) => {
  try {
    const totalClients = db.prepare("SELECT COUNT(*) as count FROM clients").get().count;
    const totalArts = db.prepare("SELECT COUNT(*) as count FROM arts WHERE status='completed'").get().count;
    const totalVideos = db.prepare("SELECT COUNT(*) as count FROM videos").get().count;
    const artsThisMonth = db.prepare(
      "SELECT COUNT(*) as count FROM arts WHERE created_at >= date('now', 'start of month')"
    ).get().count;

    res.json({
      success: true,
      data: {
        total_clients: totalClients,
        total_arts: totalArts,
        total_videos: totalVideos,
        revenue: totalClients * 200,
        arts_this_month: artsThisMonth
      }
    });
  } catch (error) {
    console.error('❌ Erro ao buscar dados do dashboard:', error.message);
    res.status(500).json({ success: false, error: 'Erro ao buscar dados do dashboard' });
  }
});

// POST /api/generate-lookbook — Pipeline Clean Lookbook (TikTok Content Factory)
router.post('/generate-lookbook', uploadProduct.single('product_image'), async (req, res) => {
  let artId = null;

  try {
    const {
      client_id,
      product_name,
      price,
      hook_text,
      generate_video = 'false',
      video_style = 'elegante',
    } = req.body;

    // 1. Validar campos obrigatórios
    if (!product_name || !req.file) {
      return res.status(400).json({
        success: false,
        error: 'Campos obrigatórios: product_name e product_image (arquivo)',
      });
    }

    // 2. Resolver client_id: usar o fornecido ou o primeiro cliente disponível
    let resolvedClientId = client_id ? parseInt(client_id, 10) : null;
    if (!resolvedClientId) {
      const firstClient = db.prepare('SELECT id FROM clients ORDER BY id ASC LIMIT 1').get();
      if (!firstClient) {
        return res.status(400).json({ success: false, error: 'Nenhum cliente encontrado. Cadastre um cliente primeiro.' });
      }
      resolvedClientId = firstClient.id;
    }

    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(resolvedClientId);
    if (!client) {
      return res.status(404).json({ success: false, error: 'Cliente não encontrado' });
    }

    const uploadedFilePath = req.file.path;

    // 3. Inserir registro inicial com status 'processing'
    const insertResult = db.prepare(
      `INSERT INTO arts (client_id, product_name, price, status) VALUES (?, ?, ?, 'processing')`
    ).run(resolvedClientId, product_name, price || null);
    artId = insertResult.lastInsertRowid;

    console.log(`🎨 Iniciando pipeline lookbook para arte ID ${artId} — produto: ${product_name}`);

    // 4. Remover fundo do produto
    const processedProductPath = await removeBackground(uploadedFilePath);

    // 5. Compor arte Clean Lookbook (sem IA de fundo)
    const artFinalPath = await composeCleanLookbook(processedProductPath, {
      price,
      productName: product_name,
      hookText: hook_text || undefined,
    });

    const imageUrl = '/' + path.relative(path.join(__dirname, '..', '..'), artFinalPath).replace(/\\/g, '/');

    // 6. Atualizar registro na tabela arts
    db.prepare(
      `UPDATE arts SET final_path=?, image_url=?, status='completed' WHERE id=?`
    ).run(artFinalPath, imageUrl, artId);

    const artRecord = db.prepare('SELECT * FROM arts WHERE id = ?').get(artId);

    let videoRecord = null;

    // 7. Gerar vídeo se solicitado
    if (generate_video === 'true') {
      console.log('🎬 Iniciando geração de vídeo lookbook...');
      const videoPath = await createVideo(artFinalPath, { style: video_style });

      const videoInsert = db.prepare(
        `INSERT INTO videos (client_id, product_name, video_path, style) VALUES (?, ?, ?, ?)`
      ).run(resolvedClientId, product_name, videoPath, video_style);

      videoRecord = db.prepare('SELECT * FROM videos WHERE id = ?').get(videoInsert.lastInsertRowid);
      console.log('✅ Vídeo lookbook criado e salvo no banco, ID:', videoRecord.id);
    }

    console.log(`✅ Arte Lookbook ID ${artId} gerada com sucesso!`);

    res.json({
      success: true,
      data: {
        art: artRecord,
        video: videoRecord,
      },
      message: 'Arte lookbook gerada com sucesso!',
    });
  } catch (error) {
    console.error('❌ Erro no pipeline lookbook:', error.message);

    if (artId) {
      try {
        db.prepare("UPDATE arts SET status='failed' WHERE id=?").run(artId);
      } catch (dbError) {
        console.error('❌ Erro ao atualizar status de falha:', dbError.message);
      }
    }

    res.status(500).json({ success: false, error: error.message || 'Erro ao gerar arte lookbook' });
  }
});

module.exports = router;
