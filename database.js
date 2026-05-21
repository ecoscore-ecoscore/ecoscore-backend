const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/ecoscore";

mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("✅ Conectado ao MongoDB"))
  .catch((err) => console.error("❌ Erro ao conectar ao MongoDB:", err));

// ─── Schemas ──────────────────────────────────────────────────────────────────

const EmpresaSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  senha: { type: String, required: true },
  data_cadastro: { type: Date, default: Date.now },
});

// Middleware para criptografar senha da empresa
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
  }, // null para Super Admin
});

// Middleware para criptografar senha se não estiver já criptografada
AdminSchema.pre("save", async function () {
  if (!this.isModified("senha")) return;

  // Se a senha não começa com '$2' (hash bcrypt), criptografa
  if (!this.senha.startsWith("$2")) {
    this.senha = bcrypt.hashSync(this.senha, 10);
  }
});

// Índice único: cada empresa pode ter um admin com mesmo nome, mas não pode haver duplicatas globais para super admin
AdminSchema.index({ usuario: 1, empresa_id: 1 }, { unique: true });

const SetorSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  login: { type: String, unique: true, required: true },
  senha: { type: String, required: true },
  dia_semana: { type: Number, required: true }, // 1=Seg, 2=Ter, etc.
  ativo: { type: Number, default: 1 },
  empresa_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Empresa",
    required: true,
  },
});

// Middleware para criptografar senha do setor
SetorSchema.pre("save", async function () {
  if (!this.isModified("senha")) return;
  if (!this.senha.startsWith("$2")) {
    this.senha = bcrypt.hashSync(this.senha, 10);
  }
});

const FuncionarioSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  email: { type: String, unique: true, sparse: true },
  senha: { type: String },
  setor_id: { type: mongoose.Schema.Types.ObjectId, ref: "Setor" },
  ativo: { type: Number, default: 1 },
  empresa_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Empresa",
    required: true,
  },
});

// Middleware para criptografar senha do funcionário
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
  tipo_material: { type: String, required: true }, // metal, vidro, plastico, papel
  peso_kg: { type: Number, required: true },
  pontos: { type: Number, required: true },
  data_registro: { type: String, required: true }, // formato YYYY-MM-DD para facilitar filtros
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
  tipo: { type: String, default: "individual" }, // individual ou coletiva
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
  data_resgate: { type: String, required: true },
  empresa_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Empresa",
    required: true,
  },
});

// Adicionar método toJSON para converter _id em id para compatibilidade com o frontend
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

// ─── Seed Data ────────────────────────────────────────────────────────────────

async function seed() {
  try {
    // Empresa padrão
    let empresa = await Empresa.findOne({ email: "ecoscore994@gmail.com" });
    if (!empresa) {
      empresa = await Empresa.create({
        nome: "EcoScore",
        email: "ecoscore994@gmail.com",
        senha: "ecoscoreadmin", // Middleware vai criptografar
      });
      console.log(
        "[DB] Empresa EcoScore criada: ecoscore994@gmail.com / ecoscoreadmin",
      );
    }

    // Admin padrão
    const adminExists = await Admin.findOne({
      usuario: "admin",
      empresa_id: empresa._id,
    });
    if (!adminExists) {
      try {
        await Admin.create({
          usuario: "admin",
          senha: "ecoscoreadmin", // Middleware vai criptografar
          empresa_id: empresa._id,
        });
        console.log("[DB] Admin criado com sucesso");
      } catch (adminErr) {
        if (adminErr.code === 11000) {
          console.log("[DB] Admin já existe para esta empresa");
        } else {
          throw adminErr;
        }
      }
    }
  } catch (err) {
    console.error("[DB SEED ERROR]", err);
  }
}

// Rodar seed após conexão apenas se não estiver em teste
if (process.env.NODE_ENV !== "test") {
  mongoose.connection.once("open", async () => {
    try {
      await seed();
      console.log("[DB] Seed concluída com sucesso");
    } catch (seedErr) {
      console.error("[DB SEED ERROR - FINAL]", seedErr.message);
    }
  });
}

module.exports = {
  Empresa,
  Admin,
  Setor,
  Funcionario,
  Coleta,
  Recompensa,
  Resgate,
  mongoose,
  seed, // Exporta seed para chamadas manuais
};
