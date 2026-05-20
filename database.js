const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ecoscore';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Conectado ao MongoDB'))
  .catch(err => console.error('❌ Erro ao conectar ao MongoDB:', err));

// ─── Schemas ──────────────────────────────────────────────────────────────────

const EmpresaSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  senha: { type: String, required: true },
  data_cadastro: { type: Date, default: Date.now }
});

const AdminSchema = new mongoose.Schema({
  usuario: { type: String, required: true },
  senha: { type: String, required: true },
  empresa_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', default: null } // null para Super Admin
});

const SetorSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  login: { type: String, unique: true, required: true },
  senha: { type: String, required: true },
  dia_semana: { type: Number, required: true }, // 1=Seg, 2=Ter, etc.
  ativo: { type: Number, default: 1 },
  empresa_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true }
});

const FuncionarioSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  email: { type: String, unique: true, sparse: true },
  senha: { type: String },
  setor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Setor' },
  ativo: { type: Number, default: 1 },
  empresa_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true }
});

const ColetaSchema = new mongoose.Schema({
  funcionario_nome: { type: String, required: true },
  setor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Setor', required: true },
  tipo_material: { type: String, required: true }, // metal, vidro, plastico, papel
  peso_kg: { type: Number, required: true },
  pontos: { type: Number, required: true },
  data_registro: { type: String, required: true }, // formato YYYY-MM-DD para facilitar filtros
  empresa_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true }
});

const RecompensaSchema = new mongoose.Schema({
  nome: { type: String, required: true },
  descricao: { type: String },
  pontuacao_necessaria: { type: Number, required: true },
  tipo: { type: String, default: 'individual' }, // individual ou coletiva
  ativo: { type: Number, default: 1 },
  empresa_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true }
});

const ResgateSchema = new mongoose.Schema({
  funcionario_nome: { type: String, required: true },
  setor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Setor', required: true },
  recompensa_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Recompensa', required: true },
  data_resgate: { type: String, required: true },
  empresa_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Empresa', required: true }
});

// Adicionar método toJSON para converter _id em id para compatibilidade com o frontend
const transform = (doc, ret) => {
  ret.id = ret._id;
  delete ret._id;
  delete ret.__v;
};
[EmpresaSchema, AdminSchema, SetorSchema, FuncionarioSchema, ColetaSchema, RecompensaSchema, ResgateSchema].forEach(s => {
  s.set('toJSON', { virtuals: true, transform });
  s.set('toObject', { virtuals: true, transform });
});

const Empresa = mongoose.model('Empresa', EmpresaSchema);
const Admin = mongoose.model('Admin', AdminSchema);
const Setor = mongoose.model('Setor', SetorSchema);
const Funcionario = mongoose.model('Funcionario', FuncionarioSchema);
const Coleta = mongoose.model('Coleta', ColetaSchema);
const Recompensa = mongoose.model('Recompensa', RecompensaSchema);
const Resgate = mongoose.model('Resgate', ResgateSchema);

// ─── Seed Data ────────────────────────────────────────────────────────────────

async function seed() {
  try {
    // Empresa padrão
    let empresa = await Empresa.findOne({ email: 'demo@ecoscore.com' });
    if (!empresa) {
      const senhaEmpresa = bcrypt.hashSync('demo123', 10);
      empresa = await Empresa.create({
        nome: 'Empresa Demo',
        email: 'demo@ecoscore.com',
        senha: senhaEmpresa
      });
      console.log('[DB] Empresa Demo criada.');
    }

    // Admin padrão
    const adminExists = await Admin.findOne({ usuario: 'admin', empresa_id: empresa._id });
    if (!adminExists) {
      const senha = bcrypt.hashSync('admin123', 10);
      await Admin.create({ usuario: 'admin', senha: senha, empresa_id: empresa._id });
      console.log('[DB] Admin criado: admin / admin123');
    }

    // Super Admin
    const superExists = await Admin.findOne({ usuario: 'eco_master', empresa_id: null });
    if (!superExists) {
      const senha = bcrypt.hashSync('eco123', 10);
      await Admin.create({ usuario: 'eco_master', senha: senha, empresa_id: null });
      console.log('[DB] Super Admin criado: eco_master / eco123');
    }

    // Setores
    const setoresCount = await Setor.countDocuments({ empresa_id: empresa._id });
    if (setoresCount === 0) {
      const senhaSetor = bcrypt.hashSync('ecoscore123', 10);
      const setoresSeed = [
        { nome: 'Marketing', login: 'marketing', dia_semana: 1, empresa_id: empresa._id, senha: senhaSetor },
        { nome: 'Recursos Humanos', login: 'rh', dia_semana: 2, empresa_id: empresa._id, senha: senhaSetor },
        { nome: 'Produção', login: 'producao', dia_semana: 3, empresa_id: empresa._id, senha: senhaSetor },
        { nome: 'Financeiro', login: 'financeiro', dia_semana: 4, empresa_id: empresa._id, senha: senhaSetor },
        { nome: 'Logística', login: 'logistica', dia_semana: 5, empresa_id: empresa._id, senha: senhaSetor }
      ];
      await Setor.insertMany(setoresSeed);
      console.log('[DB] 5 setores criados.');
    }

    // Recompensas
    const recompCount = await Recompensa.countDocuments({ empresa_id: empresa._id });
    if (recompCount === 0) {
      const recompensasSeed = [
        { nome: 'Vale Café', descricao: 'Vale-café na cantina da empresa', pontuacao_necessaria: 100, tipo: 'individual', empresa_id: empresa._id },
        { nome: 'Folga Extra', descricao: 'Um dia de folga adicional', pontuacao_necessaria: 500, tipo: 'individual', empresa_id: empresa._id },
        { nome: 'Brinde EcoScore', descricao: 'Kit ecológico personalizado da empresa', pontuacao_necessaria: 300, tipo: 'individual', empresa_id: empresa._id },
        { nome: 'Almoço em Equipe', descricao: 'Almoço especial para todo o setor', pontuacao_necessaria: 1000, tipo: 'coletiva', empresa_id: empresa._id },
        { nome: 'Bônus Sustentável', descricao: 'Bônus financeiro por desempenho ambiental', pontuacao_necessaria: 2000, tipo: 'coletiva', empresa_id: empresa._id }
      ];
      await Recompensa.insertMany(recompensasSeed);
      console.log('[DB] Recompensas criadas.');
    }

    // Funcionários
    const funcCount = await Funcionario.countDocuments({ empresa_id: empresa._id });
    if (funcCount === 0) {
      const marketing = await Setor.findOne({ login: 'marketing', empresa_id: empresa._id });
      const rh = await Setor.findOne({ login: 'rh', empresa_id: empresa._id });
      const senhaFunc = bcrypt.hashSync('funcionario123', 10);
      const funcionariosSeed = [
        { nome: 'Ana Silva', email: 'ana@demo.com', senha: senhaFunc, setor_id: marketing._id, empresa_id: empresa._id },
        { nome: 'Bruno Costa', email: 'bruno@demo.com', senha: senhaFunc, setor_id: marketing._id, empresa_id: empresa._id },
        { nome: 'Carla Mendes', email: 'carla@demo.com', senha: senhaFunc, setor_id: rh._id, empresa_id: empresa._id },
        { nome: 'Diego Santos', email: 'diego@demo.com', senha: senhaFunc, setor_id: rh._id, empresa_id: empresa._id }
      ];
      await Funcionario.insertMany(funcionariosSeed);
      console.log('[DB] Funcionários criados.');
    }
  } catch (err) {
    console.error('[DB SEED ERROR]', err);
  }
}

// Rodar seed após conexão (opcional, ou chamar manualmente)
mongoose.connection.once('open', seed);

module.exports = {
  Empresa, Admin, Setor, Funcionario, Coleta, Recompensa, Resgate, mongoose
};
