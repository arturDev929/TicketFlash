const express = require("express");
const router = express.Router();
const conexao = require("../infra/conexao");

const { verificarToken, autorizar } = require("../middleware/authMiddleware");
const { registrarLog } = require("../utils/log");

router.get('/users', verificarToken, autorizar('funcionario', 'administrador'), async (req, res) => {
    // ✅ LEFT JOIN para incluir também clientes (que não têm registo em funcionarios)
    // ✅ Colunas explícitas para NUNCA devolver senha_hash
    const query = `
        SELECT
            u.id_utilizador, u.nome_completo, u.email, u.telefone,
            u.tipo_utilizador, u.data_cadastro, u.ultimo_acesso,
            u.estado_conta, u.foto_url,
            f.id_funcionario, f.cargo, f.numero_funcionario
        FROM utilizadores u
        LEFT JOIN funcionarios f ON u.id_utilizador = f.id_utilizador
        ORDER BY u.data_cadastro DESC
    `;

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
 * /users/{id_utilizador}:
 *   get:
 *     summary: Obtém um utilizador específico com seus dados de funcionário
 *     description: Retorna os dados de um utilizador e seu respectivo funcionário através de um INNER JOIN entre as tabelas utilizadores e funcionarios, filtrado pelo ID do utilizador
 *     tags: [Utilizadores]
 *     parameters:
 *       - in: path
 *         name: id_utilizador
 *         required: true
 *         description: ID do utilizador
 *         schema:
 *           type: string
 *           example: "550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       200:
 *         description: Utilizador encontrado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id_utilizador:
 *                   type: string
 *                   description: ID do utilizador
 *                   example: "550e8400-e29b-41d4-a716-446655440000"
 *                 nome:
 *                   type: string
 *                   description: Nome do utilizador
 *                   example: "João Silva"
 *                 email:
 *                   type: string
 *                   format: email
 *                   description: Email do utilizador
 *                   example: "joao.silva@empresa.com"
 *                 telefone:
 *                   type: string
 *                   description: Número de telefone
 *                   example: "+351 912345678"
 *                 data_registo:
 *                   type: string
 *                   format: date-time
 *                   description: Data de registo do utilizador
 *                   example: "2024-01-15T10:30:00Z"
 *                 id_funcionario:
 *                   type: string
 *                   description: ID do funcionário
 *                   example: "660e8400-e29b-41d4-a716-446655440001"
 *                 cargo:
 *                   type: string
 *                   description: Cargo do funcionário
 *                   example: "Desenvolvedor"
 *                 departamento:
 *                   type: string
 *                   description: Departamento do funcionário
 *                   example: "TI"
 *                 data_contratacao:
 *                   type: string
 *                   format: date
 *                   description: Data de contratação do funcionário
 *                   example: "2023-01-01"
 *                 salario:
 *                   type: number
 *                   format: float
 *                   description: Salário do funcionário
 *                   example: 3500.00
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
 *                   description: Mensagem do erro
 *                   example: "Erro na consulta à base de dados"
 */

router.get('/users/:id_utilizador', verificarToken, async (req, res) => {
    const id_utilizador = req.params.id_utilizador;

    // ✅ Um utilizador só pode ver o seu próprio perfil, a menos que seja funcionário/administrador
    const solicitante = req.usuario;
    const podeVerQualquerPerfil = solicitante && (solicitante.tipo === 'funcionario' || solicitante.tipo === 'administrador');
    if (!podeVerQualquerPerfil && solicitante?.id !== id_utilizador) {
        return res.status(403).json({
            sucesso: false,
            mensagem: 'Acesso negado'
        });
    }

    const query = `
        SELECT
            u.id_utilizador, u.nome_completo, u.email, u.telefone,
            u.tipo_utilizador, u.data_cadastro, u.ultimo_acesso,
            u.estado_conta, u.foto_url,
            f.id_funcionario, f.cargo, f.numero_funcionario
        FROM utilizadores u
        LEFT JOIN funcionarios f ON u.id_utilizador = f.id_utilizador
        WHERE u.id_utilizador = $1
    `;

    conexao.query(query, [id_utilizador], (err, results) => {
        if (err) {
            return res.status(500).json({
                erro: err.message
            });
        }
        
        if (results.rows.length === 0) {
            return res.status(404).json({
                mensagem: "Utilizador não encontrado"
            });
        }
        
        res.json(results.rows[0]);
    });
});

/**
 * @swagger
 * /sala/{id}/assentos:
 *   get:
 *     summary: Busca todos os assentos de uma sala
 *     description: Retorna todos os assentos de uma sala específica organizados por filas
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
 *     responses:
 *       200:
 *         description: Assentos encontrados com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sucesso:
 *                   type: boolean
 *                   example: true
 *                 sala:
 *                   type: object
 *                   properties:
 *                     id_sala:
 *                       type: string
 *                       format: uuid
 *                       example: "550e8400-e29b-41d4-a716-446655440000"
 *                     nome_sala:
 *                       type: string
 *                       example: "Sala Pequena"
 *                     capacidade_total:
 *                       type: integer
 *                       example: 11
 *                     tipo_sala:
 *                       type: string
 *                       example: "NORMAL"
 *                     estado_sala:
 *                       type: string
 *                       example: "ativa"
 *                     coluna:
 *                       type: integer
 *                       example: 4
 *                     fila:
 *                       type: integer
 *                       example: 3
 *                 total_assentos:
 *                   type: integer
 *                   example: 11
 *                 configuracao:
 *                   type: object
 *                   properties:
 *                     filas:
 *                       type: integer
 *                       example: 3
 *                     colunas:
 *                       type: integer
 *                       example: 4
 *                     total_posicoes:
 *                       type: integer
 *                       example: 12
 *                     assentos_ocupados:
 *                       type: integer
 *                       example: 11
 *                     assentos_vazios:
 *                       type: integer
 *                       example: 1
 *                 assentos:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       fila:
 *                         type: string
 *                         example: "A"
 *                       assentos:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             id_lugar:
 *                               type: string
 *                               format: uuid
 *                               example: "660e8400-e29b-41d4-a716-446655440001"
 *                             codigo_lugar:
 *                               type: string
 *                               example: "A1"
 *                             fileira:
 *                               type: string
 *                               example: "A"
 *                             numero:
 *                               type: integer
 *                               example: 1
 *                             estado_permanente:
 *                               type: string
 *                               enum: [activo, inactivo, manutencao]
 *                               example: "ativo"
 *                             codigo:
 *                               type: string
 *                               example: "ABC123"
 *                             ativo:
 *                               type: boolean
 *                               example: true
 *                       total_ativos:
 *                         type: integer
 *                         example: 4
 *                       total_inativos:
 *                         type: integer
 *                         example: 0
 *                 mapa_visual:
 *                   type: string
 *                   example: "+---+---+---+---+\n| A | A1 | A2 | A3 | A4 |\n+---+---+---+---+\n| B | B1 | B2 | B3 | B4 |\n+---+---+---+---+\n| C | C1 | C2 | C3 | ·· |\n+---+---+---+---+"
 *       404:
 *         description: Sala não encontrada
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
 *                   example: "Sala não encontrada"
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
 *                   example: "Erro ao buscar assentos"
 *                 erro:
 *                   type: string
 *                   example: "Database error"
 */

router.get('/client/:id', verificarToken, async (req, res) => {
    const id = req.params.id;

    // --- VALIDAR SE O ID É UM UUID VÁLIDO ---
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!uuidRegex.test(id)) {
        return res.status(400).json({
            sucesso: false,
            mensagem: "ID inválido. Deve ser um UUID válido."
        });
    }

    const solicitante = req.usuario;
    const podeVerQualquerPerfil = solicitante && (solicitante.tipo === 'funcionario' || solicitante.tipo === 'administrador');
    if (!podeVerQualquerPerfil && solicitante?.id !== id) {
        return res.status(403).json({
            sucesso: false,
            mensagem: 'Acesso negado'
        });
    }

    try {
        const sql = `
            SELECT 
                id_utilizador, 
                nome_completo, 
                email, 
                telefone, 
                tipo_utilizador, 
                estado_conta, 
                data_cadastro
            FROM utilizadores 
            WHERE id_utilizador = $1
        `;
        
        const result = await conexao.query(sql, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                sucesso: false,
                mensagem: "Cliente não encontrado"
            });
        }

        res.status(200).json({
            sucesso: true,
            cliente: result.rows[0]
        });

    } catch (error) {
        console.error('Erro ao buscar cliente:', error);
        res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao buscar cliente",
            erro: error.message
        });
    }
});

// get.js

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

router.delete("/users/:id", verificarToken, autorizar("administrador"), async (req, res) => {
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

    // --- VERIFICAR SE USUÁRIO EXISTE ---
    const checkQuery = `
            SELECT id_utilizador, nome_completo, tipo_utilizador
            FROM utilizadores 
            WHERE id_utilizador = $1
        `;
    const checkResult = await conexao.query(checkQuery, [id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        sucesso: false,
        mensagem: "Usuário não encontrado",
      });
    }

    const usuario = checkResult.rows[0];

    // --- VERIFICAR SE HÁ COMPRAS ASSOCIADAS ---
    const comprasQuery = `
            SELECT COUNT(*) as total
            FROM compras 
            WHERE id_cliente = $1
        `;
    const comprasResult = await conexao.query(comprasQuery, [id]);

    if (parseInt(comprasResult.rows[0].total) > 0) {
      return res.status(409).json({
        sucesso: false,
        mensagem:
          "Não é possível remover o usuário pois possui compras associadas",
        total_compras: parseInt(comprasResult.rows[0].total),
      });
    }

    // --- REMOVER FUNCIONÁRIO (SE FOR) ---
    if (usuario.tipo_utilizador !== "cliente") {
      await conexao.query("DELETE FROM funcionarios WHERE id_utilizador = $1", [
        id,
      ]);
    }

    // --- REMOVER USUÁRIO ---
    const deleteQuery = `
            DELETE FROM utilizadores 
            WHERE id_utilizador = $1
            RETURNING id_utilizador, nome_completo
        `;
    const result = await conexao.query(deleteQuery, [id]);

    registrarLog({
      id_funcionario: req.usuario?.id_funcionario,
      accao: 'REMOVER_UTILIZADOR',
      tabela_afectada: 'utilizadores',
      registo_id: id,
      ip_origem: req.ip,
    });

    res.status(200).json({
      sucesso: true,
      mensagem: "Usuário removido com sucesso",
      utilizador: result.rows[0],
    });
  } catch (error) {
    console.error("Erro ao remover usuário:", error);
    res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao remover usuário",
      erro: error.message,
    });
  }
});

// delete.js

/**
 * @swagger
 * /genero/{id}:
 *   delete:
 *     summary: Remove um gênero
 *     description: Remove permanentemente um gênero do sistema. Verifica se não há filmes associados.
 *     tags: [Gêneros]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do gênero
 *         example: "550e8400-e29b-41d4-a716-446655440001"
 *     responses:
 *       200:
 *         description: Gênero removido com sucesso
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
 *                   example: "Gênero removido com sucesso"
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
 *         description: Gênero possui filmes associados
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
 *                   example: "Não é possível remover o gênero pois possui filmes associados"
 *                 filmes_associados:
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
 *                   example: "Erro ao remover gênero"
 *                 erro:
 *                   type: string
 *                   example: "Database error"
 */

module.exports = router;
