const express = require('express');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { Setor, Funcionario, Coleta } = require('../database');
const router = express.Router();

function authAdmin(req, res, next) {
  if (!req.session.admin) return res.status(401).json({ erro: 'Acesso administrativo necessário' });
  next();
}

// ─── SETORES ──────────────────────────────────────────────────────────────────

router.get('/setores', authAdmin, async (req, res) => {
  const { empresa_id } = req.session.admin;
  try {
    const setores = await Setor.find({ empresa_id }).sort('dia_semana');
    res.json(setores);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar setores' });
  }
});

router.post('/setores', authAdmin, async (req, res) => {
  const { nome, login, senha, dia_semana } = req.body;
  const { empresa_id } = req.session.admin;
  if (!nome || !login || !senha || !dia_semana) return res.status(400).json({ erro: 'Todos os campos são obrigatórios' });

  try {
    const exists = await Setor.findOne({ login });
    if (exists) return res.status(409).json({ erro: 'Login já existe' });

    const senhaHash = bcrypt.hashSync(senha, 10);
    const setor = await Setor.create({
      nome, login, senha: senhaHash, dia_semana: parseInt(dia_semana), empresa_id
    });
    res.status(201).json({ sucesso: true, id: setor._id });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao criar setor' });
  }
});

router.put('/setores/:id', authAdmin, async (req, res) => {
  const { nome, login, senha, dia_semana, ativo } = req.body;
  const { empresa_id } = req.session.admin;
  
  try {
    const updateData = { nome, login, dia_semana: parseInt(dia_semana), ativo: ativo ?? 1 };
    if (senha && senha.trim()) {
      updateData.senha = bcrypt.hashSync(senha, 10);
    }
    
    await Setor.findOneAndUpdate({ _id: req.params.id, empresa_id }, updateData);
    res.json({ sucesso: true });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao atualizar setor' });
  }
});

router.delete('/setores/:id', authAdmin, async (req, res) => {
  const { empresa_id } = req.session.admin;
  try {
    await Setor.findOneAndUpdate({ _id: req.params.id, empresa_id }, { ativo: 0 });
    res.json({ sucesso: true });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao desativar setor' });
  }
});

// ─── FUNCIONÁRIOS ─────────────────────────────────────────────────────────────

router.get('/funcionarios', authAdmin, async (req, res) => {
  const { empresa_id } = req.session.admin;
  try {
    const funcionarios = await Funcionario.find({ empresa_id, ativo: 1 }).populate('setor_id').sort('nome');
    // Mapear para incluir setor_nome para compatibilidade
    const result = funcionarios.map(f => ({
      ...f.toJSON(),
      setor_nome: f.setor_id ? f.setor_id.nome : 'Sem setor'
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar funcionários' });
  }
});

router.post('/funcionarios', authAdmin, async (req, res) => {
  const { nome, email, senha, setor_id } = req.body;
  const { empresa_id } = req.session.admin;
  if (!nome || !email || !senha) return res.status(400).json({ erro: 'Nome, E-mail e Senha são obrigatórios' });

  try {
    const exists = await Funcionario.findOne({ email });
    if (exists) return res.status(409).json({ erro: 'E-mail já cadastrado para outro funcionário' });

    const senhaHash = bcrypt.hashSync(senha, 10);
    const func = await Funcionario.create({
      nome, email, senha: senhaHash, setor_id: setor_id || null, empresa_id
    });
    res.status(201).json({ sucesso: true, id: func._id });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao criar funcionário' });
  }
});

router.put('/funcionarios/:id', authAdmin, async (req, res) => {
  const { nome, email, senha, setor_id } = req.body;
  const { empresa_id } = req.session.admin;

  try {
    const updateData = { nome, email, setor_id: setor_id || null };
    if (senha && senha.trim()) {
      updateData.senha = bcrypt.hashSync(senha, 10);
    }
    await Funcionario.findOneAndUpdate({ _id: req.params.id, empresa_id }, updateData);
    res.json({ sucesso: true });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao atualizar funcionário' });
  }
});

router.delete('/funcionarios/:id', authAdmin, async (req, res) => {
  const { empresa_id } = req.session.admin;
  try {
    await Funcionario.findOneAndUpdate({ _id: req.params.id, empresa_id }, { ativo: 0 });
    res.json({ sucesso: true });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao desativar funcionário' });
  }
});

// ─── RELATÓRIOS ───────────────────────────────────────────────────────────────

router.get('/relatorios', authAdmin, async (req, res) => {
  const { empresa_id } = req.session.admin;
  const eid = new mongoose.Types.ObjectId(empresa_id);

  try {
    // Total Geral
    const totalGeralRes = await Coleta.aggregate([
      { $match: { empresa_id: eid } },
      { $group: { _id: null, total_kg: { $sum: "$peso_kg" }, total_pontos: { $sum: "$pontos" } } }
    ]);
    const totalGeral = totalGeralRes[0] || { total_kg: 0, total_pontos: 0 };

    // Por Setor
    const porSetor = await Setor.aggregate([
      { $match: { empresa_id: eid, ativo: 1 } },
      { $lookup: { from: 'coletas', localField: '_id', foreignField: 'setor_id', as: 'coletas' } },
      { $project: {
          nome: 1,
          total_kg: { $sum: "$coletas.peso_kg" },
          total_pontos: { $sum: "$coletas.pontos" },
          registros: { $size: "$coletas" }
      }},
      { $sort: { total_kg: -1 } }
    ]);

    // Por Material
    const porMaterial = await Coleta.aggregate([
      { $match: { empresa_id: eid } },
      { $group: {
          _id: "$tipo_material",
          total_kg: { $sum: "$peso_kg" },
          total_pontos: { $sum: "$pontos" },
          registros: { $count: {} }
      }},
      { $project: { tipo_material: "$_id", total_kg: 1, total_pontos: 1, registros: 1, _id: 0 } },
      { $sort: { total_kg: -1 } }
    ]);

    // Top Funcionários
    const topFuncionarios = await Coleta.aggregate([
      { $match: { empresa_id: eid } },
      { $group: {
          _id: { nome: "$funcionario_nome", setor: "$setor_id" },
          total_kg: { $sum: "$peso_kg" },
          total_pontos: { $sum: "$pontos" }
      }},
      { $lookup: { from: 'setores', localField: '_id.setor', foreignField: '_id', as: 'setor' } },
      { $project: {
          funcionario_nome: "$_id.nome",
          setor_nome: { $arrayElemAt: ["$setor.nome", 0] },
          total_kg: 1,
          total_pontos: 1
      }},
      { $sort: { total_pontos: -1 } },
      { $limit: 10 }
    ]);

    // Evolução Mensal
    const evolucaoMensal = await Coleta.aggregate([
      { $match: { empresa_id: eid } },
      { $project: { mes: { $substr: ["$data_registro", 0, 7] }, peso_kg: 1 } },
      { $group: { _id: "$mes", total_kg: { $sum: "$peso_kg" }, registros: { $count: {} } } },
      { $project: { mes: "$_id", total_kg: 1, registros: 1, _id: 0 } },
      { $sort: { mes: -1 } },
      { $limit: 12 }
    ]);

    res.json({ totalGeral, porSetor, porMaterial, topFuncionarios, evolucaoMensal });
  } catch (err) {
    console.error('[REPORT ERROR]', err);
    res.status(500).json({ erro: 'Erro ao gerar relatórios' });
  }
});

module.exports = router;
