# Correções aplicadas — Backend (TicketFlash)

> 📄 Documentação adicional criada nesta revisão: `docs/SRS.md`,
> `docs/DER.md`, `docs/REFACTOR.md`, `docs/postman_collection.json`.


## 🔴 Críticos

1. **`delete.js` não estava montado** → adicionado `app.use('/', deleteRouter)` em `index.js`.
   Todas as rotas DELETE (cancelar sessão, remover sala/filme/género/utilizador) voltaram a funcionar.

2. **CORS**: adicionado `PATCH` à lista de métodos permitidos (faltava, e bloqueava
   `PATCH /sessoes/:id/estado`). Removido o `app.use(cors())` duplicado e sem
   restrições, que anulava a whitelist de origens definida logo acima.

3. **Autenticação/autorização ausente em quase todas as rotas de escrita** — agora
   protegidas com `verificarToken` + `autorizar(...)`:
   - `POST /salas`, `/sessoes`, `/genero`, `/filme` → `funcionario` ou `administrador`
   - `POST /register` → **apenas `administrador`** (antes qualquer utilizador
     autenticado podia criar uma conta de administrador para si mesmo)
   - `POST /compras` → exige login; um `cliente` autenticado só pode comprar em
     nome dele mesmo (o `id_cliente` do corpo é ignorado/substituído nesse caso)
   - `PUT /lugares/:id_lugar`, `/genero/:id`, `/filme/:id`, `/salas/:id`,
     `/sala/:idSala/assentos/:idLugar`, `/sessoes/:id`,
     `PATCH /sessoes/:id/estado`, `DELETE /*` → `funcionario` ou `administrador`
   - `PUT /user/:id`, `/client/:id`, `/ingressos/:id/cancelar`,
     `GET /users/:id_utilizador`, `/client/:id`, `/cliente/:id/compras` →
     exige login; só o próprio dono do recurso ou staff pode aceder
   - `GET /users`, `/compras`, `/compras/estatisticas` → apenas staff

4. **`GET /users` e `/users/:id_utilizador` devolviam `senha_hash`** (hash da
   password) no JSON, sem autenticação nenhuma. Agora selecionam colunas
   explícitas (nunca `senha_hash`) e exigem login de staff.

5. **`GET /users` usava `INNER JOIN funcionarios`**, por isso nunca devolvia
   clientes — só funcionários/administradores. Trocado para `LEFT JOIN`.

6. **Fluxo de compra nunca criava `bilhetes`/`bilhetes_lugares`** — `POST /compras`
   agora cria um bilhete por lugar comprado (com `estado_uso = 'nao_usado'`),
   ligando-o ao lugar via `bilhetes_lugares`.

7. **Nova funcionalidade que faltava por completo**: validação de bilhete na
   entrada do cinema.
   - `GET /bilhetes/:id` (staff) — procura por `id_bilhete`, `id_compra` ou
     `numero_factura`.
   - `PATCH /bilhetes/:id/validar` (staff) — marca o bilhete como `usado` e
     regista `data_uso`. Impede reutilização e uso de bilhete cancelado.

8. **Cancelamento de sessão/compra passou a cancelar também os bilhetes**
   (`DELETE /sessoes/:id`, `PUT /ingressos/:id/cancelar`), o que antes não
   acontecia porque a tabela `bilhetes` nunca era tocada.

9. **Colunas referenciadas que não existiam no schema** (causavam erro SQL em
   runtime): `compras.data_cancelamento`, `compras.valor_reembolsado`,
   `sessoes.data_atualizacao`, `sessoes.data_cancelamento`. Adicionadas em
   `database/schema.sql` e `database/migration_001_fix_schema.sql`.

10. **`RETURNING codigo_lugar` em `lugares_ocupados`** — essa coluna pertence à
    tabela `lugares`, não a `lugares_ocupados`; corrigido com `UPDATE ... FROM`
    fazendo o JOIN correto (em `PUT /ingressos/:id/cancelar`).

## 🟡 Inconsistências de schema vs. código

11. Padronizada a grafia dos estados em todo o backend (o schema já usava a
    forma correta; o código usava uma grafia diferente):
    - `estado_conta`: `activo/inactivo` → `ativo/inativo`
    - `estado_permanente` (lugares): `activo/inactivo` → `ativo/inativo`
    (mantido `manutencao`)
    - `estado_sala`: default `operacional` → `ativa` (alinhado com o schema)
    - `estado_exibicao` (filmes): schema tinha `em_cartaz` (nunca usado) →
      alinhado para `disponivel`, que é o valor real usado em todas as rotas

12. Adicionadas `CHECK constraints` em `database/schema.sql` /
    `migration_001_fix_schema.sql` para todos os campos de estado, que antes
    eram `TEXT` livre sem qualquer validação a nível de base de dados.

13. Removidas referências a uma coluna inexistente `lugares.estado_compra`
    (resíduo de versão antiga do schema).

## 🧹 Limpeza

14. `package.json`: removidas dependências indevidas/mortas — `mysql2` (o
    projeto usa exclusivamente `pg`/Postgres), `bcryptjs` (nunca importado,
    só `bcrypt` é usado), e `fs`/`os`/`path` (módulos nativos do Node, nunca
    deveriam estar listados como dependências npm).

## 📂 Novos ficheiros

- `database/schema.sql` — schema completo corrigido, para criar a base de
  dados do zero.
- `database/migration_001_fix_schema.sql` — script de migração para quem já
  tem a base de dados criada com o script original (`bd.md`).

## 🆕 Criação automática do schema (para novo projeto Supabase)

15. **`infra/bootstrap.js`** — ao arrancar, o servidor verifica se a tabela
    `utilizadores` já existe na base de dados ligada. Se não existir (ex.:
    projeto Supabase novo, ainda vazio), corre automaticamente
    `database/schema.sql` e cria todo o schema. Isto está ligado em
    `index.js`, antes de `app.listen`.

    > Nota: no Supabase, cada projeto já vem com uma base de dados chamada
    > `postgres` criada por padrão — o que normalmente falta não é "a base
    > de dados" em si, mas as tabelas. É isso que esta função cria.

16. **Criação automática do 1º administrador** — como `/register` agora
    exige um `administrador` já autenticado, uma base de dados nova não
    tinha como criar o primeiro (problema do "ovo e da galinha"). Se as
    variáveis `ADMIN_BOOTSTRAP_EMAIL` e `ADMIN_BOOTSTRAP_PASSWORD` estiverem
    definidas no `.env`, o servidor cria esse administrador automaticamente
    no arranque (só se ainda não existir nenhum). Ver `.env.example`.

17. **`.env.example`** criado com todas as variáveis usadas pelo projeto e
    instruções de onde encontrar os valores no painel do Supabase (Project
    Settings → Database).

## 🆕 Máquina de estados de sessões — limpeza de valores legados

18. **`PUT /sessoes/:id`** ainda validava transições usando valores legados
    (`marcada`, `finalizada`) que já não existem no domínio real da coluna
    `estado_sessao` (e violam a `CHECK constraint` adicionada em
    `database/schema.sql`). Corrigido para usar exatamente os mesmos 4
    estados e as mesmas transições válidas do `PATCH /sessoes/:id/estado`:
    `agendada → em_andamento/cancelada`, `em_andamento → concluida/cancelada`,
    `concluida`/`cancelada` são estados finais (sem transição possível).

## 🆕 Senha de cliente gravada em texto puro (login sempre falhava)

19. **`POST /registerClient`** gravava a senha do cliente **diretamente em
    texto puro** na coluna `senha_hash`, sem nunca chamar `bcrypt` — havia
    até um comentário no código reconhecendo isso ("Em produção, use bcrypt
    para hash"). Como o login (`routes/login.js`) usa
    `bcrypt.compare(senha, usuario.senha_hash)`, e uma string em texto puro
    nunca é reconhecida como um hash bcrypt válido, **o login falhava
    sempre** para qualquer cliente que se registasse pelo site.

    Corrigido: agora chama `criptografarSenha()` (bcrypt, já usado em
    `POST /register`) antes de gravar.

    > ⚠️ **Contas já criadas antes desta correção continuam com a senha em
    > texto puro** e não vão conseguir entrar mesmo depois do deploy — a
    > única forma de saber que é texto puro (e não um hash) é o valor não
    > começar com `$2a$`, `$2b$` ou `$2y$`. Para essas contas específicas,
    > o mais simples é apagar e recriar a conta de teste. Se preferir manter
    > os dados, posso preparar um script que identifica e corrige essas
    > contas — é só pedir.

## 🆕 Módulos novos no admin: senha, auditoria e leitor de bilhetes

25. **`POST /alterar-senha` não existia** — a funcionalidade "Alterar Senha"
    do painel admin chamava um endpoint que simplesmente não existia no
    backend (404 sempre). Implementado: exige a senha atual correta
    (`bcrypt.compare`), só permite ao próprio utilizador mudar a sua senha
    (`req.usuario.id === id_utilizador`), grava a nova senha já cifrada, e
    regista a ação em `logs_funcionarios`.

26. **`GET /logs`** (novo) — expõe a tabela `logs_funcionarios` (que já era
    escrita por `post.js`/`put.js`/`delete.js`, mas nunca tinha rota de
    leitura) com o nome/cargo de quem fez cada ação, para o novo módulo de
    auditoria do admin. Acesso restrito a `funcionario`/`administrador`.

27. **`GET /bilhetes/:id` e `PATCH /bilhetes/:id/validar`** já existiam
    (adicionados numa correção anterior) e agora são consumidos por um
    leitor de QR code no admin — ver changelog do frontend.

## 🆕 Refactorização: rotas organizadas por domínio (clean code)

43. **`routes/get.js`, `post.js`, `put.js`, `delete.js` (mais de 8500
    linhas no total, cada ficheiro misturando todos os recursos do
    sistema por estarem organizados por verbo HTTP)** foram divididos em
    ficheiros por **domínio/recurso** — `auth.routes.js`,
    `filmes.routes.js`, `generos.routes.js`, `salas.routes.js`,
    `sessoes.routes.js`, `compras.routes.js`, `usuarios.routes.js`,
    `logs.routes.js`. Nenhuma lógica de negócio foi reescrita: as 45
    rotas foram movidas byte-a-byte, e a extracção foi verificada
    automaticamente (contagem de rotas, sintaxe, resolução de todos os
    `require`, arranque completo do `index.js`). Ver
    `docs/REFACTOR.md` para o mapeamento completo e a metodologia usada.

## 🆕 Bilhetes do cliente: QR code em falta na consulta

37. **`GET /cliente/:id/compras`** não devolvia `qr_code` (a imagem já gerada
    em `POST /compras`), mesmo já existindo na tabela `compras` — por isso o
    front não tinha como mostrar/exportar o QR code do bilhete na página de
    perfil do cliente. Adicionado `c.qr_code` ao `SELECT`/`GROUP BY`.

## ⚠️ Antes de publicar

Execute o script de migração (`database/migration_001_fix_schema.sql`) na
base de dados existente **antes** de fazer deploy deste código — ele depende
das colunas e dos valores de estado padronizados.
