const express = require('express');
const mongoose = require('mongoose');
const { Empresa, Admin, Setor, Funcionario, Coleta, Recompensa, Resgate } = require('../database');
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
          id: "$_id",
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

// DELETE /api/super/empresas/:id — Remover empresa e TODOS os seus dados (Cascata)
router.delete('/empresas/:id', authSuper, async (req, res) => {
  const { id } = req.params;
  const { Admin, Setor, Funcionario, Coleta, Recompensa, Resgate } = require('../database');
  
  try {
    const empresaId = new mongoose.Types.ObjectId(id);

    console.log(`[CASCATA] Iniciando exclusão total da empresa: ${id}`);

    // 1. Deletar todos os dados vinculados
    const resultados = await Promise.all([
      Admin.deleteMany({ empresa_id: empresaId }),
      Setor.deleteMany({ empresa_id: empresaId }),
      Funcionario.deleteMany({ empresa_id: empresaId }),
      Coleta.deleteMany({ empresa_id: empresaId }),
      Recompensa.deleteMany({ empresa_id: empresaId }),
      Resgate.deleteMany({ empresa_id: empresaId }),
      Empresa.findByIdAndDelete(id)
    ]);

    console.log(`[CASCATA] Empresa ${id} e todas as suas dependências foram removidas.`);

    res.json({ 
      sucesso: true, 
      mensagem: 'Empresa e todos os registros associados foram excluídos com sucesso.',
      detalhes: {
        admins: resultados[0].deletedCount,
        setores: resultados[1].deletedCount,
        funcionarios: resultados[2].deletedCount,
        coletas: resultados[3].deletedCount,
        recompensas: resultados[4].deletedCount,
        resgates: resultados[5].deletedCount
      }
    });
  } catch (err) {
    console.error('[DELETE COMPANY ERROR]', err);
    res.status(500).json({ erro: 'Erro ao realizar a exclusão em cascata da empresa.' });
  }
});

module.exports = router;
