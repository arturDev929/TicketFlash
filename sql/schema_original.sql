-- =============================================
-- SCRIPT COMPLETO DE CRIAÇÃO DO BANCO DE DADOS
-- Cinema Database - Supabase
-- =============================================

-- Tabela: utilizadores
CREATE TABLE utilizadores (
id_utilizador VARCHAR PRIMARY KEY,
nome_completo VARCHAR NOT NULL,
email VARCHAR UNIQUE NOT NULL,
senha_hash VARCHAR NOT NULL,
telefone VARCHAR,
tipo_utilizador TEXT NOT NULL,
data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ultimo_acesso TIMESTAMP,
estado_conta TEXT DEFAULT 'ativo',
foto_url VARCHAR
);

-- Tabela: funcionarios
CREATE TABLE funcionarios (
id_funcionario VARCHAR PRIMARY KEY,
id_utilizador VARCHAR UNIQUE NOT NULL,
cargo VARCHAR NOT NULL,
numero_funcionario VARCHAR UNIQUE,
CONSTRAINT fk_funcionario_utilizador
FOREIGN KEY (id_utilizador)
REFERENCES utilizadores(id_utilizador)
ON DELETE CASCADE
);

-- Tabela: generos
CREATE TABLE generos (
id_genero VARCHAR PRIMARY KEY,
nome_genero VARCHAR UNIQUE NOT NULL,
descricao TEXT
);

-- Tabela: filmes
CREATE TABLE filmes (
id_filme VARCHAR PRIMARY KEY,
titulo VARCHAR NOT NULL,
sinopse TEXT,
duracao_minutos INT NOT NULL,
ano_lancamento INT,
classificacao_etaria TEXT,
nota_media NUMERIC(3,1) DEFAULT 0,
cartaz_url VARCHAR,
trailer_url VARCHAR,
data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
cadastrado_por VARCHAR,
pais_origem VARCHAR,
idioma_original VARCHAR,
estado_exibicao TEXT DEFAULT 'em_cartaz',
destaque BOOLEAN DEFAULT FALSE,
CONSTRAINT fk_filme_cadastrado_por
FOREIGN KEY (cadastrado_por)
REFERENCES funcionarios(id_funcionario)
);

-- Tabela: filmes_generos (relacionamento N:N)
CREATE TABLE filmes_generos (
id_filme VARCHAR,
id_genero VARCHAR,
PRIMARY KEY (id_filme, id_genero),
CONSTRAINT fk_fg_filme
FOREIGN KEY (id_filme)
REFERENCES filmes(id_filme)
ON DELETE CASCADE,
CONSTRAINT fk_fg_genero
FOREIGN KEY (id_genero)
REFERENCES generos(id_genero)
ON DELETE CASCADE
);

-- Tabela: salas
CREATE TABLE salas (
id_sala VARCHAR PRIMARY KEY,
nome_sala VARCHAR NOT NULL,
capacidade_total INT NOT NULL,
tipo_sala TEXT NOT NULL,
estado_sala TEXT DEFAULT 'ativa',
coluna INT,
fila INT
);

-- Tabela: lugares
CREATE TABLE lugares (
id_lugar VARCHAR PRIMARY KEY,
id_sala VARCHAR NOT NULL,
codigo_lugar VARCHAR NOT NULL,
fileira VARCHAR,
numero INT,
estado_permanente TEXT DEFAULT 'disponivel',
codigo INT,
CONSTRAINT fk_lugar_sala
FOREIGN KEY (id_sala)
REFERENCES salas(id_sala)
ON DELETE CASCADE,
UNIQUE (id_sala, codigo_lugar)
);

-- Tabela: sessoes
CREATE TABLE sessoes (
id_sessao VARCHAR PRIMARY KEY,
id_filme VARCHAR NOT NULL,
id_sala VARCHAR NOT NULL,
data_hora_inicio TIMESTAMP NOT NULL,
data_hora_fim TIMESTAMP NOT NULL,
tipo_sessao VARCHAR DEFAULT 'normal',
preco NUMERIC(10,2),
estado_sessao TEXT DEFAULT 'agendada',
criado_por VARCHAR,
observacoes TEXT,
CONSTRAINT fk_sessao_filme
FOREIGN KEY (id_filme)
REFERENCES filmes(id_filme)
ON DELETE CASCADE,
CONSTRAINT fk_sessao_sala
FOREIGN KEY (id_sala)
REFERENCES salas(id_sala)
ON DELETE CASCADE,
CONSTRAINT fk_sessao_criado_por
FOREIGN KEY (criado_por)
REFERENCES funcionarios(id_funcionario)
);

-- Tabela: compras
CREATE TABLE compras (
id_compra VARCHAR PRIMARY KEY,
id_cliente VARCHAR NOT NULL,
data_compra TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
valor_total NUMERIC(10,2) NOT NULL,
forma_pagamento TEXT NOT NULL,
estado_pagamento TEXT DEFAULT 'pendente',
numero_factura VARCHAR UNIQUE,
qr_code TEXT,
id_sessao VARCHAR,
CONSTRAINT fk_compra_cliente
FOREIGN KEY (id_cliente)
REFERENCES utilizadores(id_utilizador),
CONSTRAINT fk_compra_sessao
FOREIGN KEY (id_sessao)
REFERENCES sessoes(id_sessao)
);

-- Tabela: bilhetes
CREATE TABLE bilhetes (
id_bilhete VARCHAR PRIMARY KEY,
id_compra VARCHAR NOT NULL,
id_sessao VARCHAR NOT NULL,
preco_pago NUMERIC(10,2) NOT NULL,
tipo_bilhete TEXT DEFAULT 'normal',
estado_uso TEXT DEFAULT 'nao_usado',
data_uso TIMESTAMP,
CONSTRAINT fk_bilhete_compra
FOREIGN KEY (id_compra)
REFERENCES compras(id_compra)
ON DELETE CASCADE,
CONSTRAINT fk_bilhete_sessao
FOREIGN KEY (id_sessao)
REFERENCES sessoes(id_sessao)
);

-- Tabela: bilhetes_lugares (relacionamento N:N)
CREATE TABLE bilhetes_lugares (
id_bilhete VARCHAR,
id_lugar VARCHAR,
PRIMARY KEY (id_bilhete, id_lugar),
CONSTRAINT fk_bl_bilhete
FOREIGN KEY (id_bilhete)
REFERENCES bilhetes(id_bilhete)
ON DELETE CASCADE,
CONSTRAINT fk_bl_lugar
FOREIGN KEY (id_lugar)
REFERENCES lugares(id_lugar)
ON DELETE CASCADE
);

-- Tabela: historico_exibicoes
CREATE TABLE historico_exibicoes (
id_historico VARCHAR PRIMARY KEY,
id_filme VARCHAR NOT NULL,
data_inicio_exibicao DATE NOT NULL,
data_fim_exibicao DATE,
total_sessoes INT DEFAULT 0,
total_bilhetes_vendidos INT DEFAULT 0,
receita_total NUMERIC(10,2) DEFAULT 0,
CONSTRAINT fk_historico_filme
FOREIGN KEY (id_filme)
REFERENCES filmes(id_filme)
ON DELETE CASCADE
);

-- Tabela: logs_funcionarios
CREATE TABLE logs_funcionarios (
id_log VARCHAR PRIMARY KEY,
id_funcionario VARCHAR NOT NULL,
accao VARCHAR NOT NULL,
tabela_afectada VARCHAR,
registo_id VARCHAR,
data_accao TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
detalhes JSONB,
ip_origem VARCHAR,
CONSTRAINT fk_log_funcionario
FOREIGN KEY (id_funcionario)
REFERENCES funcionarios(id_funcionario)
ON DELETE CASCADE
);

-- Tabela: lugares_ocupados
CREATE TABLE lugares_ocupados (
id_lo VARCHAR PRIMARY KEY,
id_lugar VARCHAR NOT NULL,
id_sessao VARCHAR NOT NULL,
status VARCHAR NOT NULL,
id_sala VARCHAR,
data_reserva TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
id_compra VARCHAR,
CONSTRAINT fk_lo_lugar
FOREIGN KEY (id_lugar)
REFERENCES lugares(id_lugar)
ON DELETE CASCADE,
CONSTRAINT fk_lo_sessao
FOREIGN KEY (id_sessao)
REFERENCES sessoes(id_sessao)
ON DELETE CASCADE,
CONSTRAINT fk_lo_sala
FOREIGN KEY (id_sala)
REFERENCES salas(id_sala),
CONSTRAINT fk_lo_compra
FOREIGN KEY (id_compra)
REFERENCES compras(id_compra)
);

-- =============================================
-- ÍNDICES PARA OTIMIZAÇÃO DE PERFORMANCE
-- =============================================

-- Índices para campos frequentemente usados em buscas
CREATE INDEX idx_utilizadores_email ON utilizadores(email);
CREATE INDEX idx_utilizadores_tipo ON utilizadores(tipo_utilizador);
CREATE INDEX idx_utilizadores_estado ON utilizadores(estado_conta);

CREATE INDEX idx_filmes_titulo ON filmes(titulo);
CREATE INDEX idx_filmes_ano ON filmes(ano_lancamento);
CREATE INDEX idx_filmes_destaque ON filmes(destaque);
CREATE INDEX idx_filmes_estado ON filmes(estado_exibicao);

CREATE INDEX idx_sessoes_data_inicio ON sessoes(data_hora_inicio);
CREATE INDEX idx_sessoes_estado ON sessoes(estado_sessao);
CREATE INDEX idx_sessoes_filme ON sessoes(id_filme);
CREATE INDEX idx_sessoes_sala ON sessoes(id_sala);

CREATE INDEX idx_compras_cliente ON compras(id_cliente);
CREATE INDEX idx_compras_data ON compras(data_compra);
CREATE INDEX idx_compras_estado ON compras(estado_pagamento);
CREATE INDEX idx_compras_sessao ON compras(id_sessao);

CREATE INDEX idx_bilhetes_compra ON bilhetes(id_compra);
CREATE INDEX idx_bilhetes_sessao ON bilhetes(id_sessao);
CREATE INDEX idx_bilhetes_estado ON bilhetes(estado_uso);

CREATE INDEX idx_lugares_sala ON lugares(id_sala);
CREATE INDEX idx_lugares_estado ON lugares(estado_permanente);

CREATE INDEX idx_lugares_ocupados_sessao ON lugares_ocupados(id_sessao);
CREATE INDEX idx_lugares_ocupados_lugar ON lugares_ocupados(id_lugar);
CREATE INDEX idx_lugares_ocupados_status ON lugares_ocupados(status);
CREATE INDEX idx_lugares_ocupados_data ON lugares_ocupados(data_reserva);

CREATE INDEX idx_logs_funcionario ON logs_funcionarios(id_funcionario);
CREATE INDEX idx_logs_data ON logs_funcionarios(data_accao);
CREATE INDEX idx_logs_tabela ON logs_funcionarios(tabela_afectada);

-- =============================================
-- COMENTÁRIOS NAS TABELAS (DOCUMENTAÇÃO)
-- =============================================

COMMENT ON TABLE utilizadores IS 'Armazena todos os usuários do sistema';
COMMENT ON TABLE funcionarios IS 'Funcionários que gerenciam o cinema';
COMMENT ON TABLE generos IS 'Gêneros de filmes (Ação, Comédia, etc.)';
COMMENT ON TABLE filmes IS 'Filmes exibidos no cinema';
COMMENT ON TABLE filmes_generos IS 'Relacionamento N:N entre filmes e gêneros';
COMMENT ON TABLE salas IS 'Salas de exibição do cinema';
COMMENT ON TABLE lugares IS 'Lugares dentro de cada sala';
COMMENT ON TABLE sessoes IS 'Sessões de exibição de filmes em salas';
COMMENT ON TABLE compras IS 'Compras de bilhetes pelos clientes';
COMMENT ON TABLE bilhetes IS 'Bilhetes emitidos para cada compra';
COMMENT ON TABLE bilhetes_lugares IS 'Relacionamento N:N entre bilhetes e lugares';
COMMENT ON TABLE historico_exibicoes IS 'Histórico de exibição de filmes';
COMMENT ON TABLE logs_funcionarios IS 'Logs de ações realizadas por funcionários';
COMMENT ON TABLE lugares_ocupados IS 'Controle de ocupação de lugares por sessão';
