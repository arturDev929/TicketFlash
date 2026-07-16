# SRS — Especificação de Requisitos de Software
## Projecto: Venda de Bilhetes de Cinema Online (TicketFlash)
**Código:** ONJANGO-DEV-02 · **Versão do documento:** 1.1 · **Base:** Termo de Abertura v1.0

---

## 1. Introdução

### 1.1 Objectivo
Este documento especifica os requisitos funcionais e não funcionais do sistema
TicketFlash — uma plataforma web para venda de bilhetes de cinema online,
composta por uma API REST (backend) e uma aplicação web (frontend), incluindo
um painel de administração para a gestão do cinema.

### 1.2 Âmbito
O sistema permite que:
- **Clientes** consultem o catálogo de filmes em cartaz, vejam sessões
  disponíveis, seleccionem lugares num mapa interactivo, comprem bilhetes e
  consultem o seu histórico de compras (com QR code, exportação em PNG/PDF).
- **Funcionários/Administradores** giram filmes, géneros, salas, sessões,
  utilizadores, consultem relatórios e o histórico de auditoria, e validem
  bilhetes na entrada através de leitura de QR code.

### 1.3 Definições e Abreviaturas
| Termo | Significado |
|---|---|
| RF | Requisito Funcional |
| RNF | Requisito Não Funcional |
| SRS | Software Requirements Specification |
| DER | Diagrama de Entidade-Relacionamento |
| JWT | JSON Web Token (mecanismo de autenticação) |
| CRUD | Create, Read, Update, Delete |

### 1.4 Nota sobre desvios em relação ao Termo de Abertura
O Termo de Abertura (v1.0) fixava Python/Flask + SQLite como stack técnica,
excluía explicitamente "leitor de QR code para validação na entrada" e
"deploy em servidor de produção", e previa um "painel básico de
administração". Ao longo do desenvolvimento e de correcções posteriores, o
sistema evoluiu para:
- **Backend em Node.js/Express com PostgreSQL** (Supabase) em vez de
  Flask/SQLite.
- Inclusão de um **módulo de leitura de QR code** para validação de
  bilhetes na entrada (inicialmente fora do escopo).
- Um **painel de administração completo** (filmes, géneros, salas,
  sessões, ingressos, utilizadores, logs de auditoria, notificações,
  configurações e leitor de QR), além do "básico" previsto.
- Suporte a **deploy num ambiente gerido (Supabase)**, incluindo criação
  automática de schema.

Este SRS documenta o sistema **tal como construído**, assinalando estes
pontos como desvios formais ao Termo de Abertura original, para que sejam
avaliados e aprovados (ou revertidos) pelo coordenador/mentor.

---

## 2. Descrição Geral

### 2.1 Perspectiva do Produto
Sistema cliente-servidor com três camadas:
1. **Frontend** — aplicação React (Vite + TypeScript), consumida por
   clientes finais e pela equipa do cinema (painel `/admin`).
2. **Backend** — API REST em Node.js/Express, responsável por regras de
   negócio, autenticação (JWT) e acesso a dados.
3. **Base de dados** — PostgreSQL (schema documentado em `DER.md` /
   `database/schema.sql`).

### 2.2 Funções do Produto (visão geral)
- Catálogo de filmes e géneros
- Gestão de salas e mapa de lugares
- Gestão de sessões (com máquina de estados: agendada → em_andamento →
  concluída/cancelada)
- Compra de bilhetes com selecção de lugares e geração de QR code
- Histórico de compras do cliente (visão individual e colectiva) com
  exportação em QR, PNG e PDF
- Validação de bilhetes na entrada via leitura de QR code
- Gestão de utilizadores/funcionários (apenas administrador)
- Auditoria (logs) de acções administrativas
- Autenticação e autorização por papel (cliente / funcionário / administrador)

### 2.3 Classes de Utilizador
| Papel | Acesso |
|---|---|
| Visitante (não autenticado) | Consulta catálogo de filmes, sessões e mapa de lugares |
| Cliente | Tudo o anterior + compra de bilhetes, perfil, histórico de bilhetes, alterar senha |
| Funcionário | Painel admin: filmes, géneros, salas, sessões, ingressos, relatórios, logs, leitor de QR |
| Administrador | Tudo o anterior + gestão de utilizadores/funcionários |

### 2.4 Restrições Gerais
- Pagamento simulado — sem integração com gateway de pagamento real
  (conforme Termo de Abertura). O sistema marca a compra como paga
  automaticamente ao concluir o fluxo.
- Sem internacionalização (apenas português).
- Sem aplicação móvel nativa.

---

## 3. Requisitos Funcionais

### 3.1 Catálogo e Sessões

| ID | Requisito | Estado |
|---|---|---|
| RF01 | O sistema deve listar todos os filmes em cartaz com cartaz, título, género, duração e classificação etária. | ✅ Implementado (`GET /movies`, `GET /disponivel`, `/indisponivel`, `/brevemente`, `/destaque`) |
| RF02 | O sistema deve permitir visualizar as sessões disponíveis de um filme por data e horário. | ✅ Implementado (`GET /sessoes-completas/:id_filme`) |
| RF03 | O sistema deve apresentar um mapa de sala com indicação visual de lugares livres e ocupados. | ✅ Implementado (`SeatMap`/`SeatButton`, cores por estado) |
| RF04 | O utilizador deve conseguir seleccionar um ou mais lugares livres antes do checkout. | ✅ Implementado |
| RF05 | O sistema deve validar os dados do comprador antes de confirmar a reserva. | ✅ Implementado — via conta de cliente autenticada (login obrigatório apenas no momento do pagamento; catálogo e mapa de lugares continuam acessíveis sem login) |
| RF06 | Após confirmação, o sistema deve registar a reserva e marcar os lugares como ocupados. | ✅ Implementado (`POST /compras`, tabela `lugares_ocupados`) |
| RF07 | O sistema deve gerar um código de reserva único por compra, visível na página de confirmação. | ✅ Implementado (`numero_factura`, formato `FACT-AAAAMMDD-timestamp`, com QR code associado) |
| RF08 | O painel de administração deve permitir adicionar filmes, sessões e gerir a ocupação de sala. | ✅ Implementado — e ampliado (géneros, salas, utilizadores, logs, leitor de QR) |

### 3.2 Bilhetes e Validação (extensão ao Termo de Abertura)

| ID | Requisito | Estado |
|---|---|---|
| RF09 | O sistema deve gerar um bilhete individual por lugar comprado, associado à compra. | ✅ Implementado (tabela `bilhetes`, `bilhetes_lugares`) |
| RF10 | O cliente deve conseguir consultar o seu histórico de compras, individual e colectivamente. | ✅ Implementado (`/perfil` → aba "Bilhetes") |
| RF11 | O cliente deve conseguir exportar o bilhete em QR, PNG e PDF. | ✅ Implementado |
| RF12 | O funcionário deve conseguir ler o QR code de um bilhete (câmara ou código manual) e validar a entrada. | ✅ Implementado (`GET/PATCH /bilhetes/:id`, módulo "Leitor de QR") |

### 3.3 Gestão e Segurança

| ID | Requisito | Estado |
|---|---|---|
| RF13 | O sistema deve autenticar utilizadores por email/senha (JWT), com papéis distintos (cliente/funcionário/administrador). | ✅ Implementado |
| RF14 | Apenas administradores podem criar/editar/remover contas de utilizadores. | ✅ Implementado (`autorizar('administrador')`) |
| RF15 | O sistema deve registar um histórico de auditoria das acções administrativas (criar/editar/remover filmes, sessões, salas, géneros, utilizadores, alteração de senha). | ✅ Implementado (`logs_funcionarios`, módulo "Logs") |
| RF16 | O utilizador deve conseguir alterar a sua própria senha, informando a senha actual. | ✅ Implementado (cliente e admin) |
| RF17 | O sistema deve impedir a compra de lugares já ocupados ou com reserva pendente (concorrência). | ✅ Implementado (verificação transaccional em `POST /compras`) |
| RF18 | Sessões devem seguir uma máquina de estados fixa (agendada → em_andamento → concluída, ou cancelada a qualquer momento), sem saltos de estado. | ✅ Implementado |

### 3.4 Requisitos Não Funcionais

| ID | Requisito | Estado |
|---|---|---|
| RNF01 | Tempo de resposta inferior a 2 segundos em ambiente local. | ✅ Sem gargalos identificados em uso normal |
| RNF02 | Interface funcional em Chrome e Firefox. | ✅ Testado via build Vite padrão (CSS/JS compatíveis) |
| RNF03 | Código em repositório Git com commits de todos os membros. | ⚠️ Não verificável a partir do código-fonte entregue |
| RNF04 | Documentação técnica (SRS, DER, Postman) entregue ao mentor. | ✅ Este pacote de documentos |
| RNF05 *(novo)* | Senhas devem ser armazenadas com hash (nunca em texto simples). | ✅ Implementado (bcrypt) — corrigido durante a revisão (ver `CHANGELOG_CORRECOES.md`) |
| RNF06 *(novo)* | Rotas de escrita devem exigir autenticação e autorização por papel. | ✅ Implementado — corrigido durante a revisão |

---

## 4. Casos de Uso Principais

### CU01 — Comprar bilhete (cliente)
1. Cliente consulta catálogo de filmes (sem necessidade de login).
2. Escolhe filme → sessão → lugares no mapa interactivo.
3. Ao avançar para pagamento, sistema exige login (redirecciona para
   `/auth` se necessário, preservando a selecção).
4. Cliente escolhe forma de pagamento (simulada) e confirma.
5. Sistema valida disponibilidade dos lugares, regista a compra, gera
   bilhetes individuais e QR code.
6. Cliente pode consultar o bilhete em `/perfil` → "Bilhetes".

### CU02 — Validar bilhete na entrada (funcionário)
1. Funcionário abre "Leitor de QR" no painel admin.
2. Aponta a câmara para o QR do cliente (ou digita o código da fatura).
3. Sistema mostra os dados da compra (filme, sessão, lugares, estado).
4. Funcionário confirma a validação; bilhete passa a "usado".

### CU03 — Gerir sessão (funcionário/administrador)
1. Cria/edita sessão associando filme, sala, data/hora e preço.
2. Sessão nasce no estado "agendada".
3. Ao longo do tempo, o estado transita para "em_andamento" e "concluída",
   ou é cancelada manualmente — nunca salta etapas.

### CU04 — Auditoria (funcionário/administrador)
1. Consulta o módulo "Logs" para ver acções recentes de toda a equipa.
2. Sino de notificações mostra alertas de acções de outros funcionários.

---

## 5. Rastreabilidade (Requisitos → Componentes)

| Requisito | Backend | Frontend |
|---|---|---|
| RF01–RF04 | `routes/get.js` | `pages/films`, `components/seatMap.tsx` |
| RF05–RF07 | `routes/post.js` (`POST /compras`) | `hook/usePayment.ts`, `components/payment/*` |
| RF08 | `routes/post.js`, `put.js`, `delete.js` | `pages/admin/*` |
| RF09–RF12 | `routes/get.js`, `put.js` (`/bilhetes/*`) | `components/meusBilhetes.tsx`, `pages/admin/components/QRScanner.tsx` |
| RF13–RF14 | `routes/login.js`, `middleware/authMiddleware.js` | `contexts/AuthContext.tsx` |
| RF15 | `utils/log.js`, `routes/get.js` (`/logs`) | `pages/admin/components/LogsTable.tsx` |
| RF16 | `routes/post.js` (`/alterar-senha`) | `components/alterarSenhaForm.tsx` |
| RF17–RF18 | `routes/post.js`, `put.js` (transacções, máquina de estados) | `pages/admin/components/SessaoForm.tsx` |

---

## 6. Anexos
- `DER.md` — Diagrama de Entidade-Relacionamento
- `postman_collection.json` — Colecção Postman com todos os endpoints
- `CHANGELOG_CORRECOES.md` — histórico de correcções aplicadas ao sistema
