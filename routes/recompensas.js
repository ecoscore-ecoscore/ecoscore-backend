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
  if (!req.session.setor && !req.session.admin && !req.session.funcionario) return res.status(401).json({ erro: 'Não autenticado' });
  next();
}

function getEmpresaId(req) {
  return req.session.admin?.empresa_id || req.session.setor?.empresa_id || req.session.funcionario?.empresa_id;
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

// POST /api/recompensas/resgatar — solicitar resgate (Funcionário ou Setor)
router.post('/resgatar', authAny, async (req, res) => {
  const { funcionario_nome, recompensa_id } = req.body;
  let { empresa_id, setor_id } = getEmpresaId(req); // helper returns ID directly normally, but let's be careful
  
  // Refazendo lógica de pegar IDs da sessão
  const sess = req.session;
  const eid = sess.admin?.empresa_id || sess.setor?.empresa_id || sess.funcionario?.empresa_id;
  const sid = sess.setor?.id || sess.funcionario?.setor_id;

  if (!funcionario_nome || !recompensa_id) {
    return res.status(400).json({ erro: 'Funcionário e recompensa são obrigatórios' });
  }

  try {
    const recompensa = await Recompensa.findOne({ _id: recompensa_id, ativo: 1, empresa_id: eid });
    if (!recompensa) return res.status(404).json({ erro: 'Recompensa não encontrada' });

    // Calcular pontos atuais (Saldo Real = Coletas - Resgates não cancelados)
    let totalPontos = 0;
    const mongoEid = new mongoose.Types.ObjectId(eid);

    if (recompensa.tipo === 'individual') {
      // Soma coletas do funcionário
      const ptsColeta = await Coleta.aggregate([
        { $match: { funcionario_nome, empresa_id: mongoEid } },
        { $group: { _id: null, total: { $sum: "$pontos" } } }
      ]);
      // Soma resgates já feitos (pendentes ou aprovados)
      const ptsResgate = await Resgate.aggregate([
        { $match: { funcionario_nome, empresa_id: mongoEid, status: { $ne: 'cancelado' } } },
        { $group: { _id: null, total: { $sum: "$pontos_usados" } } }
      ]);
      
      totalPontos = (ptsColeta[0]?.total || 0) - (ptsResgate[0]?.total || 0);
    } else {
      if (!sid) return res.status(400).json({ erro: 'Setor não identificado' });
      const mongoSid = new mongoose.Types.ObjectId(sid);
      
      // Soma coletas do setor
      const ptsColeta = await Coleta.aggregate([
        { $match: { setor_id: mongoSid, empresa_id: mongoEid } },
        { $group: { _id: null, total: { $sum: "$pontos" } } }
      ]);
      // Soma resgates do setor (pendentes ou aprovados)
      const ptsResgate = await Resgate.aggregate([
        { $match: { setor_id: mongoSid, empresa_id: mongoEid, status: { $ne: 'cancelado' } } },
        { $group: { _id: null, total: { $sum: "$pontos_usados" } } }
      ]);
      
      totalPontos = (ptsColeta[0]?.total || 0) - (ptsResgate[0]?.total || 0);
    }

    if (totalPontos < recompensa.pontuacao_necessaria) {
      return res.status(400).json({
        erro: 'Pontos insuficientes para solicitar este prêmio',
        saldo_disponivel: totalPontos,
        pontos_necessarios: recompensa.pontuacao_necessaria
      });
    }

    const hoje = new Date().toISOString().split('T')[0];
    const resgate = await Resgate.create({
      funcionario_nome, 
      setor_id: sid, 
      recompensa_id, 
      pontos_usados: recompensa.pontuacao_necessaria, // Grava os pontos no momento do débito
      data_resgate: hoje, 
      empresa_id: eid,
      status: 'pendente'
    });

    res.json({ 
      sucesso: true, 
      mensagem: 'Solicitação de resgate enviada! Aguarde a validação do seu líder de setor.',
      resgate_id: resgate._id 
    });
  } catch (err) {
    console.error('[RESGATE ERROR]', err);
    res.status(500).json({ erro: 'Erro ao processar solicitação de resgate' });
  }
});

// GET /api/recompensas/pendentes — listar resgates pendentes do setor
router.get('/pendentes', authSetor, async (req, res) => {
  const { id: setor_id, empresa_id } = req.session.setor;
  try {
    const pendentes = await Resgate.find({ setor_id, empresa_id, status: 'pendente' })
      .populate('recompensa_id', 'nome pontuacao_necessaria tipo')
      .sort({ _id: -1 });
    res.json(pendentes);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar resgates pendentes' });
  }
});

// PUT /api/recompensas/resgates/:id — aprovar ou cancelar resgate
router.put('/resgates/:id', authSetor, async (req, res) => {
  const { status } = req.body; // 'aprovado' ou 'cancelado'
  const { id: setor_id, empresa_id } = req.session.setor;

  if (!['aprovado', 'cancelado'].includes(status)) {
    return res.status(400).json({ erro: 'Status inválido' });
  }

  try {
    const resgate = await Resgate.findOneAndUpdate(
      { _id: req.params.id, setor_id, empresa_id, status: 'pendente' },
      { status },
      { new: true }
    );

    if (!resgate) return res.status(404).json({ erro: 'Solicitação não encontrada ou já processada' });

    res.json({ sucesso: true, mensagem: `Resgate ${status} com sucesso!` });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao atualizar status do resgate' });
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
