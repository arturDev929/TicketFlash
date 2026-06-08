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

router.get('/movies', (req, res) => {    
    const query = `SELECT f.id_filme, f.titulo, f.sinopse as descricao, f.duracao_minutos, f.ano_lancamento, f.classificacao_etaria, f.nota_media as nota, f.cartaz_url as img,f.trailer_url, f.estado_exibicao, f.pais_origem, f.idioma_original, STRING_AGG(g.nome_genero, ', ' ORDER BY g.nome_genero) as generos, COUNT(DISTINCT g.id_genero) as total_generos FROM filmes f LEFT JOIN filmes_generos fg ON f.id_filme = fg.id_filme LEFT JOIN generos g ON g.id_genero = fg.id_genero GROUP BY f.id_filme, f.titulo, f.sinopse, f.duracao_minutos, f.ano_lancamento, f.classificacao_etaria, f.nota_media, f.cartaz_url, f.trailer_url, f.estado_exibicao, f.pais_origem, f.idioma_original ORDER BY f.nota_media DESC`;

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

router.get('/movies/:id_filme', (req, res) => { 
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

router.get('/sessoes', (req, res) => {    
    const query = `SELECT titulo, duracao_minutos, ano_lancamento, data_hora_inicio, data_hora_fim, preco,nome_sala,capacidade_total,tipo_sala,estado_sessao,nome_completo,numero_funcionario,estado_sala,sinopse, classificacao_etaria,nota_media,cartaz_url,trailer_url,estado_exibicao,pais_origem,idioma_original FROM filmes f inner join sessoes s on f.id_filme= s.id_filme inner join salas sl on sl.id_sala=s.id_sala inner join funcionarios fr on fr.id_funcionario=s.criado_por inner join utilizadores u on fr.id_utilizador=u.id_utilizador  limit 1000 
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
 *         description: UUID do filme
 *         example: "2c1c349c-b282-45fa-a6da-a83a8e5bad3c"
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
 *                       duracao_minutos:
 *                         type: integer
 *                       ano_lancamento:
 *                         type: integer
 *                       data_hora_inicio:
 *                         type: string
 *                         format: date-time
 *                       data_hora_fim:
 *                         type: string
 *                         format: date-time
 *                       preco:
 *                         type: number
 *                       nome_sala:
 *                         type: string
 *                       capacidade_total:
 *                         type: integer
 *                       tipo_sala:
 *                         type: string
 *                       estado_sessao:
 *                         type: string
 *                       nome_completo:
 *                         type: string
 *                       numero_funcionario:
 *                         type: string
 *                       estado_sala:
 *                         type: string
 *                       sinopse:
 *                         type: string
 *                       classificacao_etaria:
 *                         type: string
 *                       nota_media:
 *                         type: number
 *                       cartaz_url:
 *                         type: string
 *                       trailer_url:
 *                         type: string
 *                       estado_exibicao:
 *                         type: string
 *                       pais_origem:
 *                         type: string
 *                       idioma_original:
 *                         type: string
 *                       codigos_lugar:
 *                         type: string
 *                         description: Códigos dos lugares concatenados
 *                       codigos:
 *                         type: string
 *                         description: Códigos concatenados
 *                 rowCount:
 *                   type: integer
 *             example:
 *               rows: [
 *                 {
 *                   titulo: "A Origem",
 *                   duracao_minutos: 148,
 *                   ano_lancamento: 2010,
 *                   data_hora_inicio: "2024-12-25T14:00:00.000Z",
 *                   data_hora_fim: "2024-12-25T16:28:00.000Z",
 *                   preco: 25.00,
 *                   nome_sala: "Sala 1 - IMAX",
 *                   capacidade_total: 120,
 *                   tipo_sala: "normal",
 *                   estado_sessao: "agendada",
 *                   nome_completo: "João Silva",
 *                   numero_funcionario: "FUNC001",
 *                   estado_sala: "disponivel",
 *                   sinopse: "Um ladrão que invade os sonhos...",
 *                   classificacao_etaria: "14",
 *                   nota_media: 8.8,
 *                   cartaz_url: "https://image.tmdb.org/t/p/w500/edv5CZvWj09upOsy2Y6IwDhK8bt.jpg",
 *                   trailer_url: "https://youtube.com/...",
 *                   estado_exibicao: "em_cartaz",
 *                   pais_origem: "EUA",
 *                   idioma_original: "Inglês",
 *                   codigos_lugar: "A1, A2, A3, B1, B2",
 *                   codigos: "1, 2, 3, 4, 5"
 *                 }
 *               ]
 *               rowCount: 1
 *       400:
 *         description: Requisição inválida
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Filme não encontrado
 *       500:
 *         description: Erro interno
 */

router.get('/sessoes/:id_filme', (req, res) => {
    const { id_filme } = req.params;

    const query = `SELECT titulo, duracao_minutos, ano_lancamento, data_hora_inicio, data_hora_fim, preco,nome_sala,capacidade_total,tipo_sala,estado_sessao,nome_completo,numero_funcionario,estado_sala,sinopse, classificacao_etaria,nota_media,cartaz_url,trailer_url,estado_exibicao,pais_origem,idioma_original, STRING_AGG(lr.codigo_lugar, ', ' ORDER BY lr.codigo_lugar) as codigos_lugar, STRING_AGG(lr.codigo::text, ', ' ORDER BY lr.codigo_lugar) as codigos FROM filmes f inner join sessoes s on f.id_filme= s.id_filme inner join salas sl on sl.id_sala=s.id_sala inner join funcionarios fr on fr.id_funcionario=s.criado_por inner join utilizadores u on fr.id_utilizador=u.id_utilizador inner join lugares lr on sl.id_sala = lr.id_sala WHERE f.id_filme = $1 GROUP BY f.titulo, duracao_minutos, ano_lancamento, data_hora_inicio, data_hora_fim, preco, nome_sala, capacidade_total, tipo_sala, estado_sessao, nome_completo, numero_funcionario, estado_sala, sinopse, classificacao_etaria, nota_media, cartaz_url, trailer_url, estado_exibicao, pais_origem, idioma_original`;

    conexao.query(query, [id_filme], (err, results) => {
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
 * /destaque:
 *   get:
 *     summary: Lista filmes em destaque
 *     description: Retorna uma lista de filmes marcados como destaque, limitada a 50 resultados
 *     tags: [Filmes]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Número máximo de filmes a retornar
 *     responses:
 *       200:
 *         description: Lista de filmes em destaque retornada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: integer
 *                   example: 5
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Filme'
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 erro:
 *                   type: string
 *                   example: "Database connection error"
 */

router.get('/destaque',async (req, res) => {
    const query = `Select * from filmes Where destaque=true limit 50`;

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
 * /disponivel:
 *   get:
 *     summary: Lista filmes disponíveis
 *     description: Retorna uma lista de até 50 filmes que estão com estado de exibição igual a 'disponivel'
 *     tags: [Filmes]
 *     responses:
 *       200:
 *         description: Lista de filmes disponíveis retornada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                     description: ID do filme
 *                     example: 1
 *                   titulo:
 *                     type: string
 *                     description: Título do filme
 *                     example: "O Poderoso Chefão"
 *                   estado_exibicao:
 *                     type: string
 *                     enum: [disponivel, indisponivel, brevemente]
 *                     description: Estado de exibição do filme
 *                     example: "disponivel"
 *                   destaque:
 *                     type: boolean
 *                     description: Indica se está em destaque
 *                     example: false
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 erro:
 *                   type: string
 *                   description: Mensagem do erro
 *                   example: "Database connection error"
 */
router.get('/disponivel', async (req, res) => {
    const query = `Select * from filmes Where estado_exibicao='disponivel' limit 50`;

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
 * /indisponivel:
 *   get:
 *     summary: Lista filmes indisponíveis
 *     description: Retorna uma lista de até 50 filmes que estão com estado de exibição igual a 'indisponivel'
 *     tags: [Filmes]
 *     responses:
 *       200:
 *         description: Lista de filmes indisponíveis retornada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                     description: ID do filme
 *                     example: 1
 *                   titulo:
 *                     type: string
 *                     description: Título do filme
 *                     example: "O Poderoso Chefão"
 *                   estado_exibicao:
 *                     type: string
 *                     enum: [disponivel, indisponivel, brevemente]
 *                     description: Estado de exibição do filme
 *                     example: "indisponivel"
 *                   destaque:
 *                     type: boolean
 *                     description: Indica se está em destaque
 *                     example: false
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 erro:
 *                   type: string
 *                   description: Mensagem do erro
 *                   example: "Database connection error"
 */
router.get('/indisponivel', async (req, res) => {
    const query = `Select * from filmes Where estado_exibicao='indisponivel' limit 50`;

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
 * /brevemente:
 *   get:
 *     summary: Lista filmes que serão lançados em breve
 *     description: Retorna uma lista de até 50 filmes que estão com estado de exibição igual a 'brevemente'
 *     tags: [Filmes]
 *     responses:
 *       200:
 *         description: Lista de filmes em breve retornada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                     description: ID do filme
 *                     example: 1
 *                   titulo:
 *                     type: string
 *                     description: Título do filme
 *                     example: "Avatar 3"
 *                   estado_exibicao:
 *                     type: string
 *                     enum: [disponivel, indisponivel, brevemente]
 *                     description: Estado de exibição do filme
 *                     example: "brevemente"
 *                   destaque:
 *                     type: boolean
 *                     description: Indica se está em destaque
 *                     example: true
 *                   data_lancamento:
 *                     type: string
 *                     format: date
 *                     description: Data de lançamento prevista
 *                     example: "2025-12-20"
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 erro:
 *                   type: string
 *                   description: Mensagem do erro
 *                   example: "Database query error"
 */
router.get('/brevemente', async (req, res) => {
    const query = `Select * from filmes Where estado_exibicao='brevemente' limit 50`;

    conexao.query(query, (err, results) => {
        if (err) {
            return res.status(500).json({
                erro: err.message
            });
        }
        res.json(results);
    });
});

module.exports = router;