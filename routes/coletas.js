const express = require('express');
const { Coleta, Setor } = require('../database');
const router = express.Router();

// Pontuação por material (pts por kg)
const PONTOS_POR_MATERIAL = {
  metal: 10,
  vidro: 7,
  plastico: 5,
  papel: 3
};

function authUser(req, res, next) {
  if (!req.session.setor && !req.session.funcionario) {
    return res.status(401).json({ erro: 'Não autenticado' });
  }
  next();
}

function authAdmin(req, res, next) {
  if (!req.session.admin) return res.status(401).json({ erro: 'Acesso administrativo necessário' });
  next();
}

// GET /api/coletas — coletas vinculadas ao usuário logado (setor ou funcionário)
router.get('/', authUser, async (req, res) => {
  try {
    let filter = {};
    if (req.session.setor) {
      filter = { setor_id: req.session.setor.id, empresa_id: req.session.setor.empresa_id };
    } else if (req.session.funcionario) {
      filter = { funcionario_nome: req.session.funcionario.nome, empresa_id: req.session.funcionario.empresa_id };
    }

    const coletas = await Coleta.find(filter)
      .populate('setor_id', 'nome')
      .sort({ data_registro: -1 })
      .limit(50);

    const result = coletas.map(c => ({
      ...c.toJSON(),
      setor_nome: c.setor_id ? c.setor_id.nome : 'Sem setor'
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar coletas' });
  }
});

// POST /api/coletas — registrar nova coleta
router.post('/', authUser, async (req, res) => {
  let { funcionario_nome, tipo_material, peso_kg, setor_id } = req.body;
  let empresa_id;

  if (req.session.setor) {
    setor_id = req.session.setor.id;
    empresa_id = req.session.setor.empresa_id;
  } else if (req.session.funcionario) {
    funcionario_nome = req.session.funcionario.nome;
    setor_id = req.session.funcionario.setor_id;
    empresa_id = req.session.funcionario.empresa_id;
  }

  if (!funcionario_nome || !tipo_material || !peso_kg || !setor_id) {
    return res.status(400).json({ erro: 'Todos os campos são obrigatórios' });
  }

  const pesoNum = parseFloat(peso_kg);
  if (isNaN(pesoNum) || pesoNum <= 0) {
    return res.status(400).json({ erro: 'Peso inválido' });
  }

  const materialLower = tipo_material.toLowerCase();
  if (!PONTOS_POR_MATERIAL[materialLower]) {
    return res.status(400).json({ erro: 'Tipo de material inválido' });
  }

  try {
    // Verificar duplicata (mesmo funcionário, mesmo material, mesmo dia)
    const hoje = new Date().toISOString().split('T')[0];
    const duplicata = await Coleta.findOne({
      setor_id, funcionario_nome, tipo_material: materialLower, data_registro: hoje, empresa_id
    });

    if (duplicata) {
      return res.status(409).json({ erro: 'Registro duplicado: já existe um registro para este funcionário, material e dia.' });
    }

    const pontos = Math.round(pesoNum * PONTOS_POR_MATERIAL[materialLower]);

    const coleta = await Coleta.create({
      funcionario_nome, setor_id, tipo_material: materialLower, peso_kg: pesoNum, pontos, data_registro: hoje, empresa_id
    });

    res.status(201).json({
      sucesso: true,
      id: coleta._id,
      pontos,
      mensagem: `Coleta registrada! +${pontos} pontos`
    });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao registrar coleta' });
  }
});

// GET /api/coletas/all — todas as coletas (admin)
router.get('/all', authAdmin, async (req, res) => {
  const { busca, setor_id, material, data_inicio, data_fim } = req.query;
  const { empresa_id } = req.session.admin;
  
  const filter = { empresa_id };

  if (busca) filter.funcionario_nome = { $regex: busca, $options: 'i' };
  if (setor_id) filter.setor_id = setor_id;
  if (material) filter.tipo_material = material;
  if (data_inicio || data_fim) {
    filter.data_registro = {};
    if (data_inicio) filter.data_registro.$gte = data_inicio;
    if (data_fim) filter.data_registro.$lte = data_fim;
  }

  try {
    const coletas = await Coleta.find(filter)
      .populate('setor_id', 'nome')
      .sort({ data_registro: -1, _id: -1 });

    const result = coletas.map(c => ({
      ...c.toJSON(),
      setor_nome: c.setor_id ? c.setor_id.nome : 'Sem setor'
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao buscar todas as coletas' });
  }
});

// DELETE /api/coletas/:id — deletar coleta (admin)
router.delete('/:id', authAdmin, async (req, res) => {
  const { empresa_id } = req.session.admin;
  try {
    await Coleta.findOneAndDelete({ _id: req.params.id, empresa_id });
    res.json({ sucesso: true });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao deletar coleta' });
  }
});

module.exports = router;
