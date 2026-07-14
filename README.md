# TicketFlash — Backend (API REST)

API REST para venda de bilhetes de cinema online. Node.js + Express +
PostgreSQL (Supabase).

> 📄 Documentação completa: `docs/SRS.md`, `docs/DER.md`,
> `docs/postman_collection.json`, `CHANGELOG_CORRECOES.md`.

## Stack

- **Runtime:** Node.js
- **Framework:** Express 5
- **Base de dados:** PostgreSQL (via `pg`), hospedada no Supabase
- **Autenticação:** JWT (`jsonwebtoken`) + bcrypt
- **Documentação viva:** Swagger (`/api-docs`)

## Estrutura do projecto

```
TicketFlash/
├── index.js                 # Ponto de entrada (Express app, CORS, bootstrap)
├── config/
│   └── swagger.js           # Configuração do Swagger
├── infra/
│   ├── conexao.js           # Pool de ligação ao Postgres
│   └── bootstrap.js         # Cria o schema/admin inicial se a BD estiver vazia
├── middleware/
│   └── authMiddleware.js    # verificarToken (JWT) + autorizar (por papel)
├── routes/                   # Uma rota por domínio/recurso (ver docs/REFACTOR.md)
│   ├── login.js               # POST /login
│   ├── auth.routes.js          # Registo, alterar senha, recuperação de senha
│   ├── filmes.routes.js         # Catálogo de filmes
│   ├── generos.routes.js         # Géneros de filmes
│   ├── salas.routes.js            # Salas e lugares
│   ├── sessoes.routes.js           # Sessões de exibição
│   ├── compras.routes.js            # Compras, bilhetes, validação de QR
│   ├── usuarios.routes.js            # Utilizadores/clientes
│   └── logs.routes.js                 # Auditoria
├── utils/
│   ├── senha.js              # Hash/verificação de senha, geração de códigos
│   ├── log.js                 # Auditoria (logs_funcionarios)
│   ├── email.js               # Envio de emails
│   ├── token.js                # Geração/verificação de JWT
│   └── upload.js               # Upload de ficheiros
├── database/
│   ├── schema.sql             # Schema completo (para BD nova)
│   └── migration_001_fix_schema.sql  # Migração para BD já existente
└── docs/
    ├── SRS.md
    ├── DER.md
    ├── REFACTOR.md
    └── postman_collection.json
```

## Instalação

```bash
npm install
cp .env.example .env   # preencha com os dados do seu Supabase
npm start
```

Na primeira execução, se a base de dados estiver vazia, o servidor cria o
schema automaticamente (ver `infra/bootstrap.js`). Preencha
`ADMIN_BOOTSTRAP_EMAIL`/`ADMIN_BOOTSTRAP_PASSWORD` no `.env` para criar o
primeiro administrador.

## Variáveis de ambiente

Ver `.env.example` para a lista completa e onde encontrar cada valor no
painel do Supabase.

## Autenticação e papéis

| Papel | Pode |
|---|---|
| (sem login) | Ver catálogo de filmes, sessões, mapa de lugares |
| `cliente` | Comprar bilhetes, ver/editar o próprio perfil, ver os próprios bilhetes |
| `funcionario` | Gerir filmes, géneros, salas, sessões; ver logs; validar bilhetes |
| `administrador` | Tudo o anterior + gerir utilizadores/funcionários |

Rotas protegidas usam dois middlewares combináveis:
```js
router.post('/filme', verificarToken, autorizar('funcionario', 'administrador'), handler)
```

## Testando a API

Importe `docs/postman_collection.json` no Postman, defina a variável
`baseUrl` (ex.: `http://localhost:5000`) e `token` (obtido em `POST /login`).

## Scripts

```bash
npm start       # inicia o servidor
```
