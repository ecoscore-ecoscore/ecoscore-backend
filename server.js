const express = require("express");
const session = require("express-session");
const path = require("path");
const cors = require("cors");
require("dotenv").config();

// Inicializa banco
require("./database");

const app = express();
const PORT = process.env.PORT || 3000;

// Debug
console.log("🔧 NODE_ENV:", process.env.NODE_ENV);
console.log("🔧 FRONTEND_URL:", process.env.FRONTEND_URL);

// ─── Middlewares ──────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "http://localhost:5000",
  "http://localhost:3000",
  "http://127.0.0.1:5000",
  "http://127.0.0.1:3000",
  "https://ecoscore-gold.vercel.app",
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // Permite requests sem origin (como mobile apps ou curl)
      if (!origin) return callback(null, true);
      if (allowedOrigins.indexOf(origin) !== -1 || origin.includes("vercel.app")) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve arquivos estáticos apenas se ainda estiverem no mesmo projeto
app.use(express.static(path.join(__dirname, "public")));

const MongoStore = require("connect-mongo");
const mongoose = require("mongoose");

app.set("trust proxy", 1); 

// Middleware para garantir conexão com o banco em ambientes serverless
app.use(async (req, res, next) => {
  if (req.path.startsWith('/api')) {
    try {
      if (mongoose.connection.readyState !== 1) {
        console.log("🔄 [DB] Reconectando ao MongoDB antes da requisição...");
        await require("./database"); // Garante que a lógica de conexão seja executada
      }
    } catch (err) {
      console.error("❌ [DB] Falha ao garantir conexão:", err.message);
    }
  }
  next();
});

app.use(
  session({
    secret: process.env.SESSION_SECRET || "ecoscore-secret-2026",
    resave: true,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI || "mongodb+srv://ecoscore994_db_user:rRW1AeLn6tpShP0i@ecoscore.bmqnwxt.mongodb.net/ecoscore?retryWrites=true&w=majority",
      touchAfter: 24 * 3600 // Atualiza a sessão apenas uma vez por dia se não houver mudanças
    }),
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 8 * 60 * 60 * 1000,
    },
  }),
);

// ─── Rotas ────────────────────────────────────────────────────────────────────
app.use("/api/auth", require("./routes/auth"));

// ─── Rota de sessão atual ─────────────────────────────────────────────────────
app.get("/api/me", (req, res) => {
  console.log("🔍 [API/ME] Session ID:", req.sessionID);
  console.log("🔍 [API/ME] Session Content:", req.session);

  if (req.session.setor) {
    return res.json({ logado: true, tipo: "setor", ...req.session.setor });
  }
  if (req.session.admin) {
    return res.json({ logado: true, tipo: "admin", ...req.session.admin });
  }
  if (req.session.funcionario) {
    return res.json({
      logado: true,
      tipo: "funcionario",
      ...req.session.funcionario,
    });
  }
  res.json({ logado: false });
});

app.use("/api/coletas", require("./routes/coletas"));
app.use("/api/ranking", require("./routes/ranking"));
app.use("/api/recompensas", require("./routes/recompensas"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/super", require("./routes/super"));

// ─── SPA fallback ─────────────────────────────────────────────────────────────
app.get("*", (req, res) => {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({ erro: "Rota de API não encontrada" });
  }
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🌿 EcoScore rodando em http://localhost:${PORT}`);
  console.log(`   Admin: http://localhost:${PORT}/admin.html`);
  console.log(`   Login: admin / admin123\n`);
});

module.exports = app; // Exporta para a Vercel
