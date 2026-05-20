# 🔧 Guia de Troubleshooting - Erro 500 no Register Company

## ❌ Problema

```
POST https://ecoscore-backend.vercel.app/api/auth/register-company 500 (Internal Server Error)
```

---

## 🔍 Diagnóstico Rápido

### 1️⃣ Verificar Conexão MongoDB

Acesse em seu navegador (ou Postman):

```
GET /api/auth/diagnostico
```

Você receberá informações como:

```json
{
  "timestamp": "2026-05-20T...",
  "conexao_mongodb": "conectado" ou "desconectado",
  "colecoes": ["admins", "empresas", ...],
  "env_vars": { ... },
  "erros": []
}
```

**Se `conexao_mongodb` for "desconectado":**

- ❌ Verifique se `MONGODB_URI` está configurado
- ❌ Verifique se a URI está correta
- ❌ Verifique permissões IP no MongoDB Atlas

---

## 🛠️ Soluções por Causa

### Causa 1: MONGODB_URI Inválido ou Não Configurado

**Sintomas:**

- `conexao_mongodb: "desconectado (estado: 0)"`
- Logs: `❌ Erro ao conectar ao MongoDB: ...`

**Solução:**

```bash
# 1. Crie o arquivo .env (copie de .env.example)
cp .env.example .env

# 2. Configure a URI corretamente
# MongoDB Local:
MONGODB_URI=mongodb://localhost:27017/ecoscore

# MongoDB Atlas:
MONGODB_URI=mongodb+srv://usuario:senha@cluster.mongodb.net/ecoscore?retryWrites=true&w=majority
```

**Verificar no MongoDB Atlas:**

- ✅ Conta criada em https://www.mongodb.com/cloud/atlas
- ✅ Cluster criado e em execução (status "Running")
- ✅ Usuário criado com permissão "Admin" ou "Read/Write"
- ✅ IP autorizado: Network Access → "Add IP Address" → 0.0.0.0/0 (para desenvolvimento)
- ✅ Connection String copiada corretamente

---

### Causa 2: Erro de Duplicação de Índice

**Sintomas:**

- Logs: `duplicate key error`
- Erro 409: "Este e-mail já está cadastrado"
- ou Erro 500 silencioso

**Solução:**

```bash
# 1. Limpe a coleção "admins" (se houver conflito de índices)
# No MongoDB Atlas:
#   - Vá para Collections
#   - Selecione banco "ecoscore" → coleção "admins"
#   - Delete all documents ou drop collection

# 2. Recrie os índices:
# Reinicie o servidor (índices serão recriados automaticamente)
npm start

# 3. Teste novamente
POST /api/auth/register-company
{
  "nome": "Minha Empresa",
  "email": "novo@email.com",
  "senha": "senha123"
}
```

---

### Causa 3: Timeout em Produção (Vercel)

**Sintomas:**

- Erro 500 intermitente
- Funciona localmente, falha em produção
- Logs: `[REGISTER-COMPANY] ...` incompleto

**Solução:**

```bash
# 1. Aumente timeout do conexão MongoDB
# No Vercel Environment Variables:
# MONGODB_URI=mongodb+srv://...&serverSelectionTimeoutMS=5000&connectTimeoutMS=10000

# 2. Verifique WhiteList de IP:
# MongoDB Atlas → Network Access → Allow from anywhere (0.0.0.0/0)

# 3. Redeploy
vercel --prod
```

---

### Causa 4: Problema com a Seed

**Sintomas:**

- Logs mostram seed iniciando mas não concluindo
- Timeout durante operação de INSERT

**Solução:**

```bash
# 1. Limpe os dados se necessário (drop collections)
# 2. Verifique se há muitos documentos (mais de 100k)
# 3. Separe a seed em chunks menores

# Ou desative a seed automática:
NODE_ENV=test npm start  # Pula a seed
```

---

## 📋 Checklist de Configuração

- [ ] `.env` criado com `MONGODB_URI` correto
- [ ] MongoDB Atlas cluster em execução (status "Running")
- [ ] Usuário MongoDB criado com permissões adequadas
- [ ] IP autorizado no Network Access (0.0.0.0/0 para dev)
- [ ] `SESSION_SECRET` configurado (mínimo 32 caracteres)
- [ ] `FRONTEND_URL` apontando para o frontend correto
- [ ] `NODE_ENV=development` (para desenvolvimento local)
- [ ] Nenhuma coleta "admins" com índices duplicados

---

## 🧪 Teste de Conexão

```bash
# Terminal 1: Inicie o servidor
npm start

# Terminal 2: Teste a conexão
curl http://localhost:3000/api/auth/diagnostico

# Terminal 3: Teste o registro
curl -X POST http://localhost:3000/api/auth/register-company \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "Teste Company",
    "email": "teste@empresa.com",
    "senha": "senha123456"
  }'
```

---

## 📞 Logs Detalhados

Para ver logs completos em desenvolvimento:

```bash
# No server.js, log automático mostra:
# [REGISTER-COMPANY] Requisição recebida: { nome, email }
# [REGISTER-COMPANY] Criando empresa...
# [REGISTER-COMPANY] Empresa criada: <id>
# [REGISTER-COMPANY] Criando admin padrão...
# [REGISTER-COMPANY] Admin criado: <id>

# Se falhar:
# [AUTH ERROR - REGISTER-COMPANY] { message, code, mongooseValidationErrors }
```

---

## 🆘 Ainda Não Funcionando?

1. Acesse: `GET /api/auth/diagnostico`
2. Copie o JSON completo
3. Verifique:
   - `conexao_mongodb` status
   - `indices` da coleção "admins"
   - `erros` array
4. Compartilhe o output (remova credenciais sensíveis)

---

## 🔗 Referências

- [MongoDB Atlas Setup](https://docs.mongodb.com/atlas/getting-started/)
- [Mongoose Índices](<https://mongoosejs.com/docs/api/schema.html#Schema.prototype.index()>)
- [Express Error Handling](https://expressjs.com/en/guide/error-handling.html)
