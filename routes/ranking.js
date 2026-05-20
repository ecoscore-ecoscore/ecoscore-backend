const express = require('express');
const mongoose = require('mongoose');
const { Coleta, Setor } = require('../database');
const router = express.Router();

// GET /api/ranking/funcionarios — ranking geral de funcionários (requer login para saber a empresa)
router.get('/funcionarios', async (req, res) => {
  const empresa_id = req.session.admin?.empresa_id || req.session.setor?.empresa_id || req.session.funcionario?.empresa_id;
  if (!empresa_id) return res.status(401).json({ erro: 'Não autenticado' });

  try {
    const eid = new mongoose.Types.ObjectId(empresa_id);
    const ranking = await Coleta.aggregate([
      { $match: { empresa_id: eid } },
      { $group: {
          _id: { nome: "$funcionario_nome", setor: "$setor_id" },
          total_kg: { $sum: "$peso_kg" },
          total_pontos: { $sum: "$pontos" },
          total_registros: { $count: {} }
      }},
      { $lookup: { from: 'setores', localField: '_id.setor', foreignField: '_id', as: 'setor' } },
      { $project: {
          funcionario_nome: "$_id.nome",
          setor_nome: { $arrayElemAt: ["$setor.nome", 0] },
          total_kg: 1,
          total_pontos: 1,
          total_registros: 1,
          _id: 0
      }},
      { $sort: { total_pontos: -1 } },
      { $limit: 20 }
    ]);
    res.json(ranking);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao gerar ranking de funcionários' });
  }
});

// GET /api/ranking/setores — ranking por setor
router.get('/setores', async (req, res) => {
  const empresa_id = req.session.admin?.empresa_id || req.session.setor?.empresa_id || req.session.funcionario?.empresa_id;
  if (!empresa_id) return res.status(401).json({ erro: 'Não autenticado' });

  try {
    const eid = new mongoose.Types.ObjectId(empresa_id);
    const ranking = await Setor.aggregate([
      { $match: { empresa_id: eid, ativo: 1 } },
      { $lookup: { from: 'coletas', localField: '_id', foreignField: 'setor_id', as: 'coletas' } },
      { $project: {
          id: "$_id",
          nome: 1,
          total_kg: { $sum: "$coletas.peso_kg" },
          total_pontos: { $sum: "$coletas.pontos" },
          total_registros: { $size: "$coletas" }
      }},
      { $sort: { total_pontos: -1 } }
    ]);
    res.json(ranking);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao gerar ranking de setores' });
  }
});

module.exports = router;
