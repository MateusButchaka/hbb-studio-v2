const express = require('express');
const path = require('path');
const db = require('../db/setup');
const { uploadLogo } = require('../middleware/upload');

const router = express.Router();

// GET /api/clients — Listar todos os clientes
router.get('/clients', (req, res) => {
  try {
    const clients = db.prepare('SELECT * FROM clients ORDER BY created_at DESC').all();
    res.json({ success: true, data: clients });
  } catch (error) {
    console.error('❌ Erro ao listar clientes:', error.message);
    res.status(500).json({ success: false, error: 'Erro ao listar clientes' });
  }
});

// GET /api/clients/:id — Buscar cliente por ID
router.get('/clients/:id', (req, res) => {
  try {
    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
    if (!client) {
      return res.status(404).json({ success: false, error: 'Cliente não encontrado' });
    }
    res.json({ success: true, data: client });
  } catch (error) {
    console.error('❌ Erro ao buscar cliente:', error.message);
    res.status(500).json({ success: false, error: 'Erro ao buscar cliente' });
  }
});

// POST /api/clients — Criar novo cliente
router.post('/clients', (req, res) => {
  try {
    const {
      name,
      segment,
      primary_color,
      secondary_color,
      font_style,
      brand_tone,
      arts_limit
    } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'O campo "name" é obrigatório' });
    }

    const stmt = db.prepare(
      `INSERT INTO clients (name, segment, primary_color, secondary_color, font_style, brand_tone, arts_limit)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const result = stmt.run(
      name,
      segment || null,
      primary_color || '#C9A84C',
      secondary_color || '#0D1B2A',
      font_style || 'Montserrat',
      brand_tone || 'luxo',
      arts_limit !== undefined ? Number(arts_limit) : 15
    );

    const newClient = db.prepare('SELECT * FROM clients WHERE id = ?').get(result.lastInsertRowid);
    console.log('✅ Cliente criado:', newClient.name);
    res.status(201).json({ success: true, data: newClient, message: 'Cliente criado com sucesso' });
  } catch (error) {
    console.error('❌ Erro ao criar cliente:', error.message);
    res.status(500).json({ success: false, error: 'Erro ao criar cliente' });
  }
});

// PUT /api/clients/:id — Atualizar cliente
router.put('/clients/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Cliente não encontrado' });
    }

    const {
      name = existing.name,
      segment = existing.segment,
      primary_color = existing.primary_color,
      secondary_color = existing.secondary_color,
      font_style = existing.font_style,
      brand_tone = existing.brand_tone,
      arts_limit = existing.arts_limit
    } = req.body;

    db.prepare(
      `UPDATE clients
       SET name=?, segment=?, primary_color=?, secondary_color=?, font_style=?, brand_tone=?, arts_limit=?, updated_at=CURRENT_TIMESTAMP
       WHERE id=?`
    ).run(name, segment, primary_color, secondary_color, font_style, brand_tone, Number(arts_limit), req.params.id);

    const updated = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
    console.log('✅ Cliente atualizado:', updated.name);
    res.json({ success: true, data: updated, message: 'Cliente atualizado com sucesso' });
  } catch (error) {
    console.error('❌ Erro ao atualizar cliente:', error.message);
    res.status(500).json({ success: false, error: 'Erro ao atualizar cliente' });
  }
});

// DELETE /api/clients/:id — Remover cliente
router.delete('/clients/:id', (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Cliente não encontrado' });
    }

    db.prepare('DELETE FROM clients WHERE id = ?').run(req.params.id);
    console.log('🗑️  Cliente removido:', existing.name);
    res.json({ success: true, message: 'Cliente removido com sucesso' });
  } catch (error) {
    console.error('❌ Erro ao remover cliente:', error.message);
    res.status(500).json({ success: false, error: 'Erro ao remover cliente' });
  }
});

// POST /api/clients/:id/logo — Upload de logo do cliente
router.post('/clients/:id/logo', uploadLogo.single('logo'), (req, res) => {
  try {
    const existing = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Cliente não encontrado' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Nenhum arquivo enviado' });
    }

    const logoPath = path.join('uploads', 'logos', req.file.filename);

    db.prepare(
      'UPDATE clients SET logo_path=?, updated_at=CURRENT_TIMESTAMP WHERE id=?'
    ).run(logoPath, req.params.id);

    console.log('🖼️  Logo atualizado para o cliente ID:', req.params.id);
    res.json({ success: true, data: { logo_path: logoPath }, message: 'Logo atualizado com sucesso' });
  } catch (error) {
    console.error('❌ Erro ao fazer upload do logo:', error.message);
    res.status(500).json({ success: false, error: 'Erro ao fazer upload do logo' });
  }
});

// GET /api/clients/:id/stats — Estatísticas do cliente
router.get('/clients/:id/stats', (req, res) => {
  try {
    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
    if (!client) {
      return res.status(404).json({ success: false, error: 'Cliente não encontrado' });
    }

    const totalArts = db.prepare("SELECT COUNT(*) as count FROM arts WHERE client_id = ?").get(req.params.id).count;
    const totalVideos = db.prepare("SELECT COUNT(*) as count FROM videos WHERE client_id = ?").get(req.params.id).count;

    res.json({
      success: true,
      data: {
        total_arts: totalArts,
        total_videos: totalVideos,
        arts_limit: client.arts_limit,
        arts_remaining: Math.max(0, client.arts_limit - totalArts)
      }
    });
  } catch (error) {
    console.error('❌ Erro ao buscar estatísticas:', error.message);
    res.status(500).json({ success: false, error: 'Erro ao buscar estatísticas' });
  }
});

module.exports = router;
