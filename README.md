# HBB Studio v2 — Plataforma de Automação de Marketing

Aplicação Full Stack local para gestão de clientes e geração automática de **artes para Instagram (1080×1440)** e **vídeos de 15s** usando IA e processamento de imagem/vídeo.

---

## 🎨 Design System — Dark Premium

| Token | Valor |
|---|---|
| Background | `#0D1B2A` |
| Secondary | `#112240` |
| Gold | `#C9A84C` |

---

## 🛠️ Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| Backend | Node.js + Express |
| Banco de Dados | SQLite via `better-sqlite3` |
| Frontend | React + Vite + Tailwind CSS |
| Processamento de Imagem | Sharp + Canvas |
| Processamento de Vídeo | FFmpeg (`fluent-ffmpeg`) |
| IA | OpenAI SDK (GPT-4o Vision + DALL-E 3) |
| Monorepo | `concurrently` |

---

## 🚀 Instalação e Execução

```bash
# 1. Instalar dependências da raiz
npm install

# 2. Instalar dependências do servidor
cd server && npm install

# 3. Instalar dependências do cliente
cd client && npm install

# 4. Configurar variáveis de ambiente
cp .env.example .env
# Edite o .env e adicione sua OPENAI_API_KEY

# 5. Inicializar o banco de dados SQLite
npm run setup

# 6. Rodar tudo (server + client simultâneos)
npm run dev
```

---

## 📁 Estrutura de Pastas

```
hbb-studio-v2/
├── client/                  # Frontend React/Vite/Tailwind
│   └── package.json
├── server/                  # Backend Node.js/Express
│   ├── db/
│   │   ├── setup.js         # Inicialização do SQLite
│   │   └── hbb-studio.db    # Banco de dados (gerado em runtime)
│   ├── index.js             # Entry point do servidor
│   └── package.json
├── uploads/                 # Imagens enviadas pelos usuários
├── outputs/                 # Artes e vídeos gerados pela IA
├── .env.example             # Template de variáveis de ambiente
├── .gitignore
└── package.json             # Raiz do monorepo
```
