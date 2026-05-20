const express = require('express');
const { Empresa, Admin, Setor, Funcionario } = require('../database');
const bcrypt = require('bcryptjs');
const router = express.Router();

// Middleware para garantir que é um Super Admin (sem empresa_id)
function authSuper(req, res, next) {
  if (req.session.admin && req.session.admin.empresa_id === null) {
    return next();
  }
  res.status(403).json({ erro: 'Acesso restrito ao Administrador do Sistema' });
}

// GET /api/super/empresas — Listar todas as empresas
router.get('/empresas', authSuper, async (req, res) => {
  try {
    const empresas = await Empresa.aggregate([
      { $lookup: { from: 'setores', localField: '_id', foreignField: 'empresa_id', as: 'setores' } },
      { $lookup: { from: 'funcionarios', localField: '_id', foreignField: 'empresa_id', as: 'funcionarios' } },
      { $project: {
          nome: 1,
          email: 1,
          data_cadastro: 1,
          total_setores: { $size: "$setores" },
          total_funcionarios: { $size: "$funcionarios" }
      }},
      { $sort: { _id: -1 } }
    ]);
    res.json(empresas);
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao listar empresas' });
  }
});

// POST /api/super/empresas — Criar nova empresa (via super admin)
router.post('/empresas', authSuper, async (req, res) => {
  const { nome, email, senha } = req.body;
  if (!nome || !email || !senha) return res.status(400).json({ erro: 'Campos obrigatórios' });

  try {
    const senhaHash = bcrypt.hashSync(senha, 10);
    const empresa = await Empresa.create({
      nome, email, senha: senhaHash
    });
    
    // Criar o admin da empresa automaticamente
    await Admin.create({
      usuario: 'admin', senha: senhaHash, empresa_id: empresa._id
    });

    res.status(201).json({ sucesso: true, id: empresa._id });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ erro: 'E-mail já cadastrado' });
    res.status(500).json({ erro: 'Erro ao cadastrar empresa' });
  }
});

// DELETE /api/super/empresas/:id — Remover empresa e seus dados (Cuidado!)
router.delete('/empresas/:id', authSuper, async (req, res) => {
  const { id } = req.params;
  try {
    await Empresa.findByIdAndDelete(id);
    // Idealmente, deletar dependências aqui também (Setores, Funcionários, etc.)
    res.json({ sucesso: true });
  } catch (err) {
    res.status(500).json({ erro: 'Erro ao remover empresa.' });
  }
});

module.exports = router;
