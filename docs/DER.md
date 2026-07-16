# DER — Diagrama de Entidade-Relacionamento
## Projecto: TicketFlash (ONJANGO-DEV-02)

> Este diagrama corresponde ao schema real em `database/schema.sql`.
> Pode ser visualizado em qualquer editor com suporte a Mermaid (GitHub,
> GitLab, VS Code com a extensão "Markdown Preview Mermaid Support",
> [mermaid.live](https://mermaid.live), Obsidian, Notion, etc.).

```mermaid
erDiagram
    UTILIZADORES ||--o| FUNCIONARIOS : "é funcionário"
    UTILIZADORES ||--o{ COMPRAS : "realiza"
    FUNCIONARIOS ||--o{ FILMES : "cadastra"
    FUNCIONARIOS ||--o{ SESSOES : "cria"
    FUNCIONARIOS ||--o{ LOGS_FUNCIONARIOS : "gera"

    FILMES ||--o{ FILMES_GENEROS : "tem"
    GENEROS ||--o{ FILMES_GENEROS : "classifica"
    FILMES ||--o{ SESSOES : "é exibido em"
    FILMES ||--o{ HISTORICO_EXIBICOES : "possui histórico"

    SALAS ||--o{ LUGARES : "contém"
    SALAS ||--o{ SESSOES : "recebe"

    SESSOES ||--o{ COMPRAS : "gera"
    SESSOES ||--o{ BILHETES : "emite"
    SESSOES ||--o{ LUGARES_OCUPADOS : "ocupa"

    COMPRAS ||--o{ BILHETES : "contém"
    COMPRAS ||--o{ LUGARES_OCUPADOS : "reserva"

    BILHETES ||--o{ BILHETES_LUGARES : "associa"
    LUGARES ||--o{ BILHETES_LUGARES : "associa"
    LUGARES ||--o{ LUGARES_OCUPADOS : "é ocupado em"

    UTILIZADORES {
        varchar id_utilizador PK
        varchar nome_completo
        varchar email UK
        varchar senha_hash
        varchar telefone
        text tipo_utilizador "cliente|funcionario|administrador"
        timestamp data_cadastro
        timestamp ultimo_acesso
        text estado_conta "ativo|inativo|bloqueado"
        varchar foto_url
    }

    FUNCIONARIOS {
        varchar id_funcionario PK
        varchar id_utilizador FK
        varchar cargo
        varchar numero_funcionario UK
    }

    GENEROS {
        varchar id_genero PK
        varchar nome_genero UK
        text descricao
    }

    FILMES {
        varchar id_filme PK
        varchar titulo
        text sinopse
        int duracao_minutos
        int ano_lancamento
        text classificacao_etaria
        numeric nota_media
        varchar cartaz_url
        varchar trailer_url
        timestamp data_cadastro
        varchar cadastrado_por FK
        varchar pais_origem
        varchar idioma_original
        text estado_exibicao "disponivel|indisponivel|brevemente"
        boolean destaque
    }

    FILMES_GENEROS {
        varchar id_filme PK_FK
        varchar id_genero PK_FK
    }

    SALAS {
        varchar id_sala PK
        varchar nome_sala
        int capacidade_total
        text tipo_sala
        text estado_sala "ativa|inativa|manutencao"
        int coluna
        int fila
    }

    LUGARES {
        varchar id_lugar PK
        varchar id_sala FK
        varchar codigo_lugar
        varchar fileira
        int numero
        text estado_permanente "ativo|inativo|manutencao"
        int codigo
    }

    SESSOES {
        varchar id_sessao PK
        varchar id_filme FK
        varchar id_sala FK
        timestamp data_hora_inicio
        timestamp data_hora_fim
        varchar tipo_sessao
        numeric preco
        text estado_sessao "agendada|em_andamento|concluida|cancelada"
        varchar criado_por FK
        text observacoes
        timestamp data_atualizacao
        timestamp data_cancelamento
    }

    COMPRAS {
        varchar id_compra PK
        varchar id_cliente FK
        timestamp data_compra
        numeric valor_total
        text forma_pagamento
        text estado_pagamento "pendente|aprovado|cancelado"
        varchar numero_factura UK
        text qr_code
        varchar id_sessao FK
        timestamp data_cancelamento
        numeric valor_reembolsado
    }

    BILHETES {
        varchar id_bilhete PK
        varchar id_compra FK
        varchar id_sessao FK
        numeric preco_pago
        text tipo_bilhete
        text estado_uso "nao_usado|usado|cancelado"
        timestamp data_uso
    }

    BILHETES_LUGARES {
        varchar id_bilhete PK_FK
        varchar id_lugar PK_FK
    }

    LUGARES_OCUPADOS {
        varchar id_lo PK
        varchar id_lugar FK
        varchar id_sessao FK
        varchar status "pendente|ocupado|reservado|cancelado"
        varchar id_sala FK
        timestamptz data_reserva
        varchar id_compra FK
    }

    HISTORICO_EXIBICOES {
        varchar id_historico PK
        varchar id_filme FK
        date data_inicio_exibicao
        date data_fim_exibicao
        int total_sessoes
        int total_bilhetes_vendidos
        numeric receita_total
    }

    LOGS_FUNCIONARIOS {
        varchar id_log PK
        varchar id_funcionario FK
        varchar accao
        varchar tabela_afectada
        varchar registo_id
        timestamp data_accao
        jsonb detalhes
        varchar ip_origem
    }
```

## Notas de modelação

- **`FILMES_GENEROS`** e **`BILHETES_LUGARES`** são tabelas de associação
  N:N (chave primária composta).
- **`LUGARES_OCUPADOS`** representa a ocupação de um lugar **numa sessão
  específica** — o mesmo lugar físico (`LUGARES`) pode estar "ocupado" na
  sessão das 18h e "livre" na sessão das 21h do mesmo dia.
- **`HISTORICO_EXIBICOES`** e **`LOGS_FUNCIONARIOS`** foram identificadas,
  durante a revisão do sistema, como tabelas criadas no schema original
  mas sem nenhuma rota a escrever/ler nelas. `LOGS_FUNCIONARIOS` foi
  corrigida e está em uso (módulo de auditoria); `HISTORICO_EXIBICOES`
  permanece sem uso funcional — candidata a um relatório futuro de
  desempenho de bilheteira por filme.
- Todos os campos de estado (`estado_conta`, `estado_exibicao`,
  `estado_sala`, `estado_permanente`, `estado_sessao`, `estado_pagamento`,
  `estado_uso`, `status`) têm `CHECK constraints` no schema, adicionadas
  durante a revisão (o schema original não validava estes valores ao
  nível da base de dados).
