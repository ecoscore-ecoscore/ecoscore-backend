# EcoScore - Backend API

API Node.js/Express para o sistema de gestão de resíduos recicláveis EcoScore.

## 🚀 Setup Local

```bash
# 1. Instalar dependências
npm install

# 2. Criar arquivo .env (copie de .env.example)
cp .env.example .env

# 3. Adicionar suas credenciais MongoDB
# MONGODB_URI=mongodb+srv://seu_usuario:sua_senha@seu_cluster.mongodb.net/?appName=ecoscore

# 4. Rodar servidor
npm start
```

O servidor estará em `http://localhost:3000`

---

## 🌐 Variáveis de Ambiente

| Variável         | Descrição                         | Exemplo                           |
| ---------------- | --------------------------------- | --------------------------------- |
| `MONGODB_URI`    | String de conexão MongoDB Atlas   | `mongodb+srv://...`               |
| `SESSION_SECRET` | Chave de segurança para sessões   | `sua-chave-secreta`               |
| `FRONTEND_URL`   | URL do frontend em produção       | `https://seu-frontend.vercel.app` |
| `NODE_ENV`       | Ambiente (development/production) | `production`                      |
| `PORT`           | Porta do servidor                 | `3000`                            |

---

## 📚 Rotas da API

### Autenticação

- `POST /api/auth/login` - Login único (detecta tipo automaticamente)
- `POST /api/auth/register-company` - Registrar nova empresa
- `POST /api/auth/logout` - Fazer logout
- `GET /api/auth/test-credentials` - Credenciais de teste
- `GET /api/auth/status` - Status do banco e seed automático

### Coletas

- `GET /api/coletas` - Listar coletas do setor autenticado
- `POST /api/coletas` - Registrar nova coleta
- `GET /api/coletas/all` - Todas as coletas (admin)

### Ranking

- `GET /api/ranking/funcionarios` - Ranking de funcionários
- `GET /api/ranking/setores` - Ranking de setores

### Recompensas

- `GET /api/recompensas` - Listar recompensas
- `POST /api/recompensas/resgatar` - Resgatar recompensa

### Admin

- `GET /api/admin/setores` - Listar setores
- `GET /api/admin/funcionarios` - Listar funcionários
- `POST /api/admin/setores` - Criar setor
- `POST /api/admin/funcionarios` - Criar funcionário

### Super Admin

- `GET /api/super/empresas` - Listar empresas
- `GET /api/super/relatorios` - Relatórios gerais

### Sessão

- `GET /api/me` - Dados do usuário logado

---

## 🔑 Credenciais de Teste

| Tipo          | Usuário             | Senha            | Acesso              |
| ------------- | ------------------- | ---------------- | ------------------- |
| Empresa/Admin | `demo@ecoscore.com` | `demo123`        | `/admin.html`       |
| Setor         | `marketing`         | `ecoscore123`    | `/dashboard.html`   |
| Funcionário   | `ana@demo.com`      | `funcionario123` | `/user.html`        |
| Super Admin   | `eco_master`        | `eco123`         | `/super-admin.html` |

---

## 🔧 Deploy na Vercel

1. **Conectar repositório:**

   ```
   Vercel → Add New → Project → Conectar repositório
   ```

2. **Configurar Root Directory:**

   ```
   Root Directory: . (raiz do repositório)
   ```

3. **Adicionar Environment Variables:**

   ```
   MONGODB_URI=mongodb+srv://...
   SESSION_SECRET=sua-chave-secreta
   FRONTEND_URL=https://seu-frontend.vercel.app
   NODE_ENV=production
   PORT=3000
   ```

4. **Deploy:**
   ```
   Clique em Deploy
   ```

---

## 🛠️ Estrutura do Projeto

```
├── server.js              # Servidor principal
├── database.js            # Schemas e modelos MongoDB
├── routes/
│   ├── auth.js            # Autenticação
│   ├── coletas.js         # Coletas de resíduos
│   ├── ranking.js         # Rankings
│   ├── recompensas.js     # Recompensas e resgates
│   ├── admin.js           # Funções admin
│   └── super.js           # Super admin
├── package.json
├── .env.example
└── README.md
```

---

## 🐛 Troubleshooting

### MongoDB não conecta

- Verifique `MONGODB_URI` em `.env`
- Adicione IP `0.0.0.0/0` no MongoDB Atlas → Network Access
- Teste: `npm start`

### CORS bloqueando

- Verifique `FRONTEND_URL` em `.env`
- Deve ser a URL exata do frontend (com https:// em produção)

### Erro 500 no login

- Verifique logs: `npm start`
- Consulte `/api/auth/test-credentials` para credenciais válidas

---

## 📞 Suporte

Para problemas, consulte os logs:

- Desenvolvimento: `npm start` (mostra logs no terminal)
- Produção (Vercel): Dashboard → Deployments → Logs

---

**Status:** ✅ Pronto para produção
