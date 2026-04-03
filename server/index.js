require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static folders
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
app.use('/outputs', express.static(path.join(__dirname, '..', 'outputs')));

// Health check route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'HBB Studio v2 API is running' });
});

app.listen(PORT, () => {
  console.log(`🚀 HBB Studio v2 Server rodando na porta ${PORT}`);
  console.log(`📡 API disponível em: http://localhost:${PORT}/api`);
});
