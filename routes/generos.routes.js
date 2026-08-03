const express = require("express");
const router = express.Router();
const conexao = require("../infra/conexao");

const { verificarToken, autorizar } = require("../middleware/authMiddleware");
const { registrarLog } = require("../utils/log");
const { v4: uuidv4 } = require("uuid");

// ROTA PÚBLICA - Não requer autenticação
router.get('/generos', async (req, res) => {
    try {
        const query = `
            SELECT id_genero, nome_genero, descricao
            FROM generos
            ORDER BY nome_genero ASC
        `;
        
        const result = await conexao.query(query);
        
        res.status(200).json({
            sucesso: true,
            total: result.rows.length,
            generos: result.rows
        });
    } catch (error) {
        console.error('Erro ao buscar gêneros:', error);
        res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao buscar gêneros",
            erro: error.message
        });
    }
});

/**
 * @swagger
 * /bilhetes/{id}:
 *   get:
 *     summary: Consulta os bilhetes de uma compra
 *     description: Aceita id_compra, numero_factura ou id_bilhete. Uso interno da equipa na entrada do cinema.
 *     tags: [Bilhetes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Bilhetes encontrados
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Nenhum bilhete encontrado
 */

router.post('/genero', verificarToken, autorizar('funcionario', 'administrador'), async (req, res) => {
    const id_genero = uuidv4();
    const { nome_genero, descricao } = req.body;

    // --- VALIDAÇÕES ---
    if (!nome_genero || nome_genero.trim() === '') {
        return res.status(400).json({
            sucesso: false,
            mensagem: "Nome do gênero é obrigatório"
        });
    }

    try {
        // --- VERIFICAR SE GÊNERO JÁ EXISTE ---
        const verificarGenero = `
            SELECT id_genero FROM generos WHERE nome_genero = $1
        `;
        const generoExistente = await conexao.query(verificarGenero, [nome_genero.trim()]);

        if (generoExistente.rows.length > 0) {
            return res.status(409).json({
                sucesso: false,
                mensagem: `Já existe um gênero com o nome '${nome_genero.trim()}'`
            });
        }

        // --- INSERIR GÊNERO ---
        const sql = `
            INSERT INTO generos (id_genero, nome_genero, descricao)
            VALUES ($1, $2, $3)
            RETURNING *
        `;

        const values = [
            id_genero,
            nome_genero.trim(),
            descricao || null
        ];

        const result = await conexao.query(sql, values);

        res.status(201).json({
            sucesso: true,
            mensagem: "Gênero criado com sucesso",
            genero: result.rows[0]
        });

    } catch (error) {
        console.error('Erro ao criar gênero:', error);
        res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao criar gênero",
            erro: error.message
        });
    }
});

/**
 * @swagger
 * /filme:
 *   post:
 *     summary: Criar um novo filme com gêneros
 *     description: Registra um novo filme e associa a um ou mais gêneros
 *     tags: [Filmes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - titulo
 *               - duracao_minuto
 *               - ano_lancamento
 *               - id_funcionario
 *               - id_genero
 *             properties:
 *               titulo:
 *                 type: string
 *                 description: Título do filme
 *                 example: "Avatar 3"
 *               sinopse:
 *                 type: string
 *                 description: Sinopse do filme
 *                 example: "Uma jornada épica em Pandora..."
 *               duracao_minuto:
 *                 type: integer
 *                 description: Duração em minutos
 *                 example: 180
 *               ano_lancamento:
 *                 type: integer
 *                 description: Ano de lançamento
 *                 example: 2025
 *               classificacao_etaria:
 *                 type: string
 *                 enum: [L, 6, 12, 14, 16, 18]
 *                 description: Classificação indicativa (L = Livre)
 *                 example: "12"
 *               nota_media:
 *                 type: number
 *                 format: float
 *                 description: Nota média do filme
 *                 example: 8.5
 *               cartaz_url:
 *                 type: string
 *                 description: URL do cartaz do filme
 *                 example: "https://example.com/poster.jpg"
 *               trailer_url:
 *                 type: string
 *                 description: URL do trailer do filme
 *                 example: "https://youtube.com/watch?v=123"
 *               id_funcionario:
 *                 type: string
 *                 format: uuid
 *                 description: ID do funcionário que cadastrou
 *                 example: "550e8400-e29b-41d4-a716-446655440000"
 *               pais_origem:
 *                 type: string
 *                 description: País de origem do filme
 *                 example: "EUA"
 *               idioma_original:
 *                 type: string
 *                 description: Idioma original do filme
 *                 example: "Inglês"
 *               estado_exibicao:
 *                 type: string
 *                 enum: [disponivel, indisponivel, brevemente]
 *                 description: Estado de exibição do filme
 *                 example: "disponivel"
 *               destaque:
 *                 type: boolean
 *                 description: Indica se o filme está em destaque
 *                 example: true
 *               id_genero:
 *                 type: array
 *                 description: Lista de IDs dos gêneros
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 example: ["550e8400-e29b-41d4-a716-446655440001", "550e8400-e29b-41d4-a716-446655440002"]
 *     responses:
 *       201:
 *         description: Filme criado com sucesso
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
 *                   example: "Filme criado com 2 gêneros com sucesso"
 *                 filme:
 *                   type: object
 *                   properties:
 *                     id_filme:
 *                       type: string
 *                       format: uuid
 *                       example: "550e8400-e29b-41d4-a716-446655440000"
 *                     titulo:
 *                       type: string
 *                       example: "Avatar 3"
 *                     sinopse:
 *                       type: string
 *                       example: "Uma jornada épica em Pandora..."
 *                     duracao_minuto:
 *                       type: integer
 *                       example: 180
 *                     ano_lancamento:
 *                       type: integer
 *                       example: 2025
 *                     classificacao_etaria:
 *                       type: string
 *                       example: "12"
 *                     nota_media:
 *                       type: number
 *                       example: 8.5
 *                     cartaz_url:
 *                       type: string
 *                       example: "https://example.com/poster.jpg"
 *                     trailer_url:
 *                       type: string
 *                       example: "https://youtube.com/watch?v=123"
 *                     pais_origem:
 *                       type: string
 *                       example: "EUA"
 *                     idioma_original:
 *                       type: string
 *                       example: "Inglês"
 *                     estado_exibicao:
 *                       type: string
 *                       example: "disponivel"
 *                     destaque:
 *                       type: boolean
 *                       example: true
 *                     cadastrado_por:
 *                       type: string
 *                       format: uuid
 *                       example: "550e8400-e29b-41d4-a716-446655440000"
 *                     data_cadastro:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-15T10:30:00Z"
 *                 generos_associados:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id_genero:
 *                         type: string
 *                         format: uuid
 *                         example: "550e8400-e29b-41d4-a716-446655440001"
 *                       nome_genero:
 *                         type: string
 *                         example: "Ação"
 *                 generos_nao_encontrados:
 *                   type: array
 *                   items:
 *                     type: string
 *                     format: uuid
 *                     example: ["550e8400-e29b-41d4-a716-446655440099"]
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
 *                   example: "Classificação etária inválida. Valores permitidos: L, 6, 12, 14, 16, 18"
 *       404:
 *         description: Funcionário ou gênero não encontrado
 *       409:
 *         description: Filme já existe
 *       500:
 *         description: Erro interno do servidor
 */

router.put("/genero/:id", verificarToken, autorizar("funcionario", "administrador"), async (req, res) => {
  const id = req.params.id;
  const { nome_genero, descricao } = req.body;

  // --- VALIDAÇÃO ---
  if (!nome_genero || nome_genero.trim() === "") {
    return res.status(400).json({
      sucesso: false,
      mensagem: "Nome do gênero é obrigatório",
    });
  }

  try {
    // --- VERIFICAR SE GÊNERO EXISTE ---
    const verificarExistencia = `
            SELECT id_genero FROM generos WHERE id_genero = $1
        `;
    const existe = await conexao.query(verificarExistencia, [id]);

    if (existe.rows.length === 0) {
      return res.status(404).json({
        sucesso: false,
        mensagem: "Gênero não encontrado",
      });
    }

    // --- VERIFICAR SE NOME JÁ EXISTE EM OUTRO GÊNERO ---
    const verificarNome = `
            SELECT id_genero FROM generos 
            WHERE nome_genero = $1 AND id_genero != $2
        `;
    const nomeExistente = await conexao.query(verificarNome, [
      nome_genero.trim(),
      id,
    ]);

    if (nomeExistente.rows.length > 0) {
      return res.status(409).json({
        sucesso: false,
        mensagem: `Já existe um gênero com o nome '${nome_genero.trim()}'`,
      });
    }

    // --- ATUALIZAR GÊNERO ---
    const sql = `
            UPDATE generos 
            SET nome_genero = $1, 
                descricao = $2
            WHERE id_genero = $3 
            RETURNING *
        `;

    const values = [nome_genero.trim(), descricao || null, id];

    const result = await conexao.query(sql, values);

    res.status(200).json({
      sucesso: true,
      mensagem: "Gênero atualizado com sucesso",
      genero: result.rows[0],
    });
  } catch (error) {
    console.error("Erro ao atualizar gênero:", error);
    res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao atualizar gênero",
      erro: error.message,
    });
  }
});

/**
 * @swagger
 * /filme/{id}:
 *   put:
 *     summary: Atualizar um filme completo
 *     description: Atualiza todos os dados de um filme existente e seus gêneros
 *     tags: [Filmes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID do filme
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
 *             required:
 *               - titulo
 *               - duracao_minuto
 *               - ano_lancamento
 *               - id_funcionario
 *               - id_genero
 *             properties:
 *               titulo:
 *                 type: string
 *                 description: Título do filme
 *                 example: "Avatar 3 - O Caminho da Água"
 *               sinopse:
 *                 type: string
 *                 description: Sinopse do filme
 *                 example: "Uma jornada épica em Pandora com novos desafios..."
 *               duracao_minuto:
 *                 type: integer
 *                 description: Duração em minutos
 *                 example: 190
 *               ano_lancamento:
 *                 type: integer
 *                 description: Ano de lançamento
 *                 example: 2025
 *               classificacao_etaria:
 *                 type: string
 *                 enum: [L, 6, 12, 14, 16, 18]
 *                 description: Classificação indicativa
 *                 example: "12"
 *               nota_media:
 *                 type: number
 *                 format: float
 *                 description: Nota média do filme
 *                 example: 8.8
 *               cartaz_url:
 *                 type: string
 *                 description: URL do cartaz do filme
 *                 example: "https://example.com/poster-novo.jpg"
 *               trailer_url:
 *                 type: string
 *                 description: URL do trailer do filme
 *                 example: "https://youtube.com/watch?v=456"
 *               id_funcionario:
 *                 type: string
 *                 format: uuid
 *                 description: ID do funcionário que atualizou
 *                 example: "550e8400-e29b-41d4-a716-446655440000"
 *               pais_origem:
 *                 type: string
 *                 description: País de origem do filme
 *                 example: "EUA"
 *               idioma_original:
 *                 type: string
 *                 description: Idioma original do filme
 *                 example: "Inglês"
 *               estado_exibicao:
 *                 type: string
 *                 enum: [disponivel, indisponivel, brevemente]
 *                 description: Estado de exibição do filme
 *                 example: "brevemente"
 *               destaque:
 *                 type: boolean
 *                 description: Indica se o filme está em destaque
 *                 example: false
 *               id_genero:
 *                 type: array
 *                 description: Lista de IDs dos gêneros
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 example: ["550e8400-e29b-41d4-a716-446655440001", "550e8400-e29b-41d4-a716-446655440003"]
 *     responses:
 *       200:
 *         description: Filme atualizado com sucesso
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
 *                   example: "Filme atualizado com 2 gênero(s) com sucesso"
 *                 filme:
 *                   type: object
 *                   properties:
 *                     id_filme:
 *                       type: string
 *                       format: uuid
 *                       example: "550e8400-e29b-41d4-a716-446655440000"
 *                     titulo:
 *                       type: string
 *                       example: "Avatar 3 - O Caminho da Água"
 *                     sinopse:
 *                       type: string
 *                       example: "Uma jornada épica em Pandora com novos desafios..."
 *                     duracao_minuto:
 *                       type: integer
 *                       example: 190
 *                     ano_lancamento:
 *                       type: integer
 *                       example: 2025
 *                     classificacao_etaria:
 *                       type: string
 *                       example: "12"
 *                     nota_media:
 *                       type: number
 *                       example: 8.8
 *                     cartaz_url:
 *                       type: string
 *                       example: "https://example.com/poster-novo.jpg"
 *                     trailer_url:
 *                       type: string
 *                       example: "https://youtube.com/watch?v=456"
 *                     pais_origem:
 *                       type: string
 *                       example: "EUA"
 *                     idioma_original:
 *                       type: string
 *                       example: "Inglês"
 *                     estado_exibicao:
 *                       type: string
 *                       example: "brevemente"
 *                     destaque:
 *                       type: boolean
 *                       example: false
 *                     cadastrado_por:
 *                       type: string
 *                       format: uuid
 *                       example: "550e8400-e29b-41d4-a716-446655440000"
 *                     data_cadastro:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-15T10:30:00Z"
 *                     data_atualizacao:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-20T15:45:00Z"
 *                 generos_associados:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id_genero:
 *                         type: string
 *                         format: uuid
 *                         example: "550e8400-e29b-41d4-a716-446655440001"
 *                       nome_genero:
 *                         type: string
 *                         example: "Ação"
 *                 generos_removidos:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id_genero:
 *                         type: string
 *                         format: uuid
 *                         example: "550e8400-e29b-41d4-a716-446655440002"
 *                       nome_genero:
 *                         type: string
 *                         example: "Aventura"
 *                 generos_nao_encontrados:
 *                   type: array
 *                   items:
 *                     type: string
 *                     format: uuid
 *                     example: ["550e8400-e29b-41d4-a716-446655440099"]
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
 *                   example: "Classificação etária inválida. Valores permitidos: L, 6, 12, 14, 16, 18"
 *       404:
 *         description: Filme não encontrado
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
 *                   example: "Filme não encontrado"
 *       409:
 *         description: Filme já existe com outro título/ano
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
 *                   example: "Já existe um filme com o título 'Avatar 3' e ano '2025'"
 *       500:
 *         description: Erro interno do servidor
 */

router.delete("/genero/:id", verificarToken, autorizar("funcionario", "administrador"), async (req, res) => {
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

    // --- VERIFICAR SE GÊNERO EXISTE ---
    const checkQuery = `
            SELECT id_genero, nome_genero 
            FROM generos 
            WHERE id_genero = $1
        `;
    const checkResult = await conexao.query(checkQuery, [id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        sucesso: false,
        mensagem: "Gênero não encontrado",
      });
    }

    // --- VERIFICAR SE HÁ FILMES ASSOCIADOS ---
    const filmesQuery = `
            SELECT COUNT(*) as total
            FROM filmes_generos 
            WHERE id_genero = $1
        `;
    const filmesResult = await conexao.query(filmesQuery, [id]);

    if (parseInt(filmesResult.rows[0].total) > 0) {
      return res.status(409).json({
        sucesso: false,
        mensagem:
          "Não é possível remover o gênero pois possui filmes associados",
        filmes_associados: parseInt(filmesResult.rows[0].total),
      });
    }

    // --- REMOVER GÊNERO ---
    const deleteQuery = `
            DELETE FROM generos 
            WHERE id_genero = $1
            RETURNING id_genero, nome_genero
        `;
    const result = await conexao.query(deleteQuery, [id]);

    registrarLog({
      id_funcionario: req.usuario?.id_funcionario,
      accao: 'REMOVER_GENERO',
      tabela_afectada: 'generos',
      registo_id: id,
      ip_origem: req.ip,
    });

    res.status(200).json({
      sucesso: true,
      mensagem: "Gênero removido com sucesso",
      genero: result.rows[0],
    });
  } catch (error) {
    console.error("Erro ao remover gênero:", error);
    res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao remover gênero",
      erro: error.message,
    });
  }
});

module.exports = router;
