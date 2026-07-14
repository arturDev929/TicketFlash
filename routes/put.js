const express = require("express");
const router = express.Router();
const conexao = require("../infra/conexao");
const { verificarToken, autorizar } = require("../middleware/authMiddleware");
const {
  gerarCodigo,
  gerarMapaVisual,
  gerarSugestoes,
  gerarId,
} = require("../utils/senha");
const { registrarLog } = require("../utils/log");

/**
 * @swagger
 * /lugares/{id_lugar}:
 *   put:
 *     summary: Atualiza um lugar existente
 *     tags: [Lugares]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id_lugar
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do lugar
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - estado_permanente
 *             properties:
 *               estado_permanente:
 *                 type: string
 *                 enum: [activo, inactivo, manutencao]
 *                 description: Estado permanente do lugar
 *                 example: "ativo"
 *     responses:
 *       200:
 *         description: Sucesso
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Não encontrado
 *       500:
 *         description: Erro no servidor
 */

router.put("/lugares/:id_lugar", verificarToken, autorizar("funcionario", "administrador"), async (req, res) => {
  const { id_lugar } = req.params;
  const { estado_permanente } = req.body;

  const estadosValidos = ["ativo", "inativo", "manutencao"];
  if (!estado_permanente) {
    return res.status(400).json({
      sucesso: false,
      mensagem: "O campo estado_permanente é obrigatório",
    });
  }

  if (!estadosValidos.includes(estado_permanente)) {
    return res.status(400).json({
      sucesso: false,
      mensagem: `Estado inválido. Use: ${estadosValidos.join(", ")}`,
    });
  }

  if (!id_lugar) {
    return res.status(400).json({
      sucesso: false,
      mensagem: "ID do lugar é obrigatório",
    });
  }

  try {
    const checkQuery =
      "SELECT id_lugar, codigo_lugar, estado_permanente FROM lugares WHERE id_lugar = $1";
    const checkResult = await conexao.query(checkQuery, [id_lugar]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        sucesso: false,
        mensagem: `Lugar com ID ${id_lugar} não encontrado`,
      });
    }

    const updateQuery = `
            UPDATE lugares 
            SET estado_permanente = $1 
            WHERE id_lugar = $2 
            RETURNING *
        `;

    const updateResult = await conexao.query(updateQuery, [
      estado_permanente,
      id_lugar,
    ]);

    if (updateResult.rows.length === 0) {
      return res.status(404).json({
        sucesso: false,
        mensagem: "Lugar não encontrado ou não foi possível atualizar",
      });
    }

    const lugarAtualizado = updateResult.rows[0];

    return res.status(200).json({
      sucesso: true,
      mensagem: "Lugar atualizado com sucesso",
      lugar: {
        id_lugar: lugarAtualizado.id_lugar,
        codigo_lugar: lugarAtualizado.codigo_lugar,
        estado_permanente: lugarAtualizado.estado_permanente,
        fileira: lugarAtualizado.fileira,
        numero: lugarAtualizado.numero,
      },
    });
  } catch (err) {
    console.error("Erro detalhado ao atualizar lugar:", err);

    if (err.code === "ECONNREFUSED") {
      return res.status(500).json({
        sucesso: false,
        mensagem: "Erro de conexão com o banco de dados",
      });
    }

    return res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao atualizar lugar",
      erro: err.message,
    });
  }
});

/**
 * @swagger
 * /user/{id}:
 *   put:
 *     summary: Atualiza um utilizador
 *     description: Atualiza os dados de um utilizador e seu cargo filtrando pelo ID
 *     tags: [Utilizadores]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID do utilizador
 *         schema:
 *           type: string
 *           example: "550e8400-e29b-41d4-a716-446655440000"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome:
 *                 type: string
 *                 description: Nome do utilizador
 *                 example: "João Silva"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email do utilizador
 *                 example: "joao.silva@empresa.com"
 *               telefone:
 *                 type: string
 *                 description: Número de telefone
 *                 example: "+351 912345678"
 *               tipo_utilizador:
 *                 type: string
 *                 description: Tipo de utilizador
 *                 example: "admin"
 *               estado:
 *                 type: string
 *                 description: Estado do utilizador
 *                 example: "ativo"
 *               cargo:
 *                 type: string
 *                 description: Cargo do funcionário
 *                 example: "Desenvolvedor"
 *     responses:
 *       200:
 *         description: Utilizador atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 mensagem:
 *                   type: string
 *                   description: Mensagem de sucesso
 *                   example: "Utilizador atualizado com sucesso"
 *                 utilizador:
 *                   type: object
 *                   properties:
 *                     id_utilizador:
 *                       type: string
 *                       description: ID do utilizador
 *                       example: "550e8400-e29b-41d4-a716-446655440000"
 *                     nome:
 *                       type: string
 *                       description: Nome do utilizador
 *                       example: "João Silva"
 *                     email:
 *                       type: string
 *                       format: email
 *                       description: Email do utilizador
 *                       example: "joao.silva@empresa.com"
 *                     telefone:
 *                       type: string
 *                       description: Número de telefone
 *                       example: "+351 912345678"
 *                     tipo_utilizador:
 *                       type: string
 *                       description: Tipo de utilizador
 *                       example: "admin"
 *                     estado:
 *                       type: string
 *                       description: Estado do utilizador
 *                       example: "ativo"
 *                     data_registo:
 *                       type: string
 *                       format: date-time
 *                       description: Data de registo
 *                       example: "2024-01-15T10:30:00Z"
 *                     id_funcionario:
 *                       type: string
 *                       description: ID do funcionário
 *                       example: "660e8400-e29b-41d4-a716-446655440001"
 *                     cargo:
 *                       type: string
 *                       description: Cargo do funcionário
 *                       example: "Desenvolvedor"
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 erro:
 *                   type: string
 *                   description: Mensagem de erro
 *                   example: "Nome e email são obrigatórios"
 *       404:
 *         description: Utilizador não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 mensagem:
 *                   type: string
 *                   description: Mensagem de erro
 *                   example: "Utilizador não encontrado"
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 erro:
 *                   type: string
 *                   description: Mensagem de erro
 *                   example: "Erro ao atualizar utilizador"
 *                 detalhe:
 *                   type: string
 *                   description: Detalhe do erro
 *                   example: "Database connection error"
 */
router.put("/user/:id", verificarToken, async (req, res) => {
  const id = req.params.id;
  const { nome, email, telefone, tipo_utilizador, estado, cargo, foto_url } = req.body;

  // ✅ Um utilizador só pode editar o seu próprio perfil, a menos que seja funcionário/administrador.
  // ✅ Só funcionário/administrador podem alterar tipo_utilizador ou estado_conta de alguém.
  const solicitante = req.usuario;
  const ehStaff = solicitante && (solicitante.tipo === "funcionario" || solicitante.tipo === "administrador");
  if (!ehStaff && solicitante?.id !== id) {
    return res.status(403).json({ sucesso: false, mensagem: "Acesso negado" });
  }
  if (!ehStaff && (tipo_utilizador || estado || cargo)) {
    return res.status(403).json({
      sucesso: false,
      mensagem: "Apenas funcionário/administrador podem alterar tipo, estado ou cargo",
    });
  }

  try {
    // ✅ Buscar utilizador atual para não exigir todos os campos (permite update parcial)
    const atualResult = await conexao.query(
      "SELECT * FROM utilizadores WHERE id_utilizador = $1",
      [id]
    );
    if (atualResult.rows.length === 0) {
      return res.status(404).json({ sucesso: false, mensagem: "Utilizador não encontrado" });
    }
    const atual = atualResult.rows[0];

    const queryUtilizador = `
        UPDATE utilizadores 
        SET nome_completo = $1, 
            email = $2, 
            telefone = $3,
            tipo_utilizador = $4,
            estado_conta = $5,
            foto_url = $6
        WHERE id_utilizador = $7 
        RETURNING *
    `;

    const resultUtilizador = await conexao.query(queryUtilizador, [
      nome || atual.nome_completo,
      email || atual.email,
      telefone !== undefined ? telefone : atual.telefone,
      tipo_utilizador || atual.tipo_utilizador,
      estado || atual.estado_conta,
      foto_url !== undefined ? foto_url : atual.foto_url,
      id,
    ]);

    // Atualizar tabela funcionarios, se o utilizador for funcionário/administrador
    if (cargo && resultUtilizador.rows[0].tipo_utilizador !== "cliente") {
      await conexao.query(
        "UPDATE funcionarios SET cargo = $1 WHERE id_utilizador = $2",
        [cargo, id]
      );
    }

    // ✅ LEFT JOIN: clientes não têm registo em funcionarios
    const queryFinal = `
        SELECT * FROM utilizadores u 
        LEFT JOIN funcionarios f ON u.id_utilizador = f.id_utilizador 
        WHERE u.id_utilizador = $1
    `;
    const resultFinal = await conexao.query(queryFinal, [id]);

    const utilizador = resultFinal.rows[0];
    delete utilizador.senha_hash;

    res.status(200).json({
      mensagem: "Utilizador atualizado com sucesso",
      utilizador,
    });
  } catch (err) {
    return res.status(500).json({
      erro: "Erro ao atualizar utilizador",
      detalhe: err.message,
    });
  }
});

/**
 * @swagger
 * /genero/{id}:
 *   put:
 *     summary: Atualiza um gênero
 *     description: Atualiza os dados de um gênero existente
 *     tags: [Gêneros]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID do gênero
 *         schema:
 *           type: string
 *           format: uuid
 *           example: "550e8400-e29b-41d4-a716-446655440001"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome_genero:
 *                 type: string
 *                 description: Nome do gênero
 *                 example: "Ação"
 *               descricao:
 *                 type: string
 *                 description: Descrição do gênero
 *                 example: "Filmes com cenas de ação intensas e perseguições"
 *     responses:
 *       200:
 *         description: Gênero atualizado com sucesso
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
 *                   example: "Gênero atualizado com sucesso"
 *                 genero:
 *                   type: object
 *                   properties:
 *                     id_genero:
 *                       type: string
 *                       format: uuid
 *                       example: "550e8400-e29b-41d4-a716-446655440001"
 *                     nome_genero:
 *                       type: string
 *                       example: "Ação"
 *                     descricao:
 *                       type: string
 *                       example: "Filmes com cenas de ação intensas e perseguições"
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
 *                   example: "Nome do gênero é obrigatório"
 *       404:
 *         description: Gênero não encontrado
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
 *                   example: "Gênero não encontrado"
 *       409:
 *         description: Conflito - nome já existe
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
 *                   example: "Já existe um gênero com o nome 'Ação'"
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
 *                   example: "Erro ao atualizar gênero"
 *                 erro:
 *                   type: string
 *                   example: "Database error"
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
router.put("/salas/:id", verificarToken, autorizar("funcionario", "administrador"), async (req, res) => {
  const id_sala = req.params.id;
  const { nome_sala, capacidade_total, tipo_sala, estado_sala, coluna, fila } =
    req.body;

  // --- VALIDAÇÕES BÁSICAS ---
  if (!nome_sala || nome_sala.trim() === "") {
    return res.status(400).json({
      sucesso: false,
      mensagem: "Nome da sala é obrigatório",
    });
  }

  if (!capacidade_total || capacidade_total <= 0) {
    return res.status(400).json({
      sucesso: false,
      mensagem: "Capacidade total deve ser maior que 0",
    });
  }

  if (capacidade_total > 200) {
    return res.status(400).json({
      sucesso: false,
      mensagem: "Capacidade máxima permitida é de 200 lugares",
    });
  }

  if (coluna < 1 || coluna > 20) {
    return res.status(400).json({
      sucesso: false,
      mensagem: "Número de colunas deve ser entre 1 e 20",
    });
  }

  // --- CALCULAR CONFIGURAÇÃO ---
  const lugaresPorFila = coluna;
  let totalFilas;
  let totalPosicoes;

  if (fila && fila > 0) {
    totalFilas = fila;
    totalPosicoes = totalFilas * lugaresPorFila;

    if (capacidade_total > totalPosicoes) {
      const sugestoes = gerarSugestoes(capacidade_total, coluna, fila);

      return res.status(400).json({
        sucesso: false,
        mensagem: `Capacidade total (${capacidade_total}) excede o total de posições (${totalPosicoes}) com ${totalFilas} filas e ${lugaresPorFila} colunas`,
        sugestoes: sugestoes,
      });
    }
  } else {
    totalFilas = Math.ceil(capacidade_total / lugaresPorFila);
    totalPosicoes = totalFilas * lugaresPorFila;
  }

  try {
    // --- VERIFICAR SE SALA EXISTE ---
    const verificarSalaQuery = `
            SELECT id_sala, nome_sala, tipo_sala 
            FROM salas 
            WHERE id_sala = $1
        `;
    const salaExistente = await conexao.query(verificarSalaQuery, [id_sala]);

    if (salaExistente.rows.length === 0) {
      return res.status(404).json({
        sucesso: false,
        mensagem: "Sala não encontrada",
      });
    }

    // --- VERIFICAR SE JÁ EXISTE OUTRA SALA COM MESMO NOME E TIPO ---
    const verificarDuplicado = `
            SELECT id_sala FROM salas 
            WHERE nome_sala = $1 AND tipo_sala = $2 AND id_sala != $3
        `;
    const duplicado = await conexao.query(verificarDuplicado, [
      nome_sala.trim(),
      tipo_sala,
      id_sala,
    ]);

    if (duplicado.rows.length > 0) {
      return res.status(409).json({
        sucesso: false,
        mensagem: `Já existe uma sala com o nome "${nome_sala}" e tipo "${tipo_sala}"`,
        sala_existente: {
          id_sala: duplicado.rows[0].id_sala,
        },
      });
    }

    // --- INICIAR TRANSAÇÃO ---
    await conexao.query("BEGIN");

    // --- BUSCAR LUGARES ATUAIS ---
    const buscarLugaresAtuais = `
            SELECT id_lugar, codigo_lugar, fileira, numero, estado_permanente
            FROM lugares 
            WHERE id_sala = $1
        `;
    const lugaresAtuais = await conexao.query(buscarLugaresAtuais, [id_sala]);

    // --- GERAR NOVOS CÓDIGOS DE LUGARES ---
    const fileiras = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    const novosCodigos = new Set();
    let lugaresParaManter = 0;
    let lugaresParaRemover = 0;
    let lugaresParaAdicionar = 0;

    // Criar mapa dos lugares existentes por código
    const mapaCodigosExistentes = {};
    lugaresAtuais.rows.forEach((lugar) => {
      mapaCodigosExistentes[lugar.codigo_lugar] = lugar;
    });

    // Gerar novos códigos baseados na nova configuração
    for (let f = 0; f < totalFilas; f++) {
      const letraFileira = fileiras[f % fileiras.length];
      for (let c = 0; c < lugaresPorFila; c++) {
        const codigo = `${letraFileira}${c + 1}`;
        novosCodigos.add(codigo);
      }
    }

    // --- REMOVER LUGARES QUE NÃO ESTÃO NA NOVA CONFIGURAÇÃO ---
    for (const lugar of lugaresAtuais.rows) {
      if (!novosCodigos.has(lugar.codigo_lugar)) {
        const sqlRemover = `DELETE FROM lugares WHERE id_lugar = $1`;
        await conexao.query(sqlRemover, [lugar.id_lugar]);
        lugaresParaRemover++;
      } else {
        lugaresParaManter++;
      }
    }

    // --- ADICIONAR NOVOS LUGARES ---
    let lugaresInseridos = 0;
    const lugaresGerados = [];
    const lugaresOrganizados = [];

    for (
      let f = 0;
      f < totalFilas && lugaresInseridos < capacidade_total;
      f++
    ) {
      const letraFileira = fileiras[f % fileiras.length];
      const linha = [];
      let linhaTemAtivos = false;

      const lugaresRestantes = capacidade_total - lugaresInseridos;
      const lugaresNaFila = Math.min(lugaresPorFila, lugaresRestantes);

      for (let numero = 1; numero <= lugaresNaFila; numero++) {
        const codigo_lugar = `${letraFileira}${numero}`;

        // Verificar se o lugar já existe
        if (mapaCodigosExistentes[codigo_lugar]) {
          // Lugar já existe, manter
          const lugarExistente = mapaCodigosExistentes[codigo_lugar];
          linha.push({
            id_lugar: lugarExistente.id_lugar,
            codigo_lugar: lugarExistente.codigo_lugar,
            fileira: lugarExistente.fileira,
            numero: lugarExistente.numero,
            estado_permanente: lugarExistente.estado_permanente,
            ativo: true,
          });
          lugaresGerados.push({
            id_lugar: lugarExistente.id_lugar,
            codigo_lugar: lugarExistente.codigo_lugar,
            fileira: lugarExistente.fileira,
            numero: lugarExistente.numero,
            estado_permanente: lugarExistente.estado_permanente,
            ativo: true,
          });
          linhaTemAtivos = true;
          lugaresInseridos++;
        } else {
          // Criar novo lugar
          const id_lugar = gerarId();
          const codigo_unico = gerarCodigo();

          const insertLugarQuery = `
                        INSERT INTO lugares (id_lugar, id_sala, codigo_lugar, fileira, numero, estado_permanente, codigo)
                        VALUES ($1, $2, $3, $4, $5, 'ativo', $6)
                        RETURNING *
                    `;

          const lugarResult = await conexao.query(insertLugarQuery, [
            id_lugar,
            id_sala,
            codigo_lugar,
            letraFileira,
            numero,
            codigo_unico,
          ]);

          const lugarObj = {
            id_lugar: lugarResult.rows[0].id_lugar,
            codigo_lugar: lugarResult.rows[0].codigo_lugar,
            fileira: lugarResult.rows[0].fileira,
            numero: lugarResult.rows[0].numero,
            estado_permanente: lugarResult.rows[0].estado_permanente,
            codigo: lugarResult.rows[0].codigo,
            ativo: true,
          };

          lugaresGerados.push(lugarObj);
          linha.push(lugarObj);
          linhaTemAtivos = true;
          lugaresInseridos++;
          lugaresParaAdicionar++;
        }
      }

      // --- COMPLETAR LINHA COM LUGARES VAZIOS (INATIVOS) ---
      if (linhaTemAtivos) {
        for (let c = linha.length; c < lugaresPorFila; c++) {
          const codigoLugar = `${letraFileira}${c + 1}`;
          linha.push({
            codigo_lugar: codigoLugar,
            fileira: letraFileira,
            numero: c + 1,
            ativo: false,
            id_lugar: null,
            estado_permanente: null,
          });
        }

        lugaresOrganizados.push({
          fila: letraFileira,
          lugares: linha,
          total_ativos: linha.filter((l) => l.ativo).length,
          total_vazios: linha.filter((l) => !l.ativo).length,
        });
      }
    }

    // --- ADICIONAR FILAS COMPLETAMENTE VAZIAS (SE NECESSÁRIO) ---
    for (let f = lugaresOrganizados.length; f < totalFilas; f++) {
      const letraFileira = fileiras[f % fileiras.length];
      const linha = [];

      for (let c = 0; c < lugaresPorFila; c++) {
        const codigoLugar = `${letraFileira}${c + 1}`;
        linha.push({
          codigo_lugar: codigoLugar,
          fileira: letraFileira,
          numero: c + 1,
          ativo: false,
          id_lugar: null,
          estado_permanente: null,
        });
      }

      lugaresOrganizados.push({
        fila: letraFileira,
        lugares: linha,
        total_ativos: 0,
        total_vazios: lugaresPorFila,
      });
    }

    // --- ATUALIZAR SALA ---
    const updateSalaQuery = `
            UPDATE salas 
            SET nome_sala = $1, 
                capacidade_total = $2, 
                tipo_sala = $3, 
                estado_sala = $4, 
                coluna = $5, 
                fila = $6
            WHERE id_sala = $7
            RETURNING *
        `;

    const salaAtualizada = await conexao.query(updateSalaQuery, [
      nome_sala.trim(),
      lugaresInseridos,
      tipo_sala,
      estado_sala,
      lugaresPorFila,
      totalFilas,
      id_sala,
    ]);

    // --- COMMIT DA TRANSAÇÃO ---
    await conexao.query("COMMIT");

    // --- GERAR MAPA VISUAL ---
    const mapaVisual = gerarMapaVisual(lugaresOrganizados, lugaresPorFila);

    // --- CALCULAR ESTATÍSTICAS ---
    const lugaresVazios = totalPosicoes - lugaresInseridos;
    const porcentagemOcupacao = Math.round(
      (lugaresInseridos / totalPosicoes) * 100,
    );

    res.status(200).json({
      sucesso: true,
      mensagem: `Sala atualizada com ${lugaresInseridos} lugares com sucesso`,
      sala: salaAtualizada.rows[0],
      lugares_afetados: {
        adicionados: lugaresParaAdicionar,
        removidos: lugaresParaRemover,
        mantidos: lugaresParaManter,
      },
      configuracao: {
        colunas: lugaresPorFila,
        filas: totalFilas,
        total_posicoes: totalPosicoes,
        lugares_ocupados: lugaresInseridos,
        lugares_vazios: lugaresVazios,
        capacidade_solicitada: capacidade_total,
        porcentagem_ocupacao: `${porcentagemOcupacao}%`,
      },
      estatisticas: {
        total_lugares: lugaresInseridos,
        lugares_ativos: lugaresInseridos,
        lugares_inativos: lugaresVazios,
        filas_completas: Math.floor(lugaresInseridos / lugaresPorFila),
        filas_parciais: lugaresInseridos % lugaresPorFila > 0 ? 1 : 0,
        ultima_fila_lugares:
          lugaresInseridos % lugaresPorFila || lugaresPorFila,
        lugares_por_fila: lugaresOrganizados.map((f) => ({
          fila: f.fila,
          ativos: f.total_ativos,
          vazios: f.total_vazios,
        })),
      },
      lugares: lugaresOrganizados,
      mapa_visual: mapaVisual,
    });
  } catch (err) {
    // --- ROLLBACK EM CASO DE ERRO ---
    await conexao.query("ROLLBACK");

    console.error("Erro ao atualizar sala:", err);
    res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao atualizar sala",
      erro: err.message,
    });
  }
});

/**
 * @swagger
 * /sala/{idSala}/assentos/{idLugar}:
 *   put:
 *     summary: Alterar estado de um assento
 *     description: Atualiza o estado permanente de um assento específico de uma sala
 *     tags: [Salas]
 *     parameters:
 *       - in: path
 *         name: idSala
 *         required: true
 *         description: ID da sala
 *         schema:
 *           type: string
 *           format: uuid
 *           example: "550e8400-e29b-41d4-a716-446655440000"
 *       - in: path
 *         name: idLugar
 *         required: true
 *         description: ID do lugar
 *         schema:
 *           type: string
 *           format: uuid
 *           example: "660e8400-e29b-41d4-a716-446655440001"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - estado_permanente
 *             properties:
 *               estado_permanente:
 *                 type: string
 *                 enum: [activo, inactivo, manutencao]
 *                 description: Novo estado do assento
 *                 example: "manutencao"
 *     responses:
 *       200:
 *         description: Assento atualizado com sucesso
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
 *                   example: "Estado do assento atualizado com sucesso"
 *                 assento:
 *                   type: object
 *                   properties:
 *                     id_lugar:
 *                       type: string
 *                       format: uuid
 *                       example: "660e8400-e29b-41d4-a716-446655440001"
 *                     codigo_lugar:
 *                       type: string
 *                       example: "A1"
 *                     fileira:
 *                       type: string
 *                       example: "A"
 *                     numero:
 *                       type: integer
 *                       example: 1
 *                     estado_permanente:
 *                       type: string
 *                       enum: [activo, inactivo, manutencao]
 *                       example: "manutencao"
 *                     id_sala:
 *                       type: string
 *                       format: uuid
 *                       example: "550e8400-e29b-41d4-a716-446655440000"
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
 *                   example: "Estado inválido. Valores permitidos: activo, inactivo, manutencao"
 *       404:
 *         description: Sala ou assento não encontrado
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
 *                   example: "Assento não encontrado nesta sala"
 *       409:
 *         description: Conflito - assento com reservas ativas
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
 *                   example: "Não é possível alterar o estado. O assento possui reservas ativas"
 *                 reservas_ativas:
 *                   type: integer
 *                   example: 3
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
 *                   example: "Erro ao atualizar estado do assento"
 *                 erro:
 *                   type: string
 *                   example: "Database error"
 */
router.put("/sala/:idSala/assentos/:idLugar", verificarToken, autorizar("funcionario", "administrador"), async (req, res) => {
  const id_sala = req.params.idSala;
  const id_lugar = req.params.idLugar;
  const { estado_permanente } = req.body;

  // --- VALIDAÇÕES ---
  const estadosPermitidos = ["ativo", "inativo", "manutencao"];

  if (!estado_permanente) {
    return res.status(400).json({
      sucesso: false,
      mensagem: "Estado permanente é obrigatório",
    });
  }

  if (!estadosPermitidos.includes(estado_permanente.toLowerCase())) {
    return res.status(400).json({
      sucesso: false,
      mensagem: `Estado inválido. Valores permitidos: ${estadosPermitidos.join(", ")}`,
      valor_enviado: estado_permanente,
    });
  }

  try {
    // --- VERIFICAR SE A SALA EXISTE ---
    const verificarSalaQuery = `
            SELECT id_sala, nome_sala FROM salas WHERE id_sala = $1
        `;
    const salaResult = await conexao.query(verificarSalaQuery, [id_sala]);

    if (salaResult.rows.length === 0) {
      return res.status(404).json({
        sucesso: false,
        mensagem: "Sala não encontrada",
      });
    }

    // --- VERIFICAR SE O ASSENTO EXISTE E PERTENCE À SALA ---
    const verificarAssentoQuery = `
            SELECT id_lugar, codigo_lugar, fileira, numero, estado_permanente, id_sala
            FROM lugares 
            WHERE id_lugar = $1 AND id_sala = $2
        `;
    const assentoResult = await conexao.query(verificarAssentoQuery, [
      id_lugar,
      id_sala,
    ]);

    if (assentoResult.rows.length === 0) {
      return res.status(404).json({
        sucesso: false,
        mensagem: "Assento não encontrado nesta sala",
      });
    }

    const assento = assentoResult.rows[0];

    // --- VERIFICAR SE O ASSENTO TEM RESERVAS ATIVAS (se for desativar) ---
    if (
      estado_permanente.toLowerCase() === "inativo" ||
      estado_permanente.toLowerCase() === "manutencao"
    ) {
      const verificarReservasQuery = `
                SELECT COUNT(*) as total
                FROM lugares_ocupados
                WHERE id_lugar = $1 
                AND status IN ('ocupado', 'reservado', 'pendente')
                AND data_reserva > NOW() - INTERVAL '2 hours'
            `;
      const reservasResult = await conexao.query(verificarReservasQuery, [
        id_lugar,
      ]);

      if (parseInt(reservasResult.rows[0].total) > 0) {
        return res.status(409).json({
          sucesso: false,
          mensagem: `Não é possível alterar o estado. O assento possui ${reservasResult.rows[0].total} reserva(s) ativa(s)`,
          reservas_ativas: parseInt(reservasResult.rows[0].total),
        });
      }
    }

    // --- ATUALIZAR ESTADO DO ASSENTO ---
    const updateQuery = `
            UPDATE lugares 
            SET estado_permanente = $1
            WHERE id_lugar = $2 AND id_sala = $3
            RETURNING id_lugar, codigo_lugar, fileira, numero, estado_permanente, id_sala
        `;

    const result = await conexao.query(updateQuery, [
      estado_permanente.toLowerCase(),
      id_lugar,
      id_sala,
    ]);

    // --- LOG DA ALTERAÇÃO (opcional) ---
    console.log(
      `Assento ${result.rows[0].codigo_lugar} da sala ${salaResult.rows[0].nome_sala} alterado para ${estado_permanente}`,
    );

    res.status(200).json({
      sucesso: true,
      mensagem: `Estado do assento atualizado com sucesso para '${estado_permanente}'`,
      assento: {
        ...result.rows[0],
        sala: {
          id_sala: salaResult.rows[0].id_sala,
          nome_sala: salaResult.rows[0].nome_sala,
        },
        estado_anterior: assento.estado_permanente,
        estado_atual: estado_permanente.toLowerCase(),
      },
    });
  } catch (error) {
    console.error("Erro ao atualizar estado do assento:", error);
    res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao atualizar estado do assento",
      erro: error.message,
    });
  }
});

/**
 * @swagger
 * /client/{id}:
 *   put:
 *     summary: Atualizar dados do cliente
 *     description: Atualiza o nome e telefone do cliente
 *     tags: [Clientes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID do cliente
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
 *               nome_completo:
 *                 type: string
 *                 description: Nome completo do cliente
 *                 example: "João Silva Atualizado"
 *               telefone:
 *                 type: string
 *                 description: Número de telefone
 *                 example: "+351 912345679"
 *     responses:
 *       200:
 *         description: Cliente atualizado com sucesso
 *       400:
 *         description: Dados inválidos
 *       404:
 *         description: Cliente não encontrado
 *       500:
 *         description: Erro interno do servidor
 */
router.put("/client/:id", verificarToken, async (req, res) => {
  const id_utilizador = req.params.id;
  const { nome_completo, telefone } = req.body;

  const solicitante = req.usuario;
  const ehStaff = solicitante && (solicitante.tipo === "funcionario" || solicitante.tipo === "administrador");
  if (!ehStaff && solicitante?.id !== id_utilizador) {
    return res.status(403).json({ sucesso: false, mensagem: "Acesso negado" });
  }

  // --- VALIDAÇÃO ---
  if (!nome_completo && !telefone) {
    return res.status(400).json({
      sucesso: false,
      mensagem: "Pelo menos um campo deve ser informado para atualização",
    });
  }

  try {
    // --- VERIFICAR SE CLIENTE EXISTE ---
    const verificarQuery = `
            SELECT id_utilizador FROM utilizadores WHERE id_utilizador = $1
        `;
    const existe = await conexao.query(verificarQuery, [id_utilizador]);

    if (existe.rows.length === 0) {
      return res.status(404).json({
        sucesso: false,
        mensagem: "Cliente não encontrado",
      });
    }

    // --- SQL CORRETO ---
    // Usando VÍRGULA (,) para separar os campos, não AND
    const sql = `
            UPDATE utilizadores 
            SET nome_completo = $1, 
                telefone = $2
            WHERE id_utilizador = $3
            RETURNING id_utilizador, nome_completo, email, telefone, tipo_utilizador, estado_conta, data_cadastro
        `;

    const values = [nome_completo || null, telefone || null, id_utilizador];

    const result = await conexao.query(sql, values);

    res.status(200).json({
      sucesso: true,
      mensagem: "Dados do cliente atualizados com sucesso",
      cliente: result.rows[0],
    });
  } catch (error) {
    console.error("Erro ao atualizar cliente:", error);
    res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao atualizar cliente",
      erro: error.message,
    });
  }
});

router.put("/clientSenha/:id", async (req, res) => {});

router.put("/clientRecuperarSenha", async (req, res) => {
  const email = req.body;
});

// post.js
router.put("/ingressos/:id/cancelar", verificarToken, async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({
      sucesso: false,
      mensagem: "ID da compra ou número da factura é obrigatório",
    });
  }

  try {
    // --- BUSCAR COMPRA ---
    const compraQuery = `
            SELECT c.id_compra, 
                   c.numero_factura, 
                   c.estado_pagamento, 
                   c.valor_total,
                   c.id_sessao,
                   s.data_hora_inicio,
                   s.estado_sessao
            FROM compras c
            INNER JOIN sessoes s ON s.id_sessao = c.id_sessao
            WHERE c.numero_factura = $1 OR c.id_compra = $1
        `;
    const compraResult = await conexao.query(compraQuery, [id]);

    if (compraResult.rows.length === 0) {
      return res.status(404).json({
        sucesso: false,
        mensagem: "Ingresso não encontrado",
      });
    }

    const compra = compraResult.rows[0];

    // ✅ Só o cliente dono da compra ou um funcionário/administrador pode cancelar
    const solicitante = req.usuario;
    const ehStaff = solicitante && (solicitante.tipo === "funcionario" || solicitante.tipo === "administrador");
    if (!ehStaff) {
      const donoQuery = await conexao.query(
        "SELECT id_cliente FROM compras WHERE id_compra = $1",
        [compra.id_compra]
      );
      if (donoQuery.rows[0]?.id_cliente !== solicitante?.id) {
        return res.status(403).json({ sucesso: false, mensagem: "Acesso negado" });
      }
    }

    // Verificar se já foi cancelado
    if (compra.estado_pagamento === "cancelado") {
      return res.status(409).json({
        sucesso: false,
        mensagem: "Este ingresso já foi cancelado",
      });
    }

    // Verificar se a sessão já passou
    const agora = new Date();
    const inicioSessao = new Date(compra.data_hora_inicio);
    if (agora >= inicioSessao) {
      return res.status(409).json({
        sucesso: false,
        mensagem: "Não é possível cancelar ingressos para sessões já iniciadas",
      });
    }

    // Verificar se a sessão foi cancelada
    if (compra.estado_sessao === "cancelada") {
      return res.status(409).json({
        sucesso: false,
        mensagem:
          "Esta sessão foi cancelada. O reembolso será processado automaticamente.",
      });
    }

    // --- CANCELAR COMPRA ---
    const updateCompraQuery = `
            UPDATE compras 
            SET estado_pagamento = 'cancelado',
                data_cancelamento = CURRENT_TIMESTAMP,
                valor_reembolsado = valor_total
            WHERE id_compra = $1
            RETURNING *
        `;
    const compraAtualizada = await conexao.query(updateCompraQuery, [
      compra.id_compra,
    ]);

    // --- LIBERAR LUGARES ---
    // ✅ codigo_lugar pertence à tabela lugares, não a lugares_ocupados: usar JOIN via UPDATE...FROM
    const liberarLugaresQuery = `
            UPDATE lugares_ocupados lo
            SET status = 'cancelado'
            FROM lugares l
            WHERE lo.id_lugar = l.id_lugar
            AND lo.id_compra = $1
            RETURNING lo.id_lugar, l.codigo_lugar
        `;
    const lugaresLiberados = await conexao.query(liberarLugaresQuery, [
      compra.id_compra,
    ]);

    // --- CANCELAR BILHETES DA COMPRA ---
    await conexao.query(
      `UPDATE bilhetes SET estado_uso = 'cancelado' WHERE id_compra = $1 AND estado_uso != 'usado'`,
      [compra.id_compra]
    );

    res.status(200).json({
      sucesso: true,
      mensagem: "Ingresso cancelado com sucesso",
      compra: compraAtualizada.rows[0],
      lugares_liberados: lugaresLiberados.rows,
      reembolso: {
        valor: compra.valor_total,
        data: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Erro ao cancelar ingresso:", error);
    res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao cancelar ingresso",
      erro: error.message,
    });
  }
});

// put.js - Adicionar no final do arquivo, antes de module.exports

// put.js - Rota PUT /sessoes/:id

/**
 * @swagger
 * /sessoes/{id}:
 *   put:
 *     summary: Atualiza uma sessão existente
 *     tags: [Sessões]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id_filme:
 *                 type: string
 *                 format: uuid
 *               id_sala:
 *                 type: string
 *                 format: uuid
 *               data_hora_inicio:
 *                 type: string
 *                 format: date-time
 *               data_hora_fim:
 *                 type: string
 *                 format: date-time
 *               tipo_sessao:
 *                 type: string
 *               preco:
 *                 type: number
 *               estado_sessao:
 *                 type: string
 *               observacoes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Sessão atualizada com sucesso
 *       400:
 *         description: Dados inválidos
 *       404:
 *         description: Sessão não encontrada
 */
router.put("/sessoes/:id", verificarToken, autorizar("funcionario", "administrador"), async (req, res) => {
  const { id } = req.params;
  const {
    id_filme,
    id_sala,
    data_hora_inicio,
    data_hora_fim,
    tipo_sessao,
    preco,
    estado_sessao,
    observacoes,
    criado_por, // ← IGNORAR este campo na atualização
  } = req.body;

  // --- VALIDAR ID ---
  if (!id) {
    return res.status(400).json({
      sucesso: false,
      mensagem: "ID da sessão é obrigatório",
    });
  }

  try {
    // --- VERIFICAR SE SESSÃO EXISTE ---
    const checkQuery = `
      SELECT id_sessao, id_sala, estado_sessao, data_hora_inicio, data_hora_fim
      FROM sessoes 
      WHERE id_sessao = $1
    `;
    const checkResult = await conexao.query(checkQuery, [id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        sucesso: false,
        mensagem: "Sessão não encontrada",
      });
    }

    const sessaoAtual = checkResult.rows[0];

    // --- CONSTRUIR QUERY DINÂMICA ---
    const updates = [];
    const values = [];
    let paramCount = 1;

    // Não permitir atualizar criado_por
    // Não permitir atualizar campos vazios

    if (id_filme !== undefined && id_filme !== null && id_filme !== "") {
      updates.push(`id_filme = $${paramCount}`);
      values.push(id_filme);
      paramCount++;
    }

    if (id_sala !== undefined && id_sala !== null && id_sala !== "") {
      // Verificar conflitos na nova sala
      if (id_sala !== sessaoAtual.id_sala) {
        const inicio = data_hora_inicio
          ? new Date(data_hora_inicio)
          : new Date(sessaoAtual.data_hora_inicio);
        const fim = data_hora_fim
          ? new Date(data_hora_fim)
          : new Date(sessaoAtual.data_hora_fim);

        const conflitoQuery = `
          SELECT id_sessao, data_hora_inicio, data_hora_fim
          FROM sessoes 
          WHERE id_sala = $1 
          AND id_sessao != $2
          AND estado_sessao NOT IN ('cancelada', 'concluida')
          AND (
            (data_hora_inicio <= $3 AND data_hora_fim >= $3) OR
            (data_hora_inicio <= $4 AND data_hora_fim >= $4) OR
            (data_hora_inicio >= $3 AND data_hora_fim <= $4)
          )
        `;
        const conflitoResult = await conexao.query(conflitoQuery, [
          id_sala,
          id,
          inicio,
          fim,
        ]);

        if (conflitoResult.rows.length > 0) {
          return res.status(409).json({
            sucesso: false,
            mensagem: "A sala selecionada já possui uma sessão neste horário",
            conflito: conflitoResult.rows[0],
          });
        }
      }

      updates.push(`id_sala = $${paramCount}`);
      values.push(id_sala);
      paramCount++;
    }

    if (
      data_hora_inicio !== undefined &&
      data_hora_inicio !== null &&
      data_hora_inicio !== ""
    ) {
      const inicio = new Date(data_hora_inicio);
      const fim = data_hora_fim
        ? new Date(data_hora_fim)
        : new Date(sessaoAtual.data_hora_fim);

      if (inicio >= fim) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "Data/hora de início deve ser anterior à data/hora de fim",
        });
      }

      updates.push(`data_hora_inicio = $${paramCount}`);
      values.push(inicio);
      paramCount++;
    }

    if (
      data_hora_fim !== undefined &&
      data_hora_fim !== null &&
      data_hora_fim !== ""
    ) {
      const inicio = data_hora_inicio
        ? new Date(data_hora_inicio)
        : new Date(sessaoAtual.data_hora_inicio);
      const fim = new Date(data_hora_fim);

      if (inicio >= fim) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "Data/hora de início deve ser anterior à data/hora de fim",
        });
      }

      updates.push(`data_hora_fim = $${paramCount}`);
      values.push(fim);
      paramCount++;
    }

    if (
      tipo_sessao !== undefined &&
      tipo_sessao !== null &&
      tipo_sessao !== ""
    ) {
      updates.push(`tipo_sessao = $${paramCount}`);
      values.push(tipo_sessao);
      paramCount++;
    }

    if (preco !== undefined && preco !== null && preco !== "") {
      const precoNum = Number(preco);
      if (precoNum <= 0) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "O preço deve ser maior que zero",
        });
      }
      updates.push(`preco = $${paramCount}`);
      values.push(precoNum);
      paramCount++;
    }

    if (
      estado_sessao !== undefined &&
      estado_sessao !== null &&
      estado_sessao !== ""
    ) {
      // Validar estado
      const estadosPermitidos = [
        "agendada",
        "em_andamento",
        "concluida",
        "cancelada",
      ];
      const estadoNormalizado = estado_sessao.toLowerCase();

      if (!estadosPermitidos.includes(estadoNormalizado)) {
        return res.status(400).json({
          sucesso: false,
          mensagem: `Estado inválido. Valores permitidos: ${estadosPermitidos.join(", ")}`,
        });
      }

      // Verificar se é permitido mudar para este estado
      const estadoAtualNormalizado = sessaoAtual.estado_sessao.toLowerCase();

      // Se o estado já é o mesmo, não faz nada
      if (estadoNormalizado !== estadoAtualNormalizado) {
        // Transições válidas — mesma regra usada em PATCH /sessoes/:id/estado
        const transicoesValidas = {
          agendada: ["em_andamento", "cancelada"],
          em_andamento: ["concluida", "cancelada"],
          concluida: [],
          cancelada: [],
        };

        if (
          !transicoesValidas[estadoAtualNormalizado]?.includes(
            estadoNormalizado,
          )
        ) {
          return res.status(409).json({
            sucesso: false,
            mensagem: `Não é possível mudar de "${estadoAtualNormalizado}" para "${estadoNormalizado}"`,
            estado_atual: estadoAtualNormalizado,
            estado_solicitado: estadoNormalizado,
            transicoes_permitidas:
              transicoesValidas[estadoAtualNormalizado] || [],
          });
        }
      }

      updates.push(`estado_sessao = $${paramCount}`);
      values.push(estadoNormalizado);
      paramCount++;
    }

    if (observacoes !== undefined) {
      updates.push(`observacoes = $${paramCount}`);
      values.push(observacoes || null);
      paramCount++;
    }

    // Se não houver atualizações
    if (updates.length === 0) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Nenhum campo para atualizar",
      });
    }

    // Adicionar data_atualizacao
    updates.push(`data_atualizacao = CURRENT_TIMESTAMP`);

    // --- EXECUTAR UPDATE ---
    values.push(id);
    const query = `
      UPDATE sessoes 
      SET ${updates.join(", ")}
      WHERE id_sessao = $${paramCount}
      RETURNING *
    `;

    console.log("📝 Query:", query);
    console.log("📝 Values:", values);

    const result = await conexao.query(query, values);

    res.status(200).json({
      sucesso: true,
      mensagem: "Sessão atualizada com sucesso",
      sessao: result.rows[0],
    });
  } catch (error) {
    console.error("Erro ao atualizar sessão:", error);
    res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao atualizar sessão",
      erro: error.message,
    });
  }
});
// put.js - Adicionar esta rota

/**
 * @swagger
 * /sessoes/{id}/estado:
 *   patch:
 *     summary: Atualiza apenas o estado de uma sessão
 *     description: Atualiza o estado de uma sessão (agendada, em_andamento, concluida, cancelada)
 *     tags: [Sessões]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID da sessão
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - estado_sessao
 *             properties:
 *               estado_sessao:
 *                 type: string
 *                 enum: [agendada, em_andamento, concluida, cancelada]
 *                 description: Novo estado da sessão
 *     responses:
 *       200:
 *         description: Estado atualizado com sucesso
 *       400:
 *         description: Estado inválido
 *       404:
 *         description: Sessão não encontrada
 *       409:
 *         description: Transição de estado inválida
 *       500:
 *         description: Erro interno do servidor
 */
router.patch("/sessoes/:id/estado", verificarToken, autorizar("funcionario", "administrador"), async (req, res) => {
  const { id } = req.params;
  const { estado_sessao } = req.body;

  if (!id) {
    return res.status(400).json({
      sucesso: false,
      mensagem: "ID da sessão é obrigatório",
    });
  }

  if (!estado_sessao) {
    return res.status(400).json({
      sucesso: false,
      mensagem: "Estado da sessão é obrigatório",
    });
  }

  const estadosPermitidos = [
    "agendada",
    "em_andamento",
    "concluida",
    "cancelada",
  ];
  const estadoNormalizado = estado_sessao.toLowerCase();

  if (!estadosPermitidos.includes(estadoNormalizado)) {
    return res.status(400).json({
      sucesso: false,
      mensagem: `Estado inválido. Valores permitidos: ${estadosPermitidos.join(", ")}`,
    });
  }

  try {
    // --- VERIFICAR SE SESSÃO EXISTE ---
    const checkQuery = `
      SELECT id_sessao, id_filme, estado_sessao, data_hora_inicio, data_hora_fim
      FROM sessoes 
      WHERE id_sessao = $1
    `;
    const checkResult = await conexao.query(checkQuery, [id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        sucesso: false,
        mensagem: "Sessão não encontrada",
      });
    }

    const sessao = checkResult.rows[0];
    const estadoAtual = sessao.estado_sessao;

    // Se o estado já é o mesmo, retorna sucesso sem fazer nada
    if (estadoAtual === estadoNormalizado) {
      return res.status(200).json({
        sucesso: true,
        mensagem: `A sessão já está no estado "${estadoNormalizado}"`,
        sessao: sessao,
        estado_anterior: estadoAtual,
        estado_novo: estadoNormalizado,
        ja_estava: true,
      });
    }

    // --- VALIDAR TRANSIÇÃO DE ESTADO ---
    const transicoesValidas = {
      agendada: ["em_andamento", "cancelada"],
      em_andamento: ["concluida", "cancelada"],
      concluida: [],
      cancelada: [],
    };

    if (!transicoesValidas[estadoAtual]?.includes(estadoNormalizado)) {
      return res.status(409).json({
        sucesso: false,
        mensagem: `Não é possível mudar de "${estadoAtual}" para "${estadoNormalizado}"`,
        estado_atual: estadoAtual,
        estado_solicitado: estadoNormalizado,
        transicoes_permitidas: transicoesValidas[estadoAtual] || [],
      });
    }

    // --- ATUALIZAR ESTADO ---
    const updateQuery = `
      UPDATE sessoes 
      SET estado_sessao = $1,
          data_atualizacao = CURRENT_TIMESTAMP
      WHERE id_sessao = $2
      RETURNING *
    `;

    const result = await conexao.query(updateQuery, [estadoNormalizado, id]);

    // Se for cancelada, liberar lugares e cancelar compras
    if (estadoNormalizado === "cancelada") {
      // Liberar lugares ocupados
      await conexao.query(
        `
        UPDATE lugares_ocupados 
        SET status = 'cancelado'
        WHERE id_sessao = $1
        AND status IN ('ocupado', 'pendente', 'reservado')
      `,
        [id],
      );

      // Cancelar compras
      await conexao.query(
        `
        UPDATE compras 
        SET estado_pagamento = 'cancelado',
            data_cancelamento = CURRENT_TIMESTAMP,
            valor_reembolsado = valor_total
        WHERE id_sessao = $1
        AND estado_pagamento != 'cancelado'
      `,
        [id],
      );

      // Cancelar bilhetes
      await conexao.query(
        `UPDATE bilhetes SET estado_uso = 'cancelado' WHERE id_sessao = $1 AND estado_uso != 'usado'`,
        [id],
      );
    }

    // --- ATUALIZAR HISTÓRICO DE EXIBIÇÃO QUANDO A SESSÃO É CONCLUÍDA ---
    if (estadoNormalizado === "concluida") {
      try {
        const metricas = await conexao.query(
          `
          SELECT
            COUNT(DISTINCT b.id_bilhete) AS total_bilhetes,
            COALESCE(SUM(c.valor_total), 0) AS receita
          FROM compras c
          LEFT JOIN bilhetes b ON b.id_compra = c.id_compra
          WHERE c.id_sessao = $1 AND c.estado_pagamento != 'cancelado'
          `,
          [id]
        );
        const { total_bilhetes, receita } = metricas.rows[0];

        const existente = await conexao.query(
          `SELECT id_historico FROM historico_exibicoes
           WHERE id_filme = $1 AND data_fim_exibicao IS NULL`,
          [sessao.id_filme || result.rows[0].id_filme]
        );

        if (existente.rows.length > 0) {
          await conexao.query(
            `UPDATE historico_exibicoes
             SET total_sessoes = total_sessoes + 1,
                 total_bilhetes_vendidos = total_bilhetes_vendidos + $2,
                 receita_total = receita_total + $3
             WHERE id_historico = $1`,
            [existente.rows[0].id_historico, total_bilhetes, receita]
          );
        } else {
          await conexao.query(
            `INSERT INTO historico_exibicoes
              (id_historico, id_filme, data_inicio_exibicao, total_sessoes, total_bilhetes_vendidos, receita_total)
             VALUES ($1, $2, CURRENT_DATE, 1, $3, $4)`,
            [gerarId(), result.rows[0].id_filme, total_bilhetes, receita]
          );
        }
      } catch (histError) {
        console.error("Aviso: falha ao atualizar histórico de exibição:", histError.message);
      }
    }

    registrarLog({
      id_funcionario: req.usuario?.id_funcionario,
      accao: `SESSAO_${estadoNormalizado.toUpperCase()}`,
      tabela_afectada: 'sessoes',
      registo_id: id,
      detalhes: { estado_anterior: estadoAtual, estado_novo: estadoNormalizado },
      ip_origem: req.ip,
    });

    res.status(200).json({
      sucesso: true,
      mensagem: `Estado da sessão atualizado para "${estadoNormalizado}"`,
      sessao: result.rows[0],
      estado_anterior: estadoAtual,
      estado_novo: estadoNormalizado,
    });
  } catch (error) {
    console.error("Erro ao atualizar estado da sessão:", error);
    res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao atualizar estado da sessão",
      erro: error.message,
    });
  }
});

/**
 * @swagger
 * /bilhetes/{id}/validar:
 *   patch:
 *     summary: Valida/usa um bilhete na entrada do cinema
 *     description: Marca um bilhete individual como utilizado (check-in na entrada). Apenas funcionário/administrador.
 *     tags: [Bilhetes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do bilhete (ou número da factura da compra)
 *     responses:
 *       200:
 *         description: Bilhete validado com sucesso
 *       400:
 *         description: Bilhete já utilizado ou cancelado
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Bilhete não encontrado
 *       500:
 *         description: Erro interno do servidor
 */
router.patch(
  "/bilhetes/:id/validar",
  verificarToken,
  autorizar("funcionario", "administrador"),
  async (req, res) => {
    const { id } = req.params;

    try {
      // Aceita tanto o id_bilhete como o número da factura da compra a que pertence
      const buscarQuery = `
        SELECT b.id_bilhete, b.estado_uso, b.id_sessao, s.data_hora_inicio
        FROM bilhetes b
        JOIN compras c ON c.id_compra = b.id_compra
        JOIN sessoes s ON s.id_sessao = b.id_sessao
        WHERE b.id_bilhete = $1 OR c.numero_factura = $1
      `;
      const bilheteResult = await conexao.query(buscarQuery, [id]);

      if (bilheteResult.rows.length === 0) {
        return res.status(404).json({
          sucesso: false,
          mensagem: "Bilhete não encontrado",
        });
      }

      const bilhete = bilheteResult.rows[0];

      if (bilhete.estado_uso === "usado") {
        return res.status(409).json({
          sucesso: false,
          mensagem: "Este bilhete já foi utilizado",
        });
      }

      if (bilhete.estado_uso === "cancelado") {
        return res.status(409).json({
          sucesso: false,
          mensagem: "Este bilhete foi cancelado e não pode ser utilizado",
        });
      }

      const updateResult = await conexao.query(
        `UPDATE bilhetes
         SET estado_uso = 'usado', data_uso = CURRENT_TIMESTAMP
         WHERE id_bilhete = $1
         RETURNING *`,
        [bilhete.id_bilhete]
      );

      res.status(200).json({
        sucesso: true,
        mensagem: "Bilhete validado com sucesso",
        bilhete: updateResult.rows[0],
      });
    } catch (error) {
      console.error("Erro ao validar bilhete:", error);
      res.status(500).json({
        sucesso: false,
        mensagem: "Erro ao validar bilhete",
        erro: error.message,
      });
    }
  }
);

module.exports = router;
