const express = require('express');
const router = express.Router();
const conexao = require('../infra/conexao');
const {verificarToken} = require('../middleware/authMiddleware');

/**
 * @swagger
 * /movies:
 *   get:
 *     summary: Lista todos os filmes
 *     description: Retorna uma lista completa de todos os filmes cadastrados, ordenados por nota média decrescente
 *     tags: [Filmes]
 *     responses:
 *       200:
 *         description: Lista de filmes recuperada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id_filme:
 *                     type: integer
 *                     example: 1
 *                   titulo:
 *                     type: string
 *                     example: O Poderoso Chefão
 *                   sinopse:
 *                     type: string
 *                     example: A família Corleone...
 *                   duracao_minutos:
 *                     type: integer
 *                     example: 175
 *                   ano_lancamento:
 *                     type: integer
 *                     example: 1972
 *                   classificacao_etaria:
 *                     type: string
 *                     example: "16"
 *                   nota_media:
 *                     type: number
 *                     format: float
 *                     example: 9.2
 *                   cartaz_url:
 *                     type: string
 *                     example: https://exemplo.com/cartaz.jpg
 *                   trailer_url:
 *                     type: string
 *                     example: https://youtube.com/watch?v=...
 *                   estado_exibicao:
 *                     type: string
 *                     enum: [EM_CARTAZ, EM_BREVE, EM_CARTAZ_NOS_CINEMAS, EM_EXIBICAO, FINALIZADO]
 *                     example: EM_CARTAZ
 *                   pais_origem:
 *                     type: string
 *                     example: Estados Unidos
 *                   idioma_original:
 *                     type: string
 *                     example: Inglês
 *                   generos:
 *                     type: string
 *                     description: Lista de gêneros concatenada por vírgula
 *                     example: Ação, Drama, Suspense
 *                   total_generos:
 *                     type: integer
 *                     description: Quantidade total de gêneros associados ao filme
 *                     example: 3
 *       500:
 *         description: Erro interno no servidor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 erro:
 *                   type: string
 *                   example: Erro na consulta SQL
 */

router.get('/movies',verificarToken, (req, res) => {    
    const query = `SELECT f.id_filme, f.titulo, f.sinopse, f.duracao_minutos, f.ano_lancamento, f.classificacao_etaria, f.nota_media, f.cartaz_url,f.trailer_url, f.estado_exibicao, f.pais_origem, f.idioma_original, STRING_AGG(g.nome_genero, ', ' ORDER BY g.nome_genero) as generos, COUNT(DISTINCT g.id_genero) as total_generos FROM filmes f LEFT JOIN filmes_generos fg ON f.id_filme = fg.id_filme LEFT JOIN generos g ON g.id_genero = fg.id_genero GROUP BY f.id_filme, f.titulo, f.sinopse, f.duracao_minutos, f.ano_lancamento, f.classificacao_etaria, f.nota_media, f.cartaz_url, f.trailer_url, f.estado_exibicao, f.pais_origem, f.idioma_original ORDER BY f.nota_media DESC`;

    conexao.query(query, (err, results) => {
        if (err) {
            return res.status(500).json({
                erro: err.message
            });
        }
        
        res.json(results);
    });
});

/**
 * @swagger
 * /movies/{id_filme}:
 *   get:
 *     summary: Busca detalhes de um filme específico
 *     tags: [Filmes]
 *     parameters:
 *       - in: path
 *         name: id_filme
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *           pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 *     responses:
 *       200:
 *         description: Sucesso - Filme encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 rows:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/MovieDetail'
 *                 rowCount:
 *                   type: integer
 *                   example: 1
 *             example:
 *               rows:
 *                 - id_filme: "0729f7e0-e31e-4c61-91cd-5809d05419eb"
 *                   titulo: "O Poderoso Chefão"
 *                   sinopse: "A história da família Corleone..."
 *                   duracao_minutos: 175
 *                   ano_lancamento: 1972
 *                   classificacao_etaria: "16"
 *                   nota_media: 9.2
 *                   cartaz_url: "https://exemplo.com/posters/godfather.jpg"
 *                   trailer_url: "https://youtube.com/watch?v=godfather"
 *                   estado_exibicao: "encerrado"
 *                   pais_origem: "EUA"
 *                   idioma_original: "Inglês"
 *                   generos: "Drama, Crime"
 *                   total_generos: 2
 *               rowCount: 1
 *       400:
 *         description: Requisição inválida - Formato de UUID inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               erro: "ID do filme deve ser um UUID válido no formato 8-4-4-4-12"
 *       404:
 *         description: Filme não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               erro: "Filme com ID 0729f7e0-e31e-4c61-91cd-5809d05419eb não encontrado"
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               erro: "Erro na consulta ao banco de dados: connection timeout"
 */

router.get('/movies/:id_filme',verificarToken, (req, res) => { 
    const { id_filme } = req.params;
    
    const query = `SELECT 
        f.id_filme,
        f.titulo,
        f.sinopse,
        f.duracao_minutos,
        f.ano_lancamento,
        f.classificacao_etaria,
        f.nota_media,
        f.cartaz_url,
        f.trailer_url,
        f.estado_exibicao,
        f.pais_origem,
        f.idioma_original,
        STRING_AGG(g.nome_genero, ', ' ORDER BY g.nome_genero) as generos,
        COUNT(DISTINCT g.id_genero) as total_generos
    FROM filmes f
    LEFT JOIN filmes_generos fg ON f.id_filme = fg.id_filme
    LEFT JOIN generos g ON g.id_genero = fg.id_genero
    WHERE f.id_filme = $1
    GROUP BY 
        f.id_filme,
        f.titulo,
        f.sinopse,
        f.duracao_minutos,
        f.ano_lancamento,
        f.classificacao_etaria,
        f.nota_media,
        f.cartaz_url,
        f.trailer_url,
        f.estado_exibicao,
        f.pais_origem,
        f.idioma_original
    ORDER BY f.nota_media DESC`;

    conexao.query(query, [id_filme], (err, results) => {
        if (err) {
            return res.status(500).json({
                erro: err.message
            });
        }
        
        if (!results.rows || results.rows.length === 0) {
            return res.status(404).json({
                erro: `Filme com ID ${id_filme} não encontrado`
            });
        }
        
        res.json(results);
    });
});

/**
 * @swagger
 * /sessoes:
 *   get:
 *     summary: Lista todas as sessões de cinema
 *     description: Retorna uma lista completa de todas as sessões cadastradas no sistema
 *     tags: [Sessões]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de sessões obtida com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 rows:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id_sessao:
 *                         type: string
 *                         format: uuid
 *                         description: ID único da sessão
 *                         example: "123e4567-e89b-12d3-a456-426614174000"
 *                       id_filme:
 *                         type: string
 *                         format: uuid
 *                         description: ID do filme em exibição
 *                         example: "0729f7e0-e31e-4c61-91cd-5809d05419eb"
 *                       id_sala:
 *                         type: string
 *                         format: uuid
 *                         description: ID da sala
 *                         example: "a3b8c9d1-2e4f-4a5b-8c6d-7e9f1a2b3c4d"
 *                       data_hora_inicio:
 *                         type: string
 *                         format: date-time
 *                         description: Data e hora de início
 *                         example: "2024-12-25T14:00:00.000Z"
 *                       data_hora_fim:
 *                         type: string
 *                         format: date-time
 *                         description: Data e hora de fim
 *                         example: "2024-12-25T16:30:00.000Z"
 *                       tipo_sessao:
 *                         type: string
 *                         enum: [2D, 3D, IMAX, 4DX, D-BOX]
 *                         description: Tipo de sessão
 *                         example: "2D"
 *                       preco_base:
 *                         type: number
 *                         format: float
 *                         description: Preço do ingresso comum
 *                         example: 24.90
 *                       preco_vip:
 *                         type: number
 *                         format: float
 *                         description: Preço do ingresso VIP
 *                         example: 49.90
 *                       preco_acessivel:
 *                         type: number
 *                         format: float
 *                         description: Preço do ingresso acessível/meia-entrada
 *                         example: 12.45
 *                       estado_sessao:
 *                         type: string
 *                         enum: [agendada, em_andamento, concluida, cancelada]
 *                         description: Estado atual da sessão
 *                         example: "agendada"
 *                       criado_por:
 *                         type: string
 *                         format: uuid
 *                         description: ID do funcionário que criou
 *                         example: "f47ac10b-58cc-4372-a567-0e02b2c3d479"
 *                       observacoes:
 *                         type: string
 *                         description: Observações adicionais
 *                         nullable: true
 *                         example: "Sessão de Natal"
 *                 rowCount:
 *                   type: integer
 *                   description: Número total de sessões retornadas
 *                   example: 5
 *             example:
 *               rows:
 *                 - id_sessao: "123e4567-e89b-12d3-a456-426614174000"
 *                   id_filme: "0729f7e0-e31e-4c61-91cd-5809d05419eb"
 *                   id_sala: "a3b8c9d1-2e4f-4a5b-8c6d-7e9f1a2b3c4d"
 *                   data_hora_inicio: "2024-12-25T14:00:00.000Z"
 *                   data_hora_fim: "2024-12-25T16:30:00.000Z"
 *                   tipo_sessao: "2D"
 *                   preco_base: 24.90
 *                   preco_vip: 49.90
 *                   preco_acessivel: 12.45
 *                   estado_sessao: "agendada"
 *                   criado_por: "f47ac10b-58cc-4372-a567-0e02b2c3d479"
 *                   observacoes: "Sessão de Natal"
 *                 - id_sessao: "234e5678-f90a-23e4-b567-537725285111"
 *                   id_filme: "1849f7e0-e31e-4c61-91cd-5809d05419eb"
 *                   id_sala: "b4c9d0e2-3f5a-5b6c-9d7e-8f0a2b3c4d5e"
 *                   data_hora_inicio: "2024-12-25T20:00:00.000Z"
 *                   data_hora_fim: "2024-12-25T23:00:00.000Z"
 *                   tipo_sessao: "IMAX"
 *                   preco_base: 49.90
 *                   preco_vip: 89.90
 *                   preco_acessivel: 24.95
 *                   estado_sessao: "agendada"
 *                   criado_por: "f47ac10b-58cc-4372-a567-0e02b2c3d479"
 *                   observacoes: ""
 *               rowCount: 2
 *       401:
 *         description: Não autorizado - Token inválido ou ausente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               erro: "Token não fornecido"
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               erro: "Erro na consulta ao banco de dados: connection timeout"
 */

router.get('/sessoes', verificarToken, (req, res) => {    
    const query = `SELECT titulo, duracao_minutos, ano_lancamento, data_hora_inicio, data_hora_fim, preco_vip,nome_sala,capacidade_total,tipo_sala,estado_sessao,nome_completo,numero_funcionario,estado_sala,sinopse, classificacao_etaria,nota_media,cartaz_url,trailer_url,estado_exibicao,pais_origem,idioma_original FROM filmes f inner join sessoes s on f.id_filme= s.id_filme inner join salas sl on sl.id_sala=s.id_sala inner join funcionarios fr on fr.id_funcionario=s.criado_por inner join utilizadores u on fr.id_utilizador=u.id_utilizador  limit 1000 
`;

    conexao.query(query, (err, results) => {
        if (err) {
            return res.status(500).json({
                erro: err.message
            });
        }

        res.json(results);
    });
});

/**
 * @swagger
 * /sessoes/{id_filme}:
 *   get:
 *     summary: Busca todas as sessões de um filme específico
 *     description: Retorna todas as sessões disponíveis para um filme, incluindo informações do filme, sala e funcionário responsável
 *     tags: [Sessões]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id_filme
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *           pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 *         description: UUID do filme
 *         example: "0729f7e0-e31e-4c61-91cd-5809d05419eb"
 *     responses:
 *       200:
 *         description: Sucesso - Sessões do filme encontradas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 rows:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       titulo:
 *                         type: string
 *                         description: Título do filme
 *                         example: "O Poderoso Chefão"
 *                       duracao_minutos:
 *                         type: integer
 *                         description: Duração do filme em minutos
 *                         example: 175
 *                       ano_lancamento:
 *                         type: integer
 *                         description: Ano de lançamento do filme
 *                         example: 1972
 *                       data_hora_inicio:
 *                         type: string
 *                         format: date-time
 *                         description: Data e hora de início da sessão
 *                         example: "2024-12-25T14:00:00.000Z"
 *                       data_hora_fim:
 *                         type: string
 *                         format: date-time
 *                         description: Data e hora de fim da sessão
 *                         example: "2024-12-25T16:30:00.000Z"
 *                       preco_vip:
 *                         type: number
 *                         format: float
 *                         description: Preço do ingresso VIP
 *                         example: 49.90
 *                       nome_sala:
 *                         type: string
 *                         description: Nome da sala
 *                         example: "Sala 1 - IMAX"
 *                       capacidade_total:
 *                         type: integer
 *                         description: Capacidade total da sala
 *                         example: 150
 *                       tipo_sala:
 *                         type: string
 *                         description: Tipo da sala
 *                         example: "IMAX"
 *                       estado_sessao:
 *                         type: string
 *                         enum: [agendada, em_andamento, concluida, cancelada]
 *                         description: Estado atual da sessão
 *                         example: "agendada"
 *                       nome_completo:
 *                         type: string
 *                         description: Nome completo do funcionário responsável
 *                         example: "João Silva Santos"
 *                       numero_funcionario:
 *                         type: string
 *                         description: Número de identificação do funcionário
 *                         example: "FUNC00123"
 *                       estado_sala:
 *                         type: string
 *                         enum: [disponivel, ocupada, manutencao]
 *                         description: Estado da sala
 *                         example: "disponivel"
 *                       sinopse:
 *                         type: string
 *                         description: Sinopse do filme
 *                         example: "A história da família Corleone..."
 *                       classificacao_etaria:
 *                         type: string
 *                         description: Classificação indicativa do filme
 *                         example: "16"
 *                       nota_media:
 *                         type: number
 *                         format: float
 *                         description: Média das avaliações do filme
 *                         example: 9.2
 *                       cartaz_url:
 *                         type: string
 *                         format: uri
 *                         description: URL do cartaz/poster do filme
 *                         example: "https://exemplo.com/posters/godfather.jpg"
 *                       trailer_url:
 *                         type: string
 *                         format: uri
 *                         description: URL do trailer do filme
 *                         example: "https://youtube.com/watch?v=godfather"
 *                       estado_exibicao:
 *                         type: string
 *                         description: Estado de exibição do filme
 *                         example: "em_cartaz"
 *                       pais_origem:
 *                         type: string
 *                         description: País de origem do filme
 *                         example: "EUA"
 *                       idioma_original:
 *                         type: string
 *                         description: Idioma original do filme
 *                         example: "Inglês"
 *                 rowCount:
 *                   type: integer
 *                   description: Número de sessões encontradas
 *                   example: 3
 *             example:
 *               rows:
 *                 - titulo: "O Poderoso Chefão"
 *                   duracao_minutos: 175
 *                   ano_lancamento: 1972
 *                   data_hora_inicio: "2024-12-25T14:00:00.000Z"
 *                   data_hora_fim: "2024-12-25T16:30:00.000Z"
 *                   preco_vip: 49.90
 *                   nome_sala: "Sala 1 - IMAX"
 *                   capacidade_total: 150
 *                   tipo_sala: "IMAX"
 *                   estado_sessao: "agendada"
 *                   nome_completo: "João Silva Santos"
 *                   numero_funcionario: "FUNC00123"
 *                   estado_sala: "disponivel"
 *                   sinopse: "A história da família Corleone..."
 *                   classificacao_etaria: "16"
 *                   nota_media: 9.2
 *                   cartaz_url: "https://exemplo.com/posters/godfather.jpg"
 *                   trailer_url: "https://youtube.com/watch?v=godfather"
 *                   estado_exibicao: "em_cartaz"
 *                   pais_origem: "EUA"
 *                   idioma_original: "Inglês"
 *                 - titulo: "O Poderoso Chefão"
 *                   duracao_minutos: 175
 *                   ano_lancamento: 1972
 *                   data_hora_inicio: "2024-12-25T20:00:00.000Z"
 *                   data_hora_fim: "2024-12-25T22:30:00.000Z"
 *                   preco_vip: 49.90
 *                   nome_sala: "Sala 2 - 4DX"
 *                   capacidade_total: 120
 *                   tipo_sala: "4DX"
 *                   estado_sessao: "agendada"
 *                   nome_completo: "Maria Oliveira Santos"
 *                   numero_funcionario: "FUNC00456"
 *                   estado_sala: "disponivel"
 *                   sinopse: "A história da família Corleone..."
 *                   classificacao_etaria: "16"
 *                   nota_media: 9.2
 *                   cartaz_url: "https://exemplo.com/posters/godfather.jpg"
 *                   trailer_url: "https://youtube.com/watch?v=godfather"
 *                   estado_exibicao: "em_cartaz"
 *                   pais_origem: "EUA"
 *                   idioma_original: "Inglês"
 *               rowCount: 2
 *       400:
 *         description: Requisição inválida - ID do filme inválido
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               erro: "ID do filme deve ser um UUID válido"
 *       401:
 *         description: Não autorizado - Token inválido ou ausente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               erro: "Token não fornecido"
 *       404:
 *         description: Filme não encontrado ou não possui sessões
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               erro: "Nenhuma sessão encontrada para o filme com ID 0729f7e0-e31e-4c61-91cd-5809d05419eb"
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               erro: "Erro na consulta ao banco de dados: connection timeout"
 */

router.get('/sessoes/:id_filme',verificarToken, (req, res) => {
    const { id_filme } = req.params;

    const query = `SELECT titulo, duracao_minutos, ano_lancamento, data_hora_inicio, data_hora_fim, preco_vip,nome_sala,capacidade_total,tipo_sala,estado_sessao,nome_completo,numero_funcionario,estado_sala,sinopse, classificacao_etaria,nota_media,cartaz_url,trailer_url,estado_exibicao,pais_origem,idioma_original FROM filmes f inner join sessoes s on f.id_filme= s.id_filme inner join salas sl on sl.id_sala=s.id_sala inner join funcionarios fr on fr.id_funcionario=s.criado_por inner join utilizadores u on fr.id_utilizador=u.id_utilizador WHERE f.id_filme = $1`;

    conexao.query(query, [id_filme], (err, results) => {
        if (err) {
            return res.status(500).json({
                erro: err.message
            });
        }

        res.json(results);
    });
});

module.exports = router;