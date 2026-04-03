const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname);
const dbPath = path.join(dbDir, 'hbb-studio.db');

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create clients table
db.exec(`
  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    segment TEXT,
    primary_color TEXT DEFAULT '#C9A84C',
    secondary_color TEXT DEFAULT '#0D1B2A',
    font_style TEXT DEFAULT 'Montserrat',
    brand_tone TEXT DEFAULT 'luxo',
    arts_limit INTEGER DEFAULT 15,
    logo_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);
console.log('✅ Tabela clients criada/verificada com sucesso.');

// Create arts table
db.exec(`
  CREATE TABLE IF NOT EXISTS arts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    price TEXT,
    image_url TEXT,
    final_path TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
  );
`);
console.log('✅ Tabela arts criada/verificada com sucesso.');

// Create videos table
db.exec(`
  CREATE TABLE IF NOT EXISTS videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    product_name TEXT NOT NULL,
    video_path TEXT,
    style TEXT DEFAULT 'elegante',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
  );
`);
console.log('✅ Tabela videos criada/verificada com sucesso.');

console.log('🗄️  Banco de dados inicializado em:', dbPath);

// Close connection when run as a standalone setup script
if (require.main === module) {
  db.close();
  console.log('🔒 Conexão com o banco de dados encerrada.');
} else {
  module.exports = db;
}
