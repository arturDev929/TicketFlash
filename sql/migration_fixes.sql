-- =============================================
-- MIGRAÇÃO DE CORREÇÃO — TicketFlash
-- Corrige inconsistências encontradas entre o script
-- de criação original (bd.md) e o código do backend.
-- Executar UMA VEZ sobre uma base de dados já existente.
-- =============================================

-- ---------------------------------------------
-- 1) Colunas que o código usa mas não existiam
-- ---------------------------------------------

ALTER TABLE compras
    ADD COLUMN IF NOT EXISTS data_cancelamento TIMESTAMP,
    ADD COLUMN IF NOT EXISTS valor_reembolsado NUMERIC(10,2);

ALTER TABLE sessoes
    ADD COLUMN IF NOT EXISTS data_atualizacao TIMESTAMP,
    ADD COLUMN IF NOT EXISTS data_cancelamento TIMESTAMP;

-- ---------------------------------------------
-- 2) Corrigir DEFAULTs para bater com os valores
--    que o backend realmente grava
-- ---------------------------------------------

ALTER TABLE utilizadores
    ALTER COLUMN estado_conta SET DEFAULT 'ativo';

ALTER TABLE lugares
    ALTER COLUMN estado_permanente SET DEFAULT 'ativo';

ALTER TABLE salas
    ALTER COLUMN estado_sala SET DEFAULT 'ativa';

ALTER TABLE filmes
    ALTER COLUMN estado_exibicao SET DEFAULT 'disponivel';

-- Normalizar eventuais linhas antigas gravadas com a grafia incorreta
UPDATE utilizadores SET estado_conta = 'ativo' WHERE estado_conta = 'activo';
UPDATE utilizadores SET estado_conta = 'inativo' WHERE estado_conta = 'inactivo';
UPDATE lugares SET estado_permanente = 'ativo' WHERE estado_permanente = 'activo';
UPDATE lugares SET estado_permanente = 'inativo' WHERE estado_permanente = 'inactivo';
UPDATE sessoes SET estado_sessao = 'agendada' WHERE estado_sessao = 'marcada';

-- ---------------------------------------------
-- 3) CHECK constraints — antes disto, qualquer
--    texto podia ser gravado nestes campos
-- ---------------------------------------------

ALTER TABLE utilizadores
    DROP CONSTRAINT IF EXISTS chk_utilizadores_estado_conta,
    ADD CONSTRAINT chk_utilizadores_estado_conta
        CHECK (estado_conta IN ('ativo', 'inativo', 'bloqueado'));

ALTER TABLE utilizadores
    DROP CONSTRAINT IF EXISTS chk_utilizadores_tipo,
    ADD CONSTRAINT chk_utilizadores_tipo
        CHECK (tipo_utilizador IN ('cliente', 'funcionario', 'administrador'));

ALTER TABLE lugares
    DROP CONSTRAINT IF EXISTS chk_lugares_estado_permanente,
    ADD CONSTRAINT chk_lugares_estado_permanente
        CHECK (estado_permanente IN ('ativo', 'inativo', 'manutencao'));

ALTER TABLE salas
    DROP CONSTRAINT IF EXISTS chk_salas_estado_sala,
    ADD CONSTRAINT chk_salas_estado_sala
        CHECK (estado_sala IN ('ativa', 'inativa', 'manutencao'));

ALTER TABLE filmes
    DROP CONSTRAINT IF EXISTS chk_filmes_estado_exibicao,
    ADD CONSTRAINT chk_filmes_estado_exibicao
        CHECK (estado_exibicao IN ('disponivel', 'indisponivel', 'brevemente'));

ALTER TABLE filmes
    DROP CONSTRAINT IF EXISTS chk_filmes_classificacao,
    ADD CONSTRAINT chk_filmes_classificacao
        CHECK (classificacao_etaria IN ('L', '6', '12', '14', '16', '18'));

ALTER TABLE sessoes
    DROP CONSTRAINT IF EXISTS chk_sessoes_estado,
    ADD CONSTRAINT chk_sessoes_estado
        CHECK (estado_sessao IN ('agendada', 'em_andamento', 'concluida', 'cancelada'));

ALTER TABLE compras
    DROP CONSTRAINT IF EXISTS chk_compras_forma_pagamento,
    ADD CONSTRAINT chk_compras_forma_pagamento
        CHECK (forma_pagamento IN ('cartao_credito', 'cartao_debito', 'dinheiro', 'pix', 'multicaixa'));

ALTER TABLE compras
    DROP CONSTRAINT IF EXISTS chk_compras_estado_pagamento,
    ADD CONSTRAINT chk_compras_estado_pagamento
        CHECK (estado_pagamento IN ('pendente', 'aprovado', 'cancelado', 'reembolsado'));

ALTER TABLE bilhetes
    DROP CONSTRAINT IF EXISTS chk_bilhetes_estado_uso,
    ADD CONSTRAINT chk_bilhetes_estado_uso
        CHECK (estado_uso IN ('nao_usado', 'usado', 'cancelado'));

ALTER TABLE lugares_ocupados
    DROP CONSTRAINT IF EXISTS chk_lugares_ocupados_status,
    ADD CONSTRAINT chk_lugares_ocupados_status
        CHECK (status IN ('pendente', 'reservado', 'ocupado', 'cancelado'));
