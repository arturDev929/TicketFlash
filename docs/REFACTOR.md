# Refactorização do Backend — Organização por Domínio

## Problema

O backend original organizava as rotas por **verbo HTTP**:

```
routes/get.js      (2321 linhas — TODAS as rotas GET de TODOS os recursos)
routes/post.js     (2507 linhas — TODAS as rotas POST)
routes/put.js      (2747 linhas — TODAS as rotas PUT/PATCH)
routes/delete.js    (874 linhas — TODAS as rotas DELETE)
```

Isto tornava difícil qualquer manutenção: para entender ou alterar tudo o
que envolve **sessões**, por exemplo, era preciso procurar em 4 ficheiros
diferentes, cada um com mais de mil linhas de código de recursos não
relacionados misturado no meio.

## Solução aplicada

Reorganização por **domínio/recurso** — cada ficheiro agora contém **todos
os verbos** de **um único recurso**:

| Ficheiro novo | Contém | Rotas |
|---|---|---|
| `routes/auth.routes.js` | Registo, senha | `POST /register`, `POST /registerClient`, `POST /alterar-senha`, `PUT /clientRecuperarSenha`, `PUT /clientSenha/:id` |
| `routes/filmes.routes.js` | Catálogo de filmes | `GET /movies`, `/movies/:id`, `/disponivel`, `/indisponivel`, `/brevemente`, `/destaque`, `POST /filme`, `PUT /filme/:id`, `DELETE /filme/:id` |
| `routes/generos.routes.js` | Géneros | `GET /generos`, `POST /genero`, `PUT /genero/:id`, `DELETE /genero/:id` |
| `routes/salas.routes.js` | Salas e lugares | `GET /salas`, `/sala/:id/assentos`, `POST /salas`, `PUT /salas/:id`, `/sala/:idSala/assentos/:idLugar`, `/lugares/:id_lugar`, `DELETE /salas/:id` |
| `routes/sessoes.routes.js` | Sessões | `GET /sessoes`, `/sessoes-completas/:id_filme`, `POST /sessoes`, `PUT /sessoes/:id`, `PATCH /sessoes/:id/estado`, `DELETE /sessoes/:id` |
| `routes/compras.routes.js` | Compras e bilhetes | `POST /compras`, `GET /compras`, `/compras/estatisticas`, `/cliente/:id/compras`, `/bilhetes/:id`, `PUT /ingressos/:id/cancelar`, `PATCH /bilhetes/:id/validar` |
| `routes/usuarios.routes.js` | Utilizadores | `GET /users`, `/users/:id`, `/client/:id`, `PUT /user/:id`, `/client/:id`, `DELETE /users/:id` |
| `routes/logs.routes.js` | Auditoria | `GET /logs` |
| `routes/login.js` | Autenticação (inalterado) | `POST /login` |

## Como foi feito

A extracção foi feita programaticamente (script Python, descartado após
uso), preservando o texto de cada rota **byte-a-byte** — nenhuma lógica de
negócio foi reescrita nesta etapa, apenas reorganizada. Isto foi verificado
automaticamente:

1. **Contagem de rotas**: as 45 rotas originais (19 GET + 8 POST + 13
   PUT/PATCH + 5 DELETE) foram todas encontradas nos novos ficheiros, sem
   nenhuma duplicada ou em falta.
2. **Sintaxe**: `node --check` em todos os ficheiros novos.
3. **Resolução de módulos**: cada novo ficheiro foi `require`'d
   isoladamente para confirmar que todos os `require(...)` (utils,
   middleware, dependências npm) resolvem correctamente a partir da nova
   localização.
4. **Arranque do servidor**: `index.js` completo foi carregado (`require`)
   de ponta a ponta sem erros de sintaxe, tipo ou módulo em falta — os
   únicos erros observados são timeouts de rede (sem acesso a uma base de
   dados real neste ambiente), não relacionados com a reorganização.

## O que NÃO mudou

- Nenhuma rota, middleware, validação ou query SQL foi alterada nesta
  etapa — o comportamento da API é idêntico ao anterior.
- `index.js` continua a montar tudo na raiz (`app.use('/', router)`),
  porque cada ficheiro já declara o seu caminho completo (ex.:
  `router.get('/movies', ...)`, não `router.get('/', ...)`).

## Próximos passos possíveis (não aplicados nesta etapa)

Para uma manutenção ainda mais fácil, o passo seguinte natural seria
separar, dentro de cada `*.routes.js`, a parte de **routing** (caminho +
middleware) da **lógica de negócio** (camada de "controller"/"service"),
e extrair as queries SQL para um módulo de "repositório" por recurso. Isto
não foi feito agora por ser uma alteração de maior risco (~8500 linhas a
reescrever, não apenas mover) — a organização por domínio já resolve a
maior parte da dificuldade de navegação e manutenção do código.
