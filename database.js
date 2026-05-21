const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

// Configurações de conexão
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://ecoscore994_db_user:rRW1AeLn6tpShP0i@ecoscore.bmqnwxt.mongodb.net/ecoscore?retryWrites=true&w=majority";

// Opções de conexão recomendadas para MongoDB Atlas + Serverless
const connectionOptions = {
  serverSelectionTimeoutMS: 15000, 
  socketTimeoutMS: 45000,
  maxPoolSize: 1,
};

let cachedDb = null;

async function connectToDatabase() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  // Se já estiver conectando, espera
  if (mongoose.connection.readyState === 2) {
    console.log("⏳ [DB] Conexão já em andamento...");
    return new Promise((resolve, reject) => {
      mongoose.connection.once('connected', () => resolve(mongoose.connection));
      mongoose.connection.once('error', (err) => reject(err));
    });
  }

  console.log("🔄 [DB] Iniciando nova conexão ao MongoDB...");
  try {
    const db = await mongoose.connect(MONGODB_URI, connectionOptions);
    console.log("✅ [DB] MongoDB Conectado com sucesso!");
    return db;
  } catch (err) {
    console.error("❌ [DB] Erro fatal na conexão MongoDB:", err.message);
    // Não vamos lançar erro aqui para não travar o processo, 
    // mas o middleware de verificação vai capturar o readyState
  }
}

// Tentar conectar imediatamente, mas sem dar crash se falhar (ex: DNS em ambiente de build/agente)
connectToDatabase().catch(err => console.error("⚠️ [DB] Erro na conexão inicial:", err.message));

// ─── Schemas ──────────────────────────────────────────────────────────────────

const EmpresaSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  senha: { type: String, required: true },
  data_cadastro: { type: Date, default: Date.now },
});

EmpresaSchema.pre("save", async function () {
  if (!this.isModified("senha")) return;
  if (!this.senha.startsWith("$2")) {
    this.senha = bcrypt.hashSync(this.senha, 10);
  }
});

const AdminSchema = new mongoose.Schema({
  usuario: { type: String, required: true },
  senha: { type: String, required: true },
  empresa_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Empresa",
    default: null,
  },
});

AdminSchema.pre("save", async function () {
  if (!this.isModified("senha")) return;
  if (!this.senha.startsWith("$2")) {
    this.senha = bcrypt.hashSync(this.senha, 10);
  }
});

AdminSchema.index({ usuario: 1, empresa_id: 1 }, { unique: true });

const SetorSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  login: { type: String, required: true },
  senha: { type: String, required: true },
  dia_semana: { type: Number, required: true },
  ativo: { type: Number, default: 1 },
  empresa_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Empresa",
    required: true,
  },
});

// Índice único: cada empresa pode ter um login (ex: marketing), mas não pode repetir na mesma empresa
SetorSchema.index({ login: 1, empresa_id: 1 }, { unique: true });

SetorSchema.pre("save", async function () {
  if (!this.isModified("senha")) return;
  if (!this.senha.startsWith("$2")) {
    this.senha = bcrypt.hashSync(this.senha, 10);
  }
});

const FuncionarioSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  email: { type: String, sparse: true },
  senha: { type: String },
  setor_id: { type: mongoose.Schema.Types.ObjectId, ref: "Setor" },
  ativo: { type: Number, default: 1 },
  empresa_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Empresa",
    required: true,
  },
});

// Índice único por empresa para o e-mail
FuncionarioSchema.index({ email: 1, empresa_id: 1 }, { unique: true, sparse: true });

FuncionarioSchema.pre("save", async function () {
  if (!this.isModified("senha")) return;
  if (this.senha && !this.senha.startsWith("$2")) {
    this.senha = bcrypt.hashSync(this.senha, 10);
  }
});

const ColetaSchema = new mongoose.Schema({
  funcionario_nome: { type: String, required: true },
  setor_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Setor",
    required: true,
  },
  tipo_material: { type: String, required: true },
  peso_kg: { type: Number, required: true },
  pontos: { type: Number, required: true },
  data_registro: { type: String, required: true },
  empresa_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Empresa",
    required: true,
  },
});

const RecompensaSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  descricao: { type: String },
  pontuacao_necessaria: { type: Number, required: true },
  tipo: { type: String, default: "individual" },
  ativo: { type: Number, default: 1 },
  empresa_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Empresa",
    required: true,
  },
});

const ResgateSchema = new mongoose.Schema({
  funcionario_nome: { type: String, required: true },
  setor_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Setor",
    required: true,
  },
  recompensa_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Recompensa",
    required: true,
  },
  pontos_usados: { type: Number, required: true, default: 0 },
  status: { type: String, default: "pendente" }, // pendente, aprovado, cancelado
  data_resgate: { type: String, required: true },
  empresa_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Empresa",
    required: true,
  },
});

const transform = (doc, ret) => {
  ret.id = ret._id;
  delete ret._id;
  delete ret.__v;
};
[
  EmpresaSchema,
  AdminSchema,
  SetorSchema,
  FuncionarioSchema,
  ColetaSchema,
  RecompensaSchema,
  ResgateSchema,
].forEach((s) => {
  s.set("toJSON", { virtuals: true, transform });
  s.set("toObject", { virtuals: true, transform });
});

const Empresa = mongoose.model("Empresa", EmpresaSchema);
const Admin = mongoose.model("Admin", AdminSchema);
const Setor = mongoose.model("Setor", SetorSchema);
const Funcionario = mongoose.model("Funcionario", FuncionarioSchema);
const Coleta = mongoose.model("Coleta", ColetaSchema);
const Recompensa = mongoose.model("Recompensa", RecompensaSchema);
const Resgate = mongoose.model("Resgate", ResgateSchema);

async function seed() {
  if (mongoose.connection.readyState !== 1) return;
  try {
    let empresa = await Empresa.findOne({ email: "ecoscore994@gmail.com" });
    if (!empresa) {
      empresa = await Empresa.create({
        nome: "EcoScore",
        email: "ecoscore994@gmail.com",
        senha: "ecoscoreadmin",
      });
      console.log("[DB] Empresa EcoScore criada");
    }

    const adminExists = await Admin.findOne({
      usuario: "admin",
      empresa_id: empresa._id,
    });
    if (!adminExists) {
      await Admin.create({
        usuario: "admin",
        senha: "ecoscoreadmin",
        empresa_id: empresa._id,
      });
      console.log("[DB] Admin criado");
    }
  } catch (err) {
    console.error("[DB SEED ERROR]", err.message);
  }
}

if (process.env.NODE_ENV !== "test") {
  mongoose.connection.on("connected", seed);
}

module.exports = {
  connectToDatabase,
  Empresa,
  Admin,
  Setor,
  Funcionario,
  Coleta,
  Recompensa,
  Resgate,
  mongoose,
  seed,
};
