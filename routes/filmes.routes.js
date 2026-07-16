const express = require("express");
const router = express.Router();
const conexao = require("../infra/conexao");

const { verificarToken, autorizar } = require("../middleware/authMiddleware");
const { registrarLog } = require("../utils/log");
const { v4: uuidv4 } = require("uuid");

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

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Lista todos os utilizadores com seus dados de funcionários
 *     description: Retorna uma lista de todos os utilizadores com informações dos funcionários através de um INNER JOIN entre as tabelas utilizadores e funcionarios
 *     tags: [Utilizadores]
 *     responses:
 *       200:
 *         description: Lista de utilizadores retornada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id_utilizador:
 *                     type: integer
 *                     description: ID do utilizador
 *                     example: 1
 *                   nome:
 *                     type: string
 *                     description: Nome do utilizador
 *                     example: "João Silva"
 *                   email:
 *                     type: string
 *                     format: email
 *                     description: Email do utilizador
 *                     example: "joao.silva@empresa.com"
 *                   telefone:
 *                     type: string
 *                     description: Número de telefone
 *                     example: "+351 912345678"
 *                   data_registo:
 *                     type: string
 *                     format: date-time
 *                     description: Data de registo do utilizador
 *                     example: "2024-01-15T10:30:00Z"
 *                   id_funcionario:
 *                     type: integer
 *                     description: ID do funcionário
 *                     example: 1
 *                   cargo:
 *                     type: string
 *                     description: Cargo do funcionário
 *                     example: "Desenvolvedor"
 *                   departamento:
 *                     type: string
 *                     description: Departamento do funcionário
 *                     example: "TI"
 *                   data_contratacao:
 *                     type: string
 *                     format: date
 *                     description: Data de contratação do funcionário
 *                     example: "2023-01-01"
 *                   salario:
 *                     type: number
 *                     format: float
 *                     description: Salário do funcionário
 *                     example: 3500.00
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
 *                   example: "Erro na consulta à base de dados"
 */

router.post('/filme', verificarToken, autorizar('funcionario', 'administrador'), async (req, res) => {
    const id_filme = uuidv4();
    const data_cadastro = new Date();
    const {
        titulo,
        sinopse,
        duracao_minuto,
        ano_lancamento,
        classificacao_etaria,
        nota_media,
        cartaz_url,
        trailer_url,
        id_funcionario,
        pais_origem,
        idioma_original,
        estado_exibicao,
        destaque,
        id_genero
    } = req.body;

    // --- VALIDAÇÕES ---
    if (!titulo || titulo.trim() === '') {
        return res.status(400).json({
            sucesso: false,
            mensagem: "Título é obrigatório"
        });
    }

    if (!duracao_minuto || duracao_minuto <= 0) {
        return res.status(400).json({
            sucesso: false,
            mensagem: "Duração deve ser maior que 0"
        });
    }

    if (!ano_lancamento || ano_lancamento < 1900 || ano_lancamento > new Date().getFullYear() + 5) {
        return res.status(400).json({
            sucesso: false,
            mensagem: "Ano de lançamento inválido"
        });
    }

    if (!id_funcionario) {
        return res.status(400).json({
            sucesso: false,
            mensagem: "ID do funcionário é obrigatório"
        });
    }

    if (!id_genero || !Array.isArray(id_genero) || id_genero.length === 0) {
        return res.status(400).json({
            sucesso: false,
            mensagem: "Pelo menos um gênero é obrigatório"
        });
    }

    // --- VALIDAR CLASSIFICAÇÃO ETÁRIA ---
    // Valores permitidos: 'L', '6', '12', '14', '16', '18'
    const CLASSIFICACOES_VALIDAS = ['L', '6', '12', '14', '16', '18'];
    
    // Se não for enviado, usar 'L' (Livre) como padrão
    let classificacaoFinal = classificacao_etaria || 'L';
    
    // Converter para string e remover espaços
    classificacaoFinal = String(classificacaoFinal).trim();
    
    // Validar se é um valor permitido
    if (!CLASSIFICACOES_VALIDAS.includes(classificacaoFinal)) {
        return res.status(400).json({
            sucesso: false,
            mensagem: `Classificação etária inválida. Valores permitidos: ${CLASSIFICACOES_VALIDAS.join(', ')}`,
            valor_enviado: classificacao_etaria
        });
    }

    try {
        await conexao.query('BEGIN');

        // --- VERIFICAR FUNCIONÁRIO ---
        const verificarFuncionario = `
            SELECT id_funcionario FROM funcionarios WHERE id_funcionario = $1
        `;
        const funcionario = await conexao.query(verificarFuncionario, [id_funcionario]);

        if (funcionario.rows.length === 0) {
            await conexao.query('ROLLBACK');
            return res.status(404).json({
                sucesso: false,
                mensagem: "Funcionário não encontrado"
            });
        }

        // --- VERIFICAR SE FILME JÁ EXISTE ---
        const verificarFilme = `
            SELECT id_filme FROM filmes WHERE titulo = $1 AND ano_lancamento = $2
        `;
        const filmeExistente = await conexao.query(verificarFilme, [titulo.trim(), ano_lancamento]);

        if (filmeExistente.rows.length > 0) {
            await conexao.query('ROLLBACK');
            return res.status(409).json({
                sucesso: false,
                mensagem: `Já existe um filme com o título "${titulo}" e ano "${ano_lancamento}"`
            });
        }

        // --- VERIFICAR GÊNEROS ---
        const generosValidos = [];
        const generosInvalidos = [];

        for (const generoId of id_genero) {
            const verificarGenero = `
                SELECT id_genero, nome_genero FROM generos WHERE id_genero = $1
            `;
            const genero = await conexao.query(verificarGenero, [generoId]);
            
            if (genero.rows.length > 0) {
                generosValidos.push({
                    id_genero: genero.rows[0].id_genero,
                    nome_genero: genero.rows[0].nome_genero
                });
            } else {
                generosInvalidos.push(generoId);
            }
        }

        if (generosValidos.length === 0) {
            await conexao.query('ROLLBACK');
            return res.status(404).json({
                sucesso: false,
                mensagem: "Nenhum gênero válido foi encontrado",
                generos_invalidos: generosInvalidos
            });
        }

        // --- INSERIR FILME ---
        const sql = `
            INSERT INTO filmes (
                id_filme,
                titulo,
                sinopse,
                duracao_minutos,
                ano_lancamento,
                classificacao_etaria,
                nota_media,
                cartaz_url,
                trailer_url,
                cadastrado_por,
                pais_origem,
                idioma_original,
                estado_exibicao,
                destaque,
                data_cadastro
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
            )
            RETURNING *
        `;

        const values = [
            id_filme,
            titulo.trim(),
            sinopse || null,
            duracao_minuto,
            ano_lancamento,
            classificacaoFinal, // 'L', '6', '12', '14', '16' ou '18'
            nota_media || 0,
            cartaz_url || null,
            trailer_url || null,
            id_funcionario,
            pais_origem || null,
            idioma_original || null,
            estado_exibicao || 'disponivel',
            destaque || false,
            data_cadastro
        ];

        const result = await conexao.query(sql, values);

        // --- ASSOCIAR GÊNEROS ---
        const generosAssociados = [];
        for (const genero of generosValidos) {
            const sqlGenero = `
                INSERT INTO filmes_generos (id_filme, id_genero)
                VALUES ($1, $2)
                RETURNING *
            `;
            await conexao.query(sqlGenero, [id_filme, genero.id_genero]);
            generosAssociados.push(genero);
        }

        await conexao.query('COMMIT');

        registrarLog({
            id_funcionario,
            accao: 'CRIAR_FILME',
            tabela_afectada: 'filmes',
            registo_id: id_filme,
            detalhes: { titulo: titulo.trim() },
            ip_origem: req.ip,
        });

        // --- BUSCAR GÊNEROS DO FILME ---
        const buscarGeneros = `
            SELECT g.id_genero, g.nome_genero 
            FROM generos g
            INNER JOIN filmes_generos fg ON g.id_genero = fg.id_genero
            WHERE fg.id_filme = $1
            ORDER BY g.nome_genero
        `;
        const generosFilme = await conexao.query(buscarGeneros, [id_filme]);

        res.status(201).json({
            sucesso: true,
            mensagem: `Filme criado com ${generosAssociados.length} gênero(s) com sucesso`,
            filme: result.rows[0],
            generos_associados: generosAssociados,
            generos_nao_encontrados: generosInvalidos,
            todos_generos_filme: generosFilme.rows
        });

    } catch (error) {
        await conexao.query('ROLLBACK');
        
        console.error('Erro ao criar filme:', error);
        res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao criar filme",
            erro: error.message,
            detalhe: error.detail || null
        });
    }
});

/**
 * @swagger
 * /registerClient:
 *   post:
 *     summary: Registrar um novo cliente
 *     description: Cria uma nova conta de cliente com validação de senha e envio de email de boas-vindas
 *     tags: [Clientes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nome_completo
 *               - email
 *               - senha_hash
 *               - confirmar_senha_hash
 *               - telefone
 *             properties:
 *               nome_completo:
 *                 type: string
 *                 description: Nome completo do cliente
 *                 example: "João Silva"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email do cliente
 *                 example: "joao.silva@email.com"
 *               senha_hash:
 *                 type: string
 *                 format: password
 *                 description: Senha do cliente (mínimo 8 caracteres)
 *                 example: "senha123"
 *               confirmar_senha_hash:
 *                 type: string
 *                 format: password
 *                 description: Confirmação da senha
 *                 example: "senha123"
 *               telefone:
 *                 type: string
 *                 description: Número de telefone
 *                 example: "+351 912345678"
 *     responses:
 *       201:
 *         description: Cliente registrado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sucesso:
 *                   type: boolean
 *                   example: true
 *                 mensagem:
 *                   type: string
 *                   example: "Cliente registrado com sucesso"
 *                 cliente:
 *                   type: object
 *                   properties:
 *                     id_utilizador:
 *                       type: string
 *                       format: uuid
 *                       example: "550e8400-e29b-41d4-a716-446655440000"
 *                     nome_completo:
 *                       type: string
 *                       example: "João Silva"
 *                     email:
 *                       type: string
 *                       example: "joao.silva@email.com"
 *                     telefone:
 *                       type: string
 *                       example: "+351 912345678"
 *                     tipo_utilizador:
 *                       type: string
 *                       example: "cliente"
 *                     estado_conta:
 *                       type: string
 *                       example: "ativo"
 *                     data_cadastro:
 *                       type: string
 *                       format: date-time
 *                       example: "2026-06-22T10:30:00.000Z"
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sucesso:
 *                   type: boolean
 *                   example: false
 *                 mensagem:
 *                   type: string
 *                   example: "As senhas não coincidem"
 *       409:
 *         description: Email já registrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sucesso:
 *                   type: boolean
 *                   example: false
 *                 mensagem:
 *                   type: string
 *                   example: "Este email já está registrado"
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sucesso:
 *                   type: boolean
 *                   example: false
 *                 mensagem:
 *                   type: string
 *                   example: "Erro ao registrar cliente"
 *                 erro:
 *                   type: string
 *                   example: "Database error"
 */

router.put("/filme/:id", verificarToken, autorizar("funcionario", "administrador"), async (req, res) => {
  const id_filme = req.params.id;
  const data_atualizacao = new Date();
  const {
    titulo,
    sinopse,
    duracao_minuto,
    ano_lancamento,
    classificacao_etaria,
    nota_media,
    cartaz_url,
    trailer_url,
    id_funcionario,
    pais_origem,
    idioma_original,
    estado_exibicao,
    destaque,
    id_genero,
  } = req.body;

  // --- VALIDAÇÕES ---
  if (!titulo || titulo.trim() === "") {
    return res.status(400).json({
      sucesso: false,
      mensagem: "Título é obrigatório",
    });
  }

  if (!duracao_minuto || duracao_minuto <= 0) {
    return res.status(400).json({
      sucesso: false,
      mensagem: "Duração deve ser maior que 0",
    });
  }

  if (
    !ano_lancamento ||
    ano_lancamento < 1900 ||
    ano_lancamento > new Date().getFullYear() + 5
  ) {
    return res.status(400).json({
      sucesso: false,
      mensagem: "Ano de lançamento inválido",
    });
  }

  if (!id_funcionario) {
    return res.status(400).json({
      sucesso: false,
      mensagem: "ID do funcionário é obrigatório",
    });
  }

  if (!id_genero || !Array.isArray(id_genero) || id_genero.length === 0) {
    return res.status(400).json({
      sucesso: false,
      mensagem: "Pelo menos um gênero é obrigatório",
    });
  }

  // --- VALIDAR CLASSIFICAÇÃO ETÁRIA ---
  const CLASSIFICACOES_VALIDAS = ["L", "6", "12", "14", "16", "18"];
  let classificacaoFinal = classificacao_etaria || "L";
  classificacaoFinal = String(classificacaoFinal).trim();

  if (!CLASSIFICACOES_VALIDAS.includes(classificacaoFinal)) {
    return res.status(400).json({
      sucesso: false,
      mensagem: `Classificação etária inválida. Valores permitidos: ${CLASSIFICACOES_VALIDAS.join(", ")}`,
      valor_enviado: classificacao_etaria,
    });
  }

  try {
    await conexao.query("BEGIN");

    // --- VERIFICAR SE FILME EXISTE ---
    const verificarFilmeExistente = `
            SELECT id_filme FROM filmes WHERE id_filme = $1
        `;
    const filmeExistente = await conexao.query(verificarFilmeExistente, [
      id_filme,
    ]);

    if (filmeExistente.rows.length === 0) {
      await conexao.query("ROLLBACK");
      return res.status(404).json({
        sucesso: false,
        mensagem: "Filme não encontrado",
      });
    }

    // --- VERIFICAR SE FUNCIONÁRIO EXISTE ---
    const verificarFuncionario = `
            SELECT id_funcionario FROM funcionarios WHERE id_funcionario = $1
        `;
    const funcionario = await conexao.query(verificarFuncionario, [
      id_funcionario,
    ]);

    if (funcionario.rows.length === 0) {
      await conexao.query("ROLLBACK");
      return res.status(404).json({
        sucesso: false,
        mensagem: "Funcionário não encontrado",
      });
    }

    // --- VERIFICAR SE JÁ EXISTE OUTRO FILME COM MESMO TÍTULO E ANO ---
    const verificarDuplicado = `
            SELECT id_filme FROM filmes 
            WHERE titulo = $1 AND ano_lancamento = $2 AND id_filme != $3
        `;
    const duplicado = await conexao.query(verificarDuplicado, [
      titulo.trim(),
      ano_lancamento,
      id_filme,
    ]);

    if (duplicado.rows.length > 0) {
      await conexao.query("ROLLBACK");
      return res.status(409).json({
        sucesso: false,
        mensagem: `Já existe um filme com o título "${titulo}" e ano "${ano_lancamento}"`,
      });
    }

    // --- VERIFICAR GÊNEROS ---
    const generosValidos = [];
    const generosInvalidos = [];

    for (const generoId of id_genero) {
      const verificarGenero = `
                SELECT id_genero, nome_genero FROM generos WHERE id_genero = $1
            `;
      const genero = await conexao.query(verificarGenero, [generoId]);

      if (genero.rows.length > 0) {
        generosValidos.push({
          id_genero: genero.rows[0].id_genero,
          nome_genero: genero.rows[0].nome_genero,
        });
      } else {
        generosInvalidos.push(generoId);
      }
    }

    if (generosValidos.length === 0) {
      await conexao.query("ROLLBACK");
      return res.status(404).json({
        sucesso: false,
        mensagem: "Nenhum gênero válido foi encontrado",
        generos_invalidos: generosInvalidos,
      });
    }

    // --- ATUALIZAR FILME ---
    const sql = `
            UPDATE filmes 
            SET 
                titulo = $1,
                sinopse = $2,
                duracao_minutos = $3,
                ano_lancamento = $4,
                classificacao_etaria = $5,
                nota_media = $6,
                cartaz_url = $7,
                trailer_url = $8,
                cadastrado_por = $9,
                pais_origem = $10,
                idioma_original = $11,
                estado_exibicao = $12,
                destaque = $13
            WHERE id_filme = $14
            RETURNING *
        `;

    const values = [
      titulo.trim(),
      sinopse || null,
      duracao_minuto,
      ano_lancamento,
      classificacaoFinal,
      nota_media || 0,
      cartaz_url || null,
      trailer_url || null,
      id_funcionario,
      pais_origem || null,
      idioma_original || null,
      estado_exibicao || "disponivel",
      destaque || false,
      id_filme,
    ];

    const result = await conexao.query(sql, values);

    // --- BUSCAR GÊNEROS ATUAIS DO FILME ---
    const buscarGenerosAtuais = `
            SELECT g.id_genero, g.nome_genero 
            FROM generos g
            INNER JOIN filmes_generos fg ON g.id_genero = fg.id_genero
            WHERE fg.id_filme = $1
        `;
    const generosAtuais = await conexao.query(buscarGenerosAtuais, [id_filme]);
    const idsGenerosAtuais = generosAtuais.rows.map((g) => g.id_genero);

    // --- VERIFICAR GÊNEROS A REMOVER ---
    const idsGenerosNovos = generosValidos.map((g) => g.id_genero);
    const idsParaRemover = idsGenerosAtuais.filter(
      (id) => !idsGenerosNovos.includes(id),
    );

    // --- REMOVER GÊNEROS QUE NÃO ESTÃO MAIS NA LISTA ---
    const generosRemovidos = [];
    for (const id of idsParaRemover) {
      const generoRemovido = generosAtuais.rows.find((g) => g.id_genero === id);
      const sqlRemover = `
                DELETE FROM filmes_generos 
                WHERE id_filme = $1 AND id_genero = $2
                RETURNING *
            `;
      await conexao.query(sqlRemover, [id_filme, id]);
      if (generoRemovido) {
        generosRemovidos.push(generoRemovido);
      }
    }

    // --- ADICIONAR NOVOS GÊNEROS ---
    const generosAdicionados = [];
    for (const genero of generosValidos) {
      if (!idsGenerosAtuais.includes(genero.id_genero)) {
        const sqlGenero = `
                    INSERT INTO filmes_generos (id_filme, id_genero)
                    VALUES ($1, $2)
                    RETURNING *
                `;
        await conexao.query(sqlGenero, [id_filme, genero.id_genero]);
        generosAdicionados.push(genero);
      }
    }

    await conexao.query("COMMIT");

    // --- BUSCAR GÊNEROS FINAIS DO FILME ---
    const buscarGenerosFinais = `
            SELECT g.id_genero, g.nome_genero 
            FROM generos g
            INNER JOIN filmes_generos fg ON g.id_genero = fg.id_genero
            WHERE fg.id_filme = $1
            ORDER BY g.nome_genero
        `;
    const generosFinais = await conexao.query(buscarGenerosFinais, [id_filme]);

    // --- MONTAR MENSAGEM ---
    let mensagem = "Filme atualizado com sucesso";
    if (generosAdicionados.length > 0 && generosRemovidos.length > 0) {
      mensagem = `Filme atualizado com ${generosAdicionados.length} gênero(s) adicionado(s) e ${generosRemovidos.length} gênero(s) removido(s)`;
    } else if (generosAdicionados.length > 0) {
      mensagem = `Filme atualizado com ${generosAdicionados.length} gênero(s) adicionado(s)`;
    } else if (generosRemovidos.length > 0) {
      mensagem = `Filme atualizado com ${generosRemovidos.length} gênero(s) removido(s)`;
    }

    res.status(200).json({
      sucesso: true,
      mensagem: mensagem,
      filme: result.rows[0],
      generos_adicionados: generosAdicionados,
      generos_removidos: generosRemovidos,
      generos_nao_encontrados: generosInvalidos,
      todos_generos_filme: generosFinais.rows,
      total_generos: generosFinais.rows.length,
    });
  } catch (error) {
    await conexao.query("ROLLBACK");

    console.error("Erro ao atualizar filme:", error);
    res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao atualizar filme",
      erro: error.message,
      detalhe: error.detail || null,
    });
  }
});

/**
 * @swagger
 * /salas/{id}:
 *   put:
 *     summary: Atualizar uma sala e seus lugares
 *     description: Atualiza os dados da sala e gerencia automaticamente os lugares. Suporta capacidade diferente de coluna x fila.
 *     tags: [Salas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID da sala
 *         schema:
 *           type: string
 *           format: uuid
 *           example: "550e8400-e29b-41d4-a716-446655440000"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome_sala:
 *                 type: string
 *                 description: Nome da sala
 *                 example: "Sala Pequena Atualizada"
 *               capacidade_total:
 *                 type: integer
 *                 description: Capacidade total da sala
 *                 example: 12
 *               tipo_sala:
 *                 type: string
 *                 enum: [NORMAL, VIP, 3D, IMAX]
 *                 description: Tipo da sala
 *                 example: VIP
 *               estado_sala:
 *                 type: string
 *                 enum: [ativa, inativa, manutencao]
 *                 description: Estado da sala
 *                 example: ATIVA
 *               coluna:
 *                 type: integer
 *                 description: Numero de colunas por fila
 *                 example: 4
 *               fila:
 *                 type: integer
 *                 description: Numero de filas
 *                 example: 3
 *     responses:
 *       200:
 *         description: Sala atualizada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sucesso:
 *                   type: boolean
 *                   example: true
 *                 mensagem:
 *                   type: string
 *                   example: "Sala atualizada com 12 lugares com sucesso"
 *                 sala:
 *                   type: object
 *                   properties:
 *                     id_sala:
 *                       type: string
 *                       example: "550e8400-e29b-41d4-a716-446655440000"
 *                     nome_sala:
 *                       type: string
 *                       example: "Sala Pequena Atualizada"
 *                     capacidade_total:
 *                       type: integer
 *                       example: 12
 *                     tipo_sala:
 *                       type: string
 *                       example: "VIP"
 *                     estado_sala:
 *                       type: string
 *                       example: "ATIVA"
 *                     coluna:
 *                       type: integer
 *                       example: 4
 *                     fila:
 *                       type: integer
 *                       example: 3
 *                 lugares_afetados:
 *                   type: object
 *                   properties:
 *                     adicionados:
 *                       type: integer
 *                       example: 1
 *                     removidos:
 *                       type: integer
 *                       example: 0
 *                     mantidos:
 *                       type: integer
 *                       example: 11
 *                 configuracao:
 *                   type: object
 *                   properties:
 *                     colunas:
 *                       type: integer
 *                       example: 4
 *                     filas:
 *                       type: integer
 *                       example: 3
 *                     total_posicoes:
 *                       type: integer
 *                       example: 12
 *                     lugares_ocupados:
 *                       type: integer
 *                       example: 12
 *                     lugares_vazios:
 *                       type: integer
 *                       example: 0
 *                     capacidade_solicitada:
 *                       type: integer
 *                       example: 12
 *                     porcentagem_ocupacao:
 *                       type: string
 *                       example: "100%"
 *                 mapa_visual:
 *                   type: string
 *                   example: "+---+---+---+---+\n| A | A1 | A2 | A3 | A4 |\n+---+---+---+---+\n| B | B1 | B2 | B3 | B4 |\n+---+---+---+---+\n| C | C1 | C2 | C3 | C4 |\n+---+---+---+---+"
 *       400:
 *         description: Dados invalidos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sucesso:
 *                   type: boolean
 *                   example: false
 *                 mensagem:
 *                   type: string
 *                   example: "Capacidade total deve ser maior que 0"
 *                 sugestoes:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       descricao:
 *                         type: string
 *                       filas:
 *                         type: integer
 *                       colunas:
 *                         type: integer
 *                       total:
 *                         type: integer
 *                       lugares_vazios:
 *                         type: integer
 *       404:
 *         description: Sala nao encontrada
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sucesso:
 *                   type: boolean
 *                   example: false
 *                 mensagem:
 *                   type: string
 *                   example: "Sala nao encontrada"
 *       500:
 *         description: Erro interno
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sucesso:
 *                   type: boolean
 *                   example: false
 *                 mensagem:
 *                   type: string
 *                   example: "Erro ao atualizar sala"
 *                 erro:
 *                   type: string
 */

router.delete("/filme/:id", verificarToken, autorizar("funcionario", "administrador"), async (req, res) => {
  const { id } = req.params;

  try {
    // --- VALIDAR UUID ---
    const uuidRegex =
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "ID inválido. Deve ser um UUID válido.",
      });
    }

    // --- VERIFICAR SE FILME EXISTE ---
    const checkQuery = `
            SELECT id_filme, titulo 
            FROM filmes 
            WHERE id_filme = $1
        `;
    const checkResult = await conexao.query(checkQuery, [id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        sucesso: false,
        mensagem: "Filme não encontrado",
      });
    }

    // --- VERIFICAR SE HÁ SESSÕES ATIVAS DO FILME ---
    const sessoesQuery = `
            SELECT COUNT(*) as total
            FROM sessoes 
            WHERE id_filme = $1 
            AND estado_sessao NOT IN ('cancelada', 'concluida')
        `;
    const sessoesResult = await conexao.query(sessoesQuery, [id]);

    if (parseInt(sessoesResult.rows[0].total) > 0) {
      return res.status(409).json({
        sucesso: false,
        mensagem: "Não é possível remover o filme pois possui sessões ativas",
        sessoes_ativas: parseInt(sessoesResult.rows[0].total),
      });
    }

    // --- REMOVER ASSOCIAÇÕES COM GÊNEROS ---
    await conexao.query("DELETE FROM filmes_generos WHERE id_filme = $1", [id]);

    // --- REMOVER FILME ---
    const deleteQuery = `
            DELETE FROM filmes 
            WHERE id_filme = $1
            RETURNING id_filme, titulo
        `;
    const result = await conexao.query(deleteQuery, [id]);

    registrarLog({
      id_funcionario: req.usuario?.id_funcionario,
      accao: 'REMOVER_FILME',
      tabela_afectada: 'filmes',
      registo_id: id,
      ip_origem: req.ip,
    });

    res.status(200).json({
      sucesso: true,
      mensagem: "Filme removido com sucesso",
      filme: result.rows[0],
    });
  } catch (error) {
    console.error("Erro ao remover filme:", error);
    res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao remover filme",
      erro: error.message,
    });
  }
});

// delete.js

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     summary: Remove um usuário
 *     description: Remove permanentemente um usuário do sistema. Verifica se não há compras associadas.
 *     tags: [Utilizadores]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do utilizador
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       200:
 *         description: Usuário removido com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sucesso:
 *                   type: boolean
 *                   example: true
 *                 mensagem:
 *                   type: string
 *                   example: "Usuário removido com sucesso"
 *       400:
 *         description: ID inválido
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sucesso:
 *                   type: boolean
 *                   example: false
 *                 mensagem:
 *                   type: string
 *                   example: "ID inválido"
 *       401:
 *         description: Não autorizado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sucesso:
 *                   type: boolean
 *                   example: false
 *                 mensagem:
 *                   type: string
 *                   example: "Token não fornecido"
 *       404:
 *         description: Usuário não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sucesso:
 *                   type: boolean
 *                   example: false
 *                 mensagem:
 *                   type: string
 *                   example: "Usuário não encontrado"
 *       409:
 *         description: Usuário possui compras associadas
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sucesso:
 *                   type: boolean
 *                   example: false
 *                 mensagem:
 *                   type: string
 *                   example: "Não é possível remover o usuário pois possui compras associadas"
 *                 total_compras:
 *                   type: integer
 *                   example: 5
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sucesso:
 *                   type: boolean
 *                   example: false
 *                 mensagem:
 *                   type: string
 *                   example: "Erro ao remover usuário"
 *                 erro:
 *                   type: string
 *                   example: "Database error"
 */

module.exports = router;
