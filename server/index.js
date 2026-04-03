require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

const clientsRouter = require('./routes/clients');
const generateRouter = require('./routes/generate');

const app = express();
const PORT = process.env.PORT || 3001;

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Muitas requisições. Tente novamente em 15 minutos.' }
});

const generateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Limite de geração atingido. Tente novamente em 1 hora.' }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static folders
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
app.use('/outputs', express.static(path.join(__dirname, '..', 'outputs')));

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'HBB Studio v2 API is running' });
});

// Routes
app.use('/api', apiLimiter, clientsRouter);
app.use('/api/generate-art', generateLimiter);
app.use('/api', generateRouter);

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Erro não tratado:', err.message);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Erro interno do servidor'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 HBB Studio v2 Server rodando na porta ${PORT}`);
  console.log(`📡 API disponível em: http://localhost:${PORT}/api`);
});
