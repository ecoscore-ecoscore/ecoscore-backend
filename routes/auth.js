const express = require("express");
const bcrypt = require("bcryptjs");
const { Empresa, Admin, Setor, Funcionario } = require("../database");
const router = express.Router();

// POST /api/auth/register-company — Cadastro de nova empresa
router.post("/register-company", async (req, res) => {
  const { nome, email, senha } = req.body;
  console.log("[REGISTER-COMPANY] Requisição recebida:", { nome, email });

  if (!nome || !email || !senha) {
    return res.status(400).json({ erro: "Todos os campos são obrigatórios" });
  }

  if (senha.length < 6) {
    return res
      .status(400)
      .json({ erro: "Senha deve ter no mínimo 6 caracteres" });
  }

  try {
    console.log("[REGISTER-COMPANY] Hashando senha...");
    const senhaHash = bcrypt.hashSync(senha, 10);

    console.log("[REGISTER-COMPANY] Criando empresa...");
    // Criar empresa
    const empresa = await Empresa.create({
      nome,
      email,
      senha: senhaHash,
    });
    console.log("[REGISTER-COMPANY] Empresa criada:", empresa._id);

    // Criar um admin padrão para esta empresa
    console.log("[REGISTER-COMPANY] Criando admin padrão...");
    const admin = await Admin.create({
      usuario: "admin",
      senha: senhaHash,
      empresa_id: empresa._id,
    });
    console.log("[REGISTER-COMPANY] Admin criado:", admin._id);

    res.status(201).json({
      sucesso: true,
      mensagem: "Empresa cadastrada com sucesso",
      empresa_id: empresa._id,
    });
  } catch (err) {
    console.error("[AUTH ERROR - REGISTER-COMPANY]", {
      message: err.message,
      code: err.code,
      keyPattern: err.keyPattern,
      keyValue: err.keyValue,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
      mongooseValidationErrors: err.errors
        ? Object.keys(err.errors)
        : undefined,
    });

    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      const value = err.keyValue[field];

      console.log(`[DUPLICATE KEY] Campo: ${field}, Valor: ${value}`);

      if (field === "email") {
        return res.status(409).json({
          erro: "Este e-mail já está cadastrado",
          detalhes: `O e-mail "${value}" já foi registrado no sistema`,
        });
      }

      return res.status(409).json({
        erro: `Campo "${field}" já existe`,
        detalhes: `O valor "${value}" já foi registrado no sistema`,
        campo: field,
      });
    }

    if (err.name === "ValidationError") {
      return res
        .status(400)
        .json({ erro: `Erro de validação: ${err.message}` });
    }

    res
      .status(500)
      .json({ erro: "Erro interno ao cadastrar empresa. Tente novamente." });
  }
});

// POST /api/auth/login — login unificado (identifica tipo automaticamente)
router.post("/login", async (req, res) => {
  const { login, senha } = req.body;
  if (!login || !senha)
    return res.status(400).json({ erro: "Login e senha obrigatórios" });

  try {
    // 0. Tentar como Super Admin (Admin do Sistema - Sem Empresa)
    const superAdmin = await Admin.findOne({
      usuario: login,
      empresa_id: null,
    });
    if (superAdmin && bcrypt.compareSync(senha, superAdmin.senha)) {
      req.session.admin = {
        id: superAdmin._id,
        usuario: superAdmin.usuario,
        empresa_id: null,
        empresa_nome: "EcoScore Master",
      };
      return res.json({
        sucesso: true,
        tipo: "super",
        redirecionar: "/super-admin.html",
      });
    }

    // 1. Tentar como Empresa/Admin (E-mail)
    const empresa = await Empresa.findOne({ email: login });
    if (empresa && bcrypt.compareSync(senha, empresa.senha)) {
      const admin = await Admin.findOne({ empresa_id: empresa._id });
      req.session.admin = {
        id: admin ? admin._id : empresa._id,
        usuario: admin ? admin.usuario : "admin",
        empresa_id: empresa._id,
        empresa_nome: empresa.nome,
      };
      return res.json({
        sucesso: true,
        tipo: "admin",
        redirecionar: "/admin.html",
      });
    }

    // 2. Tentar como Setor (Login)
    const setor = await Setor.findOne({ login: login, ativo: 1 });
    if (setor && bcrypt.compareSync(senha, setor.senha)) {
      req.session.setor = {
        id: setor._id,
        nome: setor.nome,
        login: setor.login,
        dia_semana: setor.dia_semana,
        empresa_id: setor.empresa_id,
      };
      return res.json({
        sucesso: true,
        tipo: "setor",
        redirecionar: "/dashboard.html",
      });
    }

    // 3. Tentar como Funcionário (E-mail)
    const func = await Funcionario.findOne({ email: login, ativo: 1 }).populate(
      "setor_id",
    );
    if (func && bcrypt.compareSync(senha, func.senha)) {
      req.session.funcionario = {
        id: func._id,
        nome: func.nome,
        email: func.email,
        setor_id: func.setor_id ? func.setor_id._id : null,
        setor_nome: func.setor_id ? func.setor_id.nome : null,
        dia_semana: func.setor_id ? func.setor_id.dia_semana : null,
        empresa_id: func.empresa_id,
      };
      return res.json({
        sucesso: true,
        tipo: "funcionario",
        redirecionar: "/user.html",
      });
    }

    res.status(401).json({ erro: "Credenciais incorretas ou usuário inativo" });
  } catch (err) {
    console.error("[LOGIN ERROR]", err);
    res.status(500).json({ erro: "Erro interno ao processar login" });
  }
});

// POST /api/auth/funcionario/login — login do funcionário (mantido por compatibilidade)
router.post("/funcionario/login", async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha)
    return res.status(400).json({ erro: "E-mail e senha obrigatórios" });

  try {
    const func = await Funcionario.findOne({ email: email, ativo: 1 }).populate(
      "setor_id",
    );

    if (!func)
      return res.status(401).json({ erro: "E-mail ou senha incorretos" });

    const senhaOk = bcrypt.compareSync(senha, func.senha);
    if (!senhaOk)
      return res.status(401).json({ erro: "E-mail ou senha incorretos" });

    req.session.funcionario = {
      id: func._id,
      nome: func.nome,
      email: func.email,
      setor_id: func.setor_id ? func.setor_id._id : null,
      setor_nome: func.setor_id ? func.setor_id.nome : null,
      dia_semana: func.setor_id ? func.setor_id.dia_semana : null,
      empresa_id: func.empresa_id,
    };

    res.json({ sucesso: true, funcionario: req.session.funcionario });
  } catch (err) {
    res.status(500).json({ erro: "Erro interno" });
  }
});

// POST /api/auth/logout
router.post("/logout", (req, res) => {
  req.session.destroy();
  res.json({ sucesso: true });
});

// GET /api/auth/test-credentials — Endpoint de teste (apenas desenvolvimento)
router.get("/test-credentials", (req, res) => {
  res.json({
    credenciais: [
      {
        tipo: "Empresa/Admin",
        usuario: "demo@ecoscore.com",
        senha: "demo123",
        redireciona: "/admin.html",
      },
      {
        tipo: "Setor",
        usuario: "marketing",
        senha: "ecoscore123",
        redireciona: "/dashboard.html",
      },
      {
        tipo: "Funcionário",
        usuario: "ana@demo.com",
        senha: "funcionario123",
        redireciona: "/user.html",
      },
      {
        tipo: "Super Admin",
        usuario: "eco_master",
        senha: "eco123",
        redireciona: "/super-admin.html",
      },
    ],
    nota: "Use estas credenciais para testar o sistema",
  });
});

// GET /api/auth/status — Verificar status do banco e criar seed se necessário
router.get("/status", async (req, res) => {
  try {
    const {
      Empresa,
      Admin,
      Setor,
      Funcionario,
      Recompensa,
    } = require("../database");

    const empresaCount = await Empresa.countDocuments();
    const adminCount = await Admin.countDocuments();
    const setorCount = await Setor.countDocuments();

    if (empresaCount === 0) {
      console.log("🔄 Seed manual iniciado...");

      const senhaEmpresa = bcrypt.hashSync("demo123", 10);
      const empresa = await Empresa.create({
        nome: "Empresa Demo",
        email: "demo@ecoscore.com",
        senha: senhaEmpresa,
      });

      const senhaSuperAdmin = bcrypt.hashSync("eco123", 10);
      await Admin.create({
        usuario: "eco_master",
        senha: senhaSuperAdmin,
        empresa_id: null,
      });

      const senhaAdmin = bcrypt.hashSync("admin123", 10);
      await Admin.create({
        usuario: "admin",
        senha: senhaAdmin,
        empresa_id: empresa._id,
      });

      const senhaSetor = bcrypt.hashSync("ecoscore123", 10);
      const setoresSeed = [
        {
          nome: "Marketing",
          login: "marketing",
          dia_semana: 1,
          empresa_id: empresa._id,
          senha: senhaSetor,
        },
        {
          nome: "RH",
          login: "rh",
          dia_semana: 2,
          empresa_id: empresa._id,
          senha: senhaSetor,
        },
      ];
      await Setor.insertMany(setoresSeed);

      const senhaFunc = bcrypt.hashSync("funcionario123", 10);
      const marketing = await Setor.findOne({
        login: "marketing",
        empresa_id: empresa._id,
      });
      await Funcionario.create({
        nome: "Ana Silva",
        email: "ana@demo.com",
        senha: senhaFunc,
        setor_id: marketing._id,
        empresa_id: empresa._id,
      });

      console.log("✅ Seed manual concluído!");
    }

    res.json({
      status: "ok",
      mongodb_conectado: true,
      dados: {
        empresas: empresaCount,
        admins: adminCount,
        setores: setorCount,
      },
    });
  } catch (err) {
    console.error("[STATUS ERROR]", err);
    res.status(500).json({ status: "erro", erro: err.message });
  }
});

// GET /api/auth/diagnostico — Endpoint para diagnosticar problemas
router.get("/diagnostico", async (req, res) => {
  const info = {
    timestamp: new Date().toISOString(),
    node_env: process.env.NODE_ENV,
    mongodb_uri_configured: !!process.env.MONGODB_URI,
    conexao_mongodb: "verificando...",
    colecoes: {},
    indices: {},
    erros: [],
  };

  try {
    const mongoose = require("mongoose");
    info.conexao_mongodb =
      mongoose.connection.readyState === 1
        ? "conectado"
        : `desconectado (estado: ${mongoose.connection.readyState})`;

    const db = mongoose.connection.db;
    if (db) {
      const colecoes = await db.listCollections().toArray();
      info.colecoes = colecoes.map((c) => c.name);

      // Verificar índices
      for (const colecao of colecoes) {
        const col = db.collection(colecao.name);
        const indices = await col.getIndexes();
        info.indices[colecao.name] = Object.keys(indices);
      }
    }
  } catch (err) {
    info.erros.push({
      categoria: "MongoDB",
      mensagem: err.message,
      stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
    });
  }

  // Verificar variáveis de ambiente
  const envVars = [
    "MONGODB_URI",
    "SESSION_SECRET",
    "FRONTEND_URL",
    "NODE_ENV",
    "PORT",
  ];
  info.env_vars = {};
  envVars.forEach((v) => {
    const val = process.env[v];
    info.env_vars[v] = val
      ? `${v[0]}${"*".repeat(Math.max(0, val.length - 4))}${val.slice(-2)}`
      : "não configurado";
  });

  res.json(info);
});

// GET /api/auth/debug/empresas — Listar todas as empresas (debug)
router.get("/debug/empresas", async (req, res) => {
  try {
    const empresas = await Empresa.find().select("_id nome email");
    const admins = await Admin.find();

    res.json({
      empresas: empresas.map((e) => ({
        _id: e._id,
        nome: e.nome,
        email: e.email,
        admin:
          admins.find((a) => a.empresa_id?.toString() === e._id.toString())
            ?.usuario || "N/A",
      })),
      total: empresas.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// GET /api/auth/debug/indices — Verificar índices do MongoDB (debug)
router.get("/debug/indices", async (req, res) => {
  try {
    const mongoose = require("mongoose");
    const db = mongoose.connection.db;

    const indices = {};
    const collections = ["empresas", "admins"];

    for (const col of collections) {
      try {
        const collection = db.collection(col);
        const idx = await collection.getIndexes();
        indices[col] = Object.entries(idx).map(([key, val]) => ({
          nome: key,
          campos: val.key,
          unique: val.unique || false,
        }));
      } catch (err) {
        indices[col] = `Erro ao ler: ${err.message}`;
      }
    }

    res.json({
      indices,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// GET /api/auth/debug/empresas — Listar todas as empresas (debug)
router.get("/debug/empresas", async (req, res) => {
  try {
    const empresas = await Empresa.find().select("_id nome email");
    const admins = await Admin.find();

    res.json({
      empresas: empresas.map(e => ({
        _id: e._id,
        nome: e.nome,
        email: e.email,
        admin: admins.find(a => a.empresa_id?.toString() === e._id.toString())?.usuario || "N/A"
      })),
      total: empresas.length,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ⚠️ POST /api/auth/debug/reset-all-data — APENAS PARA DESENVOLVIMENTO (limpa TUDO e cria novo Super Admin)
router.post("/debug/reset-all-data", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ erro: "Operação não permitida em produção" });
  }

  try {
    const {
      Empresa,
      Admin,
      Setor,
      Funcionario,
      Coleta,
      Recompensa,
      Resgate,
    } = require("../database");

    console.log("[RESET] Deletando todas as coleções...");

    // Delete all
    await Empresa.deleteMany({});
    await Admin.deleteMany({});
    await Setor.deleteMany({});
    await Funcionario.deleteMany({});
    await Coleta.deleteMany({});
    await Recompensa.deleteMany({});
    await Resgate.deleteMany({});

    console.log("[RESET] Coleções limpas!");

    // Criar novo Super Admin
    const novoSuperAdmin = bcrypt.hashSync("eco123", 10);
    const superAdmin = await Admin.create({
      usuario: "eco_master",
      senha: novoSuperAdmin,
      empresa_id: null,
    });

    console.log("[RESET] Super Admin criado: eco_master / eco123");

    res.json({
      sucesso: true,
      mensagem: "Banco de dados resetado com sucesso!",
      novo_super_admin: {
        usuario: "eco_master",
        senha: "eco123",
        empresa_id: null
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("[RESET ERROR]", err);
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;

// ⚠️ POST /api/auth/debug/reset-all-data — APENAS PARA DESENVOLVIMENTO (limpa TUDO e cria novo Super Admin)
router.post("/debug/reset-all-data", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return res.status(403).json({ erro: "Operação não permitida em produção" });
  }

  try {
    const {
      Empresa,
      Admin,
      Setor,
      Funcionario,
      Coleta,
      Recompensa,
      Resgate,
    } = require("../database");

    console.log("[RESET] Deletando todas as coleções...");

    // Delete all
    await Empresa.deleteMany({});
    await Admin.deleteMany({});
    await Setor.deleteMany({});
    await Funcionario.deleteMany({});
    await Coleta.deleteMany({});
    await Recompensa.deleteMany({});
    await Resgate.deleteMany({});

    console.log("[RESET] Coleções limpas!");

    // Criar novo Super Admin
    const novoSuperAdmin = bcrypt.hashSync("eco123", 10);
    const superAdmin = await Admin.create({
      usuario: "eco_master",
      senha: novoSuperAdmin,
      empresa_id: null,
    });

    console.log("[RESET] Super Admin criado: eco_master / eco123");

    res.json({
      sucesso: true,
      mensagem: "Banco de dados resetado com sucesso!",
      novo_super_admin: {
        usuario: "eco_master",
        senha: "eco123",
        empresa_id: null,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[RESET ERROR]", err);
    res.status(500).json({ erro: err.message });
  }
});

module.exports = router;
