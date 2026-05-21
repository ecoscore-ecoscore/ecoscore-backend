const express = require('express');
const mongoose = require('mongoose');
const { Coleta, Setor } = require('../database');
const router = express.Router();

// GET /api/ranking/funcionarios — ranking geral de funcionários (Saldo Disponível)
router.get('/funcionarios', async (req, res) => {
  const empresa_id = req.session.admin?.empresa_id || req.session.setor?.empresa_id || req.session.funcionario?.empresa_id;
  if (!empresa_id) return res.status(401).json({ erro: 'Não autenticado' });

  try {
    const { Coleta, Resgate } = require('../database');
    const eid = new mongoose.Types.ObjectId(empresa_id);

    // 1. Agrupar Total de Pontos Ganhos
    const coletas = await Coleta.aggregate([
      { $match: { empresa_id: eid } },
      { $group: {
          _id: { nome: "$funcionario_nome", setor: "$setor_id" },
          total_kg: { $sum: "$peso_kg" },
          total_ganho: { $sum: "$pontos" },
          total_registros: { $count: {} }
      }}
    ]);

    // 2. Agrupar Total de Pontos Resgatados (Pendente ou Aprovado)
    const resgates = await Resgate.aggregate([
      { $match: { empresa_id: eid, status: { $ne: 'cancelado' } } },
      { $group: {
          _id: "$funcionario_nome",
          total_gasto: { $sum: "$pontos_usados" }
      }}
    ]);

    // 3. Cruzar dados e calcular saldo
    const resgateMap = Object.fromEntries(resgates.map(r => [r._id, r.total_gasto]));
    
    let ranking = coletas.map(c => {
      const gasto = resgateMap[c._id.nome] || 0;
      return {
        funcionario_nome: c._id.nome,
        setor_id: c._id.setor,
        total_kg: c.total_kg,
        total_pontos: Math.max(0, c.total_ganho - gasto), // Saldo Disponível
        total_registros: c.total_registros
      };
    });

    // Populando nomes de setores
    const { Setor } = require('../database');
    const setores = await Setor.find({ empresa_id: eid }).select('nome');
    const setorMap = Object.fromEntries(setores.map(s => [s._id.toString(), s.nome]));

    ranking = ranking.map(r => ({
      ...r,
      setor_nome: setorMap[r.setor_id?.toString()] || 'Sem setor'
    })).sort((a, b) => b.total_pontos - a.total_pontos);

    res.json(ranking.slice(0, 20));
  } catch (err) {
    console.error(err);
    res.status(500).json({ erro: 'Erro ao gerar ranking de funcionários' });
  }
});

// GET /api/ranking/setores — ranking por setor (Saldo Disponível)
router.get('/setores', async (req, res) => {
  const empresa_id = req.session.admin?.empresa_id || req.session.setor?.empresa_id || req.session.funcionario?.empresa_id;
  if (!empresa_id) return res.status(401).json({ erro: 'Não autenticado' });

  try {
    const { Setor, Coleta, Resgate } = require('../database');
    const eid = new mongoose.Types.ObjectId(empresa_id);

    // 1. Total de Coletas por Setor
    const coletas = await Coleta.aggregate([
      { $match: { empresa_id: eid } },
      { $group: {
          _id: "$setor_id",
          total_kg: { $sum: "$peso_kg" },
          total_ganho: { $sum: "$pontos" },
          total_registros: { $count: {} }
      }}
    ]);

    // 2. Total de Resgates por Setor (Pendente ou Aprovado)
    const resgates = await Resgate.aggregate([
      { $match: { empresa_id: eid, status: { $ne: 'cancelado' } } },
      { $group: {
          _id: "$setor_id",
          total_gasto: { $sum: "$pontos_usados" }
      }}
    ]);

    const coletasMap = Object.fromEntries(coletas.map(c => [c._id?.toString(), c]));
    const resgatesMap = Object.fromEntries(resgates.map(r => [r._id?.toString(), r.total_gasto]));

    const setores = await Setor.find({ empresa_id: eid, ativo: 1 });
    
    const ranking = setores.map(s => {
      const c = coletasMap[s._id.toString()] || { total_kg: 0, total_ganho: 0, total_registros: 0 };
      const gasto = resgatesMap[s._id.toString()] || 0;
      
      return {
        id: s._id,
        nome: s.nome,
        total_kg: c.total_kg,
        total_pontos: Math.max(0, c.total_ganho - gasto), // Saldo Disponível
        total_registros: c.total_registros
      };
    }).sort((a, b) => b.total_pontos - a.total_pontos);

    res.json(ranking);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao gerar ranking de setores' });
  }
});

module.exports = router;
