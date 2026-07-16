-- =============================================
-- MIGRAÇÃO: corrige o schema original (bd.md) para
-- ficar alinhado com o que o backend realmente usa.
-- Execute este script UMA VEZ na base de dados existente.
-- =============================================

-- 1) Colunas em falta usadas pelo backend (causavam erro "column does not exist")
ALTER TABLE compras ADD COLUMN IF NOT EXISTS data_cancelamento TIMESTAMP;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS valor_reembolsado NUMERIC(10,2);

ALTER TABLE sessoes ADD COLUMN IF NOT EXISTS data_atualizacao TIMESTAMP;
ALTER TABLE sessoes ADD COLUMN IF NOT EXISTS data_cancelamento TIMESTAMP;

-- 2) Corrigir valores existentes para a grafia padronizada usada pelo código
--    (execute antes de aplicar os CHECK constraints abaixo)
UPDATE utilizadores SET estado_conta = 'ativo'   WHERE estado_conta = 'activo';
UPDATE utilizadores SET estado_conta = 'inativo' WHERE estado_conta = 'inactivo';

UPDATE lugares SET estado_permanente = 'ativo'   WHERE estado_permanente = 'activo';
UPDATE lugares SET estado_permanente = 'inativo' WHERE estado_permanente = 'inactivo';
UPDATE lugares SET estado_permanente = 'ativo'   WHERE estado_permanente = 'disponivel';

UPDATE salas SET estado_sala = 'ativa' WHERE estado_sala = 'operacional';

UPDATE filmes SET estado_exibicao = 'disponivel' WHERE estado_exibicao = 'em_cartaz';

-- 3) Ajustar DEFAULTs para os valores corretos
ALTER TABLE utilizadores ALTER COLUMN estado_conta SET DEFAULT 'ativo';
ALTER TABLE lugares ALTER COLUMN estado_permanente SET DEFAULT 'ativo';
ALTER TABLE salas ALTER COLUMN estado_sala SET DEFAULT 'ativa';
ALTER TABLE filmes ALTER COLUMN estado_exibicao SET DEFAULT 'disponivel';

-- 4) Adicionar CHECK constraints (campos eram TEXT livre, sem validação)
ALTER TABLE utilizadores ADD CONSTRAINT chk_utilizadores_tipo
  CHECK (tipo_utilizador IN ('cliente', 'funcionario', 'administrador'));
ALTER TABLE utilizadores ADD CONSTRAINT chk_utilizadores_estado
  CHECK (estado_conta IN ('ativo', 'inativo', 'bloqueado'));

ALTER TABLE filmes ADD CONSTRAINT chk_filmes_estado_exibicao
  CHECK (estado_exibicao IN ('disponivel', 'indisponivel', 'brevemente'));

ALTER TABLE salas ADD CONSTRAINT chk_salas_estado
  CHECK (estado_sala IN ('ativa', 'inativa', 'manutencao'));

ALTER TABLE lugares ADD CONSTRAINT chk_lugares_estado
  CHECK (estado_permanente IN ('ativo', 'inativo', 'manutencao'));

ALTER TABLE sessoes ADD CONSTRAINT chk_sessoes_estado
  CHECK (estado_sessao IN ('agendada', 'em_andamento', 'concluida', 'cancelada'));

ALTER TABLE compras ADD CONSTRAINT chk_compras_estado
  CHECK (estado_pagamento IN ('pendente', 'aprovado', 'cancelado'));

ALTER TABLE bilhetes ADD CONSTRAINT chk_bilhetes_estado
  CHECK (estado_uso IN ('nao_usado', 'usado', 'cancelado'));

ALTER TABLE lugares_ocupados ADD CONSTRAINT chk_lugares_ocupados_status
  CHECK (status IN ('pendente', 'ocupado', 'reservado', 'cancelado'));
