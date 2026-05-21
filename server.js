const express = require("express");
const session = require("express-session");
const path = require("path");
const cors = require("cors");
const MongoStore = require("connect-mongo");
const mongoose = require("mongoose");
require("dotenv").config();

const dbModule = require("./database");

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração de CORS robusta
const allowedOrigins = [
  process.env.FRONTEND_URL,
  "https://ecoscore-gold.vercel.app",
  "https://ecoscore-backend.vercel.app",
].filter(Boolean).map(o => o.replace(/\/$/, ""));

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);
      const isVercel = origin.endsWith(".vercel.app");
      const isAllowed = allowedOrigins.includes(origin);
      if (isVercel || isAllowed) {
        callback(null, true);
      } else {
        callback(null, false); // Rejeita silenciosamente para evitar erros de pré-vôo
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Trust Proxy é vital na Vercel
app.set("trust proxy", 1); 

// Sessão
app.use(
  session({
    name: "ecoscore.sid", // Nome customizado para evitar conflitos
    secret: process.env.SESSION_SECRET || "ecoscore-secret-v2-2026",
    resave: true,
    saveUninitialized: false,
    rolling: true,
    proxy: true,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI || "mongodb+srv://ecoscore994_db_user:rRW1AeLn6tpShP0i@ecoscore.bmqnwxt.mongodb.net/ecoscore?retryWrites=true&w=majority",
      ttl: 14 * 24 * 60 * 60,
      touchAfter: 60
    }),
    cookie: {
      httpOnly: true,
      secure: true,      // HTTPS obrigatório
      sameSite: "none",   // Cross-site obrigatório
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 dias
    },
  }),
);

// Conexão com DB
app.use(async (req, res, next) => {
  if (req.path.startsWith('/api')) {
    try {
      if (mongoose.connection.readyState !== 1) {
        await dbModule.connectToDatabase();
      }
    } catch (err) {
      console.error("❌ [DB ERROR]", err.message);
    }
  }
  next();
});

// Rotas
app.use("/api/auth", require("./routes/auth"));

app.get("/api/me", (req, res) => {
  // Logs para depuração no console da Vercel
  console.log(`[SESSION CHECK] ID: ${req.sessionID} | Data: ${JSON.stringify(req.session)}`);
  
  if (req.session.admin) return res.json({ logado: true, tipo: "admin", ...req.session.admin });
  if (req.session.setor) return res.json({ logado: true, tipo: "setor", ...req.session.setor });
  if (req.session.funcionario) return res.json({ logado: true, tipo: "funcionario", ...req.session.funcionario });
  
  res.json({ logado: false });
});

// Outras APIs
app.use("/api/coletas", require("./routes/coletas"));
app.use("/api/ranking", require("./routes/ranking"));
app.use("/api/recompensas", require("./routes/recompensas"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/super", require("./routes/super"));

// Frontend
app.use(express.static(path.join(__dirname, "public")));
app.get("*", (req, res) => {
  if (req.path.startsWith("/api")) return res.status(404).json({ erro: "API não encontrada" });
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => console.log(`🌿 EcoScore Ready`));

module.exports = app;
