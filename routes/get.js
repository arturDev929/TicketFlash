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
        
        res.json(results.rows);
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
        
        res.json(results.rows);
    });
});

/**
 * @swagger
 * /sessoes:
 *   get:
 *     summary: Lista filmes com informações das sessões
 *     description: Retorna uma lista de filmes que possuem sessões, com estatísticas agregadas (total de sessões, horários, preços, etc.)
 *     tags: [Sessões]
 *     responses:
 *       200:
 *         description: Lista de filmes com sessões obtida com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   titulo:
 *                     type: string
 *                     description: Título do filme
 *                     example: "Avatar 3"
 *                   duracao_minutos:
 *                     type: integer
 *                     description: Duração em minutos
 *                     example: 180
 *                   ano_lancamento:
 *                     type: integer
 *                     description: Ano de lançamento
 *                     example: 2025
 *                   sinopse:
 *                     type: string
 *                     description: Sinopse do filme
 *                     example: "Jake Sully e Neytiri enfrentam novos desafios..."
 *                   classificacao_etaria:
 *                     type: string
 *                     description: Classificação indicativa
 *                     example: "12"
 *                   nota_media:
 *                     type: number
 *                     format: float
 *                     description: Nota média do filme
 *                     example: 4.8
 *                   cartaz_url:
 *                     type: string
 *                     description: URL do cartaz
 *                     example: "https://example.com/poster.jpg"
 *                   trailer_url:
 *                     type: string
 *                     description: URL do trailer
 *                     example: "https://youtube.com/watch?v=..."
 *                   estado_exibicao:
 *                     type: string
 *                     enum: [disponivel, indisponivel, brevemente]
 *                     description: Estado de exibição
 *                     example: "disponivel"
 *                   pais_origem:
 *                     type: string
 *                     description: País de origem
 *                     example: "EUA"
 *                   idioma_original:
 *                     type: string
 *                     description: Idioma original
 *                     example: "Inglês"
 *                   total_sessoes:
 *                     type: integer
 *                     description: Número total de sessões do filme
 *                     example: 5
 *                   primeira_sessao:
 *                     type: string
 *                     format: date-time
 *                     description: Data e hora da primeira sessão
 *                     example: "2025-12-20T14:00:00.000Z"
 *                   ultima_sessao:
 *                     type: string
 *                     format: date-time
 *                     description: Data e hora da última sessão
 *                     example: "2025-12-25T22:00:00.000Z"
 *                   salas_disponiveis:
 *                     type: string
 *                     description: Lista de salas disponíveis (separadas por vírgula)
 *                     example: "Sala IMAX, Sala 3D, Sala VIP"
 *                   preco_minimo:
 *                     type: number
 *                     format: float
 *                     description: Menor preço entre todas as sessões
 *                     example: 25.00
 *                   preco_maximo:
 *                     type: number
 *                     format: float
 *                     description: Maior preço entre todas as sessões
 *                     example: 45.00
 *             example:
 *               - titulo: "Avatar 3"
 *                 duracao_minutos: 180
 *                 ano_lancamento: 2025
 *                 sinopse: "Jake Sully e Neytiri enfrentam novos desafios em Pandora..."
 *                 classificacao_etaria: "12"
 *                 nota_media: 4.8
 *                 cartaz_url: "https://example.com/posters/avatar3.jpg"
 *                 trailer_url: "https://youtube.com/watch?v=avatar3"
 *                 estado_exibicao: "disponivel"
 *                 pais_origem: "EUA"
 *                 idioma_original: "Inglês"
 *                 total_sessoes: 5
 *                 primeira_sessao: "2025-12-20T14:00:00.000Z"
 *                 ultima_sessao: "2025-12-25T22:00:00.000Z"
 *                 salas_disponiveis: "Sala IMAX, Sala 3D, Sala VIP"
 *                 preco_minimo: 25.00
 *                 preco_maximo: 45.00
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 erro:
 *                   type: string
 *                   example: "Erro na consulta ao banco de dados"
 */

router.get('/sessoes', (req, res) => {    
    const query = `SELECT 
                        f.titulo,
                        f.duracao_minutos,
                        f.ano_lancamento,
                        f.sinopse,
                        f.classificacao_etaria,
                        f.nota_media,
                        f.cartaz_url,
                        f.trailer_url,
                        f.estado_exibicao,
                        f.pais_origem,
                        f.idioma_original,
                        -- Agregar informações das sessões (opcional)
                        COUNT(s.id_sessao) as total_sessoes,
                        MIN(s.data_hora_inicio) as primeira_sessao,
                        MAX(s.data_hora_fim) as ultima_sessao,
                        -- Agregar informações das salas
                        STRING_AGG(DISTINCT sl.nome_sala, ', ') as salas_disponiveis,
                        -- Agregar preços (se quiser)
                        MIN(s.preco) as preco_minimo,
                        MAX(s.preco) as preco_maximo
                    FROM filmes f 
                    INNER JOIN sessoes s ON f.id_filme = s.id_filme 
                    INNER JOIN salas sl ON sl.id_sala = s.id_sala 
                    INNER JOIN funcionarios fr ON fr.id_funcionario = s.criado_por 
                    INNER JOIN utilizadores u ON fr.id_utilizador = u.id_utilizador 
                    GROUP BY 
                        f.id_filme,
                        f.titulo,
                        f.duracao_minutos,
                        f.ano_lancamento,
                        f.sinopse,
                        f.classificacao_etaria,
                        f.nota_media,
                        f.cartaz_url,
                        f.trailer_url,
                        f.estado_exibicao,
                        f.pais_origem,
                        f.idioma_original
                    LIMIT 1000`;

    conexao.query(query, (err, results) => {
        if (err) {
            return res.status(500).json({
                erro: err.message
            });
        }

        res.json(results.rows);
    });
});

/**
 * @swagger
 * /sessoes-completas/{id_filme}:
 *   get:
 *     summary: Busca sessões completas de um filme
 *     parameters:
 *       - in: path
 *         name: id_filme
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Sucesso
 */
router.get('/sessoes-completas/:id_filme', async (req, res) => {
    try {
        const { id_filme } = req.params;

        // Validação básica do UUID
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(id_filme)) {
            return res.status(400).json({
                success: false,
                erro: 'ID do filme inválido. Formato UUID esperado.'
            });
        }

        const query = `
                        SELECT 
                            f.id_filme,
                            f.titulo,
                            s.id_sessao,
                            s.tipo_sessao,
                            s.preco,
                            s.observacoes,
                            s.data_hora_inicio,
                            s.data_hora_fim,
                            s.estado_sessao,
                            sl.id_sala,
                            sl.nome_sala,
                            sl.capacidade_total,
                            sl.tipo_sala,
                            sl.estado_sala,
                            sl.coluna,
                            sl.fila,
                            -- Lugares agrupados em JSON ordenado por codigo_lugar
                            json_agg(
                                json_build_object(
                                    'id_lugar', l.id_lugar,
                                    'codigo_lugar', l.codigo_lugar,
                                    'estado_permanente', l.estado_permanente,
                                    'estado_compra', l.estado_compra
                                )
                                ORDER BY l.codigo_lugar  -- Ordena pelo código do lugar
                            ) as lugares
                        FROM filmes f 
                        INNER JOIN sessoes s ON f.id_filme = s.id_filme 
                        INNER JOIN salas sl ON sl.id_sala = s.id_sala 
                        INNER JOIN lugares l ON l.id_sala = sl.id_sala 
                        WHERE f.id_filme = $1
                        GROUP BY 
                            f.id_filme, f.titulo,
                            s.id_sessao, s.tipo_sessao, s.preco, s.observacoes, 
                            s.data_hora_inicio, s.data_hora_fim, s.estado_sessao,
                            sl.id_sala, sl.nome_sala, sl.capacidade_total, sl.tipo_sala, sl.estado_sala, sl.coluna, sl.fila
                        ORDER BY s.data_hora_inicio`;

        const results = await conexao.query(query, [id_filme]);

        if (results.rows.length === 0) {
            return res.status(404).json({
                success: false,
                erro: 'Nenhuma sessão disponível para este filme'
            });
        }

        // Formatar a resposta
        const filmesAgrupados = results.rows.map(row => ({
            filme: {
                id: row.id_filme,
                titulo: row.titulo
            },
            sessoes: results.rows
                .filter(r => r.id_filme === row.id_filme)
                .map(sessao => ({
                    id: sessao.id_sessao,
                    tipo: sessao.tipo_sessao,
                    preco: parseFloat(sessao.preco),
                    observacoes: sessao.observacoes,
                    data_hora_inicio: sessao.data_hora_inicio,
                    data_hora_fim: sessao.data_hora_fim,
                    estado: sessao.estado_sessao,
                    sala: {
                        id: sessao.id_sala,
                        nome: sessao.nome_sala,
                        capacidade_total: sessao.capacidade_total,
                        tipo: sessao.tipo_sala,
                        estado: sessao.estado_sala,
                        configuracao: {
                            colunas: sessao.coluna,
                            filas: sessao.fila
                        }
                    },
                    lugares: sessao.lugares
                }))
        }));

        // Remover duplicatas (pegar apenas o primeiro)
        const respostaUnica = filmesAgrupados.filter((filme, index, self) =>
            index === self.findIndex(f => f.filme.id === filme.filme.id)
        );

        res.status(200).json({
            success: true,
            data: respostaUnica[0] || { filme: null, sessoes: [] }
        });

    } catch (error) {
        console.error('Erro ao buscar sessões:', error);
        
        // Tratamento específico para erros do banco de dados
        if (error.code) {
            switch (error.code) {
                case '42P01':
                    return res.status(500).json({
                        success: false,
                        erro: 'Erro de configuração no banco de dados'
                    });
                default:
                    return res.status(500).json({
                        success: false,
                        erro: 'Erro interno no servidor'
                    });
            }
        }
        
        res.status(500).json({
            success: false,
            erro: 'Erro ao processar a requisição'
        });
    }
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
    const query = `SELECT 
            f.*,
            ARRAY_AGG(g.nome_genero) as generos
        FROM filmes f 
        INNER JOIN filmes_generos fg ON f.id_filme = fg.id_filme 
        INNER JOIN generos g ON g.id_genero = fg.id_genero 
        WHERE f.destaque = true 
        GROUP BY f.id_filme
        LIMIT 50`;

    conexao.query(query, (err, results) => {
        if (err) {
            return res.status(500).json({
                erro: err.message
            });
        }
        res.json(results.rows);
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
    const query = `SELECT 
            f.*,
            ARRAY_AGG(g.nome_genero) as generos
        FROM filmes f 
        INNER JOIN filmes_generos fg ON f.id_filme = fg.id_filme 
        INNER JOIN generos g ON g.id_genero = fg.id_genero 
        WHERE estado_exibicao = 'disponivel' 
        GROUP BY f.id_filme
        LIMIT 50`;

    conexao.query(query, (err, results) => {
        if (err) {
            return res.status(500).json({
                erro: err.message
            });
        }
        res.json(results.rows);
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
    const query = `SELECT 
            f.*,
            ARRAY_AGG(g.nome_genero) as generos
        FROM filmes f 
        INNER JOIN filmes_generos fg ON f.id_filme = fg.id_filme 
        INNER JOIN generos g ON g.id_genero = fg.id_genero 
        WHERE estado_exibicao = 'indisponivel' 
        GROUP BY f.id_filme
        LIMIT 50`;

    conexao.query(query, (err, results) => {
        if (err) {
            return res.status(500).json({
                erro: err.message
            });
        }
        res.json(results.rows);
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
    const query = `SELECT 
            f.*,
            ARRAY_AGG(g.nome_genero) as generos
        FROM filmes f 
        INNER JOIN filmes_generos fg ON f.id_filme = fg.id_filme 
        INNER JOIN generos g ON g.id_genero = fg.id_genero 
        WHERE estado_exibicao = 'brevemente' 
        GROUP BY f.id_filme
        LIMIT 50`;

    conexao.query(query, (err, results) => {
        if (err) {
            return res.status(500).json({
                erro: err.message
            });
        }
        res.json(results.rows);
    });
});

module.exports = router;