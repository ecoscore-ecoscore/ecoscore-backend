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
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    optionsSuccessStatus: 200,
  }),
);

// Adicionar headers CORS manualmente como fallback
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Credentials", "true");
  }
  next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve arquivos estáticos apenas se ainda estiverem no mesmo projeto
// (No futuro, esta pasta será removida para o repositório frontend)
app.use(express.static(path.join(__dirname, "public")));

app.set("trust proxy", 1); // Confia no proxy da Vercel para cookies seguros

app.use(
  session({
    secret: process.env.SESSION_SECRET || "ecoscore-secret-2026",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 8 * 60 * 60 * 1000,
    },
  }),
);

// ─── Rotas ────────────────────────────────────────────────────────────────────
app.use("/api/auth", require("./routes/auth"));

// ─── Rota de sessão atual ─────────────────────────────────────────────────────
app.get("/api/me", (req, res) => {
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
