const express = require('express');
const mongoose = require('mongoose');
const { Recompensa, Coleta, Resgate } = require('../database');
const router = express.Router();

function authSetor(req, res, next) {
  if (!req.session.setor) return res.status(401).json({ erro: 'Não autenticado' });
  next();
}

function authAdmin(req, res, next) {
  if (!req.session.admin) return res.status(401).json({ erro: 'Acesso administrativo necessário' });
  next();
}
function authAny(req, res, next) {
  if (!req.session.setor && !req.session.admin) return res.status(401).json({ erro: 'Não autenticado' });
  next();
}

function getEmpresaId(req) {
  return req.session.admin?.empresa_id || req.session.setor?.empresa_id;
}

// GET /api/recompensas — lista todas as recompensas (requer estar logado para saber a empresa)
router.get('/', authAny, async (req, res) => {
  const empresa_id = getEmpresaId(req);
  try {
    const recompensas = await Recompensa.find({ ativo: 1, empresa_id }).sort('pontuacao_necessaria');
    res.json(recompensas);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar recompensas' });
  }
});

// POST /api/recompensas/resgatar — resgatar recompensa
router.post('/resgatar', authSetor, async (req, res) => {
  const { funcionario_nome, recompensa_id } = req.body;
  const setor_id = req.session.setor.id;

  if (!funcionario_nome || !recompensa_id) {
    return res.status(400).json({ erro: 'Funcionário e recompensa são obrigatórios' });
  }

  const empresa_id = req.session.setor.empresa_id;
  
  try {
    const recompensa = await Recompensa.findOne({ _id: recompensa_id, ativo: 1, empresa_id });
    if (!recompensa) return res.status(404).json({ erro: 'Recompensa não encontrada' });

    // Calcular pontos do funcionário/setor
    let totalPontos = 0;
    const eid = new mongoose.Types.ObjectId(empresa_id);

    if (recompensa.tipo === 'individual') {
      const pts = await Coleta.aggregate([
        { $match: { funcionario_nome, empresa_id: eid } },
        { $group: { _id: null, total: { $sum: "$pontos" } } }
      ]);
      totalPontos = pts[0]?.total || 0;
    } else {
      const sid = new mongoose.Types.ObjectId(setor_id);
      const pts = await Coleta.aggregate([
        { $match: { setor_id: sid, empresa_id: eid } },
        { $group: { _id: null, total: { $sum: "$pontos" } } }
      ]);
      totalPontos = pts[0]?.total || 0;
    }

    if (totalPontos < recompensa.pontuacao_necessaria) {
      return res.status(400).json({
        erro: 'Pontos insuficientes',
        pontos_atuais: totalPontos,
        pontos_necessarios: recompensa.pontuacao_necessaria
      });
    }

    const hoje = new Date().toISOString().split('T')[0];
    await Resgate.create({
      funcionario_nome, setor_id, recompensa_id, data_resgate: hoje, empresa_id
    });

    res.json({ sucesso: true, mensagem: `Recompensa "${recompensa.nome}" resgatada com sucesso!` });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao resgatar recompensa' });
  }
});

// POST /api/recompensas — criar recompensa (admin)
router.post('/', authAdmin, async (req, res) => {
  const { nome, descricao, pontuacao_necessaria, tipo } = req.body;
  if (!nome || !pontuacao_necessaria || !tipo) return res.status(400).json({ erro: 'Campos obrigatórios faltando' });
  const { empresa_id } = req.session.admin;
  
  try {
    const recompensa = await Recompensa.create({
      nome, descricao: descricao || '', pontuacao_necessaria: parseInt(pontuacao_necessaria), tipo, empresa_id
    });
    res.status(201).json({ sucesso: true, id: recompensa._id });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao criar recompensa' });
  }
});

// PUT /api/recompensas/:id — editar recompensa (admin)
router.put('/:id', authAdmin, async (req, res) => {
  const { nome, descricao, pontuacao_necessaria, tipo } = req.body;
  const { empresa_id } = req.session.admin;
  
  try {
    await Recompensa.findOneAndUpdate({ _id: req.params.id, empresa_id }, {
      nome, descricao: descricao || '', pontuacao_necessaria: parseInt(pontuacao_necessaria), tipo
    });
    res.json({ sucesso: true });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao editar recompensa' });
  }
});

// DELETE /api/recompensas/:id — desativar recompensa (admin)
router.delete('/:id', authAdmin, async (req, res) => {
  const { empresa_id } = req.session.admin;
  try {
    await Recompensa.findOneAndUpdate({ _id: req.params.id, empresa_id }, { ativo: 0 });
    res.json({ sucesso: true });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao desativar recompensa' });
  }
});

module.exports = router;
