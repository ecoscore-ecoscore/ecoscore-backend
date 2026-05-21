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

// Configurações de CORS ultra-permitivas para Vercel
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
      // Permitir requests sem origin (como mobile apps ou curl)
      if (!origin) return callback(null, true);
      
      // Permitir qualquer subdomínio vercel.app ou origins permitidas
      const isVercel = origin.endsWith(".vercel.app");
      const isAllowed = allowedOrigins.indexOf(origin) !== -1;
      
      if (isVercel || isAllowed) {
        callback(null, true);
      } else {
        console.warn(`[CORS] Bloqueado: ${origin}`);
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

app.set("trust proxy", 1); 

// Configuração da Sessão
app.use(
  session({
    secret: process.env.SESSION_SECRET || "ecoscore-secret-2026",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI || "mongodb+srv://ecoscore994_db_user:rRW1AeLn6tpShP0i@ecoscore.bmqnwxt.mongodb.net/ecoscore?retryWrites=true&w=majority",
      ttl: 14 * 24 * 60 * 60,
      autoRemove: 'native',
      touchAfter: 3600 // Reduz escritas no banco
    }),
    cookie: {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 8 * 60 * 60 * 1000, // 8 horas
    },
  }),
);

// Middleware para garantir conexão com o banco
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
  if (req.session.setor) return res.json({ logado: true, tipo: "setor", ...req.session.setor });
  if (req.session.admin) return res.json({ logado: true, tipo: "admin", ...req.session.admin });
  if (req.session.funcionario) return res.json({ logado: true, tipo: "funcionario", ...req.session.funcionario });
  res.json({ logado: false });
});

app.use("/api/coletas", require("./routes/coletas"));
app.use("/api/ranking", require("./routes/ranking"));
app.use("/api/recompensas", require("./routes/recompensas"));
app.use("/api/admin", require("./routes/admin"));
app.use("/api/super", require("./routes/super"));

// Arquivos estáticos
app.use(express.static(path.join(__dirname, "public")));

app.get("*", (req, res) => {
  if (req.path.startsWith("/api")) return res.status(404).json({ erro: "Rota não encontrada" });
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, () => {
  console.log(`\n🌿 EcoScore rodando na porta ${PORT}`);
});

module.exports = app;
