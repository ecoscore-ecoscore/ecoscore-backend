const express = require("express");
const bcrypt = require("bcryptjs");
const { Empresa, Admin, Setor, Funcionario } = require("../database");
const router = express.Router();

// POST /api/auth/register-company — Cadastro de nova empresa
router.post("/register-company", async (req, res) => {
  const { nome, email, senha } = req.body;

  if (!nome || !email || !senha) {
    return res.status(400).json({ erro: "Todos os campos são obrigatórios" });
  }

  try {
    const senhaHash = bcrypt.hashSync(senha, 10);

    // Criar empresa
    const empresa = await Empresa.create({
      nome,
      email,
      senha: senhaHash,
    });

    // Criar um admin padrão para esta empresa
    await Admin.create({
      usuario: "admin",
      senha: senhaHash,
      empresa_id: empresa._id,
    });

    res
      .status(201)
      .json({ sucesso: true, mensagem: "Empresa cadastrada com sucesso" });
  } catch (err) {
    console.error("[AUTH ERROR]", err);
    if (err.code === 11000) {
      // MongoDB duplicate key error
      return res.status(409).json({ erro: "Este e-mail já está cadastrado" });
    }
    res.status(500).json({ erro: "Erro interno ao cadastrar empresa" });
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

module.exports = router;
