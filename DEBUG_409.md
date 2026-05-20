# 🔴 Erro 409: Conflict ao Registrar Empresa

## ❌ Problema

```
POST https://ecoscore-backend.vercel.app/api/auth/register-company 409 (Conflict)
Erro: Este e-mail já está cadastrado
```

---

## 🔍 Causas Possíveis

| Causa                          | Sintoma                                    | Solução                         |
| ------------------------------ | ------------------------------------------ | ------------------------------- |
| **E-mail duplicado**           | Você tenta registrar com o mesmo e-mail 2x | Use um e-mail diferente         |
| **Índice quebrado no MongoDB** | Erro mesmo com e-mail novo                 | Reset dos índices (veja abaixo) |
| **Dados de seed não limpados** | "admin@admin.com" já existe                | Limpar a coleção e recriar      |

---

## 🛠️ Solução Rápida (3 Passos)

### 1️⃣ Verifique as Empresas Existentes

```bash
# Acesse em seu navegador:
GET https://seu-dominio/api/auth/debug/empresas
```

Exemplo de resposta:

```json
{
  "empresas": [
    {
      "_id": "507f1f77...",
      "nome": "Primeira Empresa",
      "email": "empresa1@test.com",
      "admin": "admin"
    }
  ],
  "total": 1
}
```

**Se o e-mail que você tentou registrar já está lá:** Use um e-mail diferente!

---

### 2️⃣ Verifique os Índices

```bash
# Acesse em seu navegador:
GET https://seu-dominio/api/auth/debug/indices
```

Exemplo de resposta:

```json
{
  "indices": {
    "admins": [
      {
        "nome": "_id_",
        "campos": { "_id": 1 },
        "unique": false
      },
      {
        "nome": "usuario_1_empresa_id_1",
        "campos": { "usuario": 1, "empresa_id": 1 },
        "unique": true
      }
    ]
  }
}
```

**Se houver índices duplicados ou errados:** Vá para o Passo 3

---

### 3️⃣ Reset dos Índices (APENAS DESENVOLVIMENTO)

> ⚠️ **APENAS funciona em NODE_ENV=development**

```bash
# Via curl:
curl -X POST https://seu-dominio/api/auth/debug/reset-admin-index

# Via JavaScript (browser console):
fetch('/api/auth/debug/reset-admin-index', { method: 'POST' })
  .then(r => r.json())
  .then(data => console.log(data))
```

Resposta esperada:

```json
{
  "sucesso": true,
  "mensagem": "Índices ressetados com sucesso",
  "indicesBefore": ["_id_", "usuario_1_empresa_id_1", "usuario_1"],
  "indicesAfter": ["_id_", "usuario_1_empresa_id_1"]
}
```

Agora tente registrar novamente com um **e-mail novo**!

---

## 🧹 Solução Completa (Limpar Banco e Recomeçar)

Se os passos acima não funcionarem, limpe o banco:

### Via MongoDB Atlas (Web)

1. Acesse [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Selecione seu cluster → **Collections**
3. Selecione banco `ecoscore`
4. **Para cada coleção** (empresas, admins, setores, etc):
   - Clique em `...` → **Delete All Documents**
   - Confirme

5. Reinicie seu servidor:

   ```bash
   npm start
   ```

6. O seed automático recriará os dados padrão

### Via Mongoose (Terminal)

```bash
# Crie um arquivo cleanup.js:
const mongoose = require('mongoose');
const { Empresa, Admin } = require('./database');

async function cleanup() {
  await Empresa.deleteMany({});
  await Admin.deleteMany({});
  console.log('✅ Documentos deletados');
  process.exit(0);
}

cleanup();

# Execute:
node cleanup.js
```

---

## 🧪 Teste de Registro Bem-Sucedido

Após limpar, teste com curl ou Postman:

```bash
curl -X POST http://localhost:3000/api/auth/register-company \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "Teste Empresa",
    "email": "novo-email-'$(date +%s)'@test.com",
    "senha": "senha123456"
  }'
```

Resposta esperada:

```json
{
  "sucesso": true,
  "mensagem": "Empresa cadastrada com sucesso",
  "empresa_id": "507f1f77bcf86cd799439011"
}
```

---

## 📋 Checklist de Verificação

- [ ] Cada e-mail é único (sem duplicatas)
- [ ] Índices estão corretos: `usuario_1_empresa_id_1`
- [ ] NODE_ENV está em "development" (não "production")
- [ ] MongoDB está conectado e acessível
- [ ] Permissões de IP no MongoDB Atlas (0.0.0.0/0)
- [ ] Nenhuma tentativa com o mesmo e-mail

---

## 🆘 Ainda com Problema?

1. Execute: `GET /api/auth/debug/empresas`
2. Execute: `GET /api/auth/debug/indices`
3. Copie ambas as respostas (remova emails sensíveis)
4. Compartilhe os logs do servidor

---

## 💡 Resumo

| Operação              | URL                                      |
| --------------------- | ---------------------------------------- |
| **Listar empresas**   | `GET /api/auth/debug/empresas`           |
| **Verificar índices** | `GET /api/auth/debug/indices`            |
| **Reset índices**     | `POST /api/auth/debug/reset-admin-index` |
| **Status banco**      | `GET /api/auth/status`                   |
| **Diagnóstico geral** | `GET /api/auth/diagnostico`              |
