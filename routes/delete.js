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

// delete.js - Atualizar a rota /sessoes/:id

router.delete("/sessoes/:id", verificarToken, autorizar("funcionario", "administrador"), async (req, res) => {
  const { id } = req.params;

  try {
    // --- VERIFICAR SE SESSÃO EXISTE ---
    const checkQuery = `
      SELECT id_sessao, estado_sessao, data_hora_inicio
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

    // Verificar se a sessão já foi concluída
    if (sessao.estado_sessao === "concluida") {
      return res.status(409).json({
        sucesso: false,
        mensagem: "Não é possível cancelar uma sessão que já foi concluída",
      });
    }

    // Verificar se já está cancelada
    if (sessao.estado_sessao === "cancelada") {
      return res.status(409).json({
        sucesso: false,
        mensagem: "Esta sessão já foi cancelada",
      });
    }

    // Verificar se a sessão já começou
    const agora = new Date();
    const inicioSessao = new Date(sessao.data_hora_inicio);
    if (agora >= inicioSessao) {
      return res.status(409).json({
        sucesso: false,
        mensagem:
          "Não é possível cancelar uma sessão que já começou ou está em andamento",
      });
    }

    // --- CANCELAR SESSÃO ---
    const updateQuery = `
      UPDATE sessoes 
      SET estado_sessao = 'cancelada',
          data_atualizacao = CURRENT_TIMESTAMP,
          data_cancelamento = CURRENT_TIMESTAMP
      WHERE id_sessao = $1
      RETURNING *
    `;

    const result = await conexao.query(updateQuery, [id]);

    // --- CANCELAR COMPRAS ASSOCIADAS ---
    const liberarLugares = `
      UPDATE lugares_ocupados 
      SET status = 'cancelado'
      WHERE id_sessao = $1
      AND status IN ('ocupado', 'pendente', 'reservado')
    `;
    await conexao.query(liberarLugares, [id]);

    const atualizarCompras = `
      UPDATE compras 
      SET estado_pagamento = 'cancelado',
          data_cancelamento = CURRENT_TIMESTAMP,
          valor_reembolsado = valor_total
      WHERE id_sessao = $1
      AND estado_pagamento != 'cancelado'
    `;
    await conexao.query(atualizarCompras, [id]);

    // --- CANCELAR BILHETES DAS COMPRAS DESTA SESSÃO ---
    const cancelarBilhetes = `
      UPDATE bilhetes
      SET estado_uso = 'cancelado'
      WHERE id_sessao = $1
      AND estado_uso != 'usado'
    `;
    await conexao.query(cancelarBilhetes, [id]);

    registrarLog({
      id_funcionario: req.usuario?.id_funcionario,
      accao: 'CANCELAR_SESSAO',
      tabela_afectada: 'sessoes',
      registo_id: id,
      ip_origem: req.ip,
    });

    res.status(200).json({
      sucesso: true,
      mensagem: "Sessão cancelada com sucesso",
      sessao: result.rows[0],
    });
  } catch (error) {
    console.error("Erro ao cancelar sessão:", error);
    res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao cancelar sessão",
      erro: error.message,
    });
  }
});

// delete.js

/**
 * @swagger
 * /salas/{id}:
 *   delete:
 *     summary: Remove uma sala
 *     description: Remove permanentemente uma sala do sistema. Verifica se não há sessões ativas associadas.
 *     tags: [Salas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID da sala
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       200:
 *         description: Sala removida com sucesso
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
 *                   example: "Sala removida com sucesso"
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
 *       409:
 *         description: Sala possui sessões ativas
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
 *                   example: "Não é possível remover a sala pois possui sessões ativas"
 *                 sessoes_ativas:
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
 *                   example: "Erro ao remover sala"
 *                 erro:
 *                   type: string
 *                   example: "Database error"
 */

router.delete("/salas/:id", verificarToken, autorizar("funcionario", "administrador"), async (req, res) => {
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

    // --- VERIFICAR SE SALA EXISTE ---
    const checkQuery = `
            SELECT id_sala, nome_sala 
            FROM salas 
            WHERE id_sala = $1
        `;
    const checkResult = await conexao.query(checkQuery, [id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        sucesso: false,
        mensagem: "Sala não encontrada",
      });
    }

    // --- VERIFICAR SE HÁ SESSÕES ATIVAS NA SALA ---
    const sessoesQuery = `
            SELECT COUNT(*) as total
            FROM sessoes 
            WHERE id_sala = $1 
            AND estado_sessao NOT IN ('cancelada', 'concluida')
        `;
    const sessoesResult = await conexao.query(sessoesQuery, [id]);

    if (parseInt(sessoesResult.rows[0].total) > 0) {
      return res.status(409).json({
        sucesso: false,
        mensagem: "Não é possível remover a sala pois possui sessões ativas",
        sessoes_ativas: parseInt(sessoesResult.rows[0].total),
      });
    }

    // --- REMOVER SALA (CASCADE REMOVE OS LUGARES) ---
    const deleteQuery = `
            DELETE FROM salas 
            WHERE id_sala = $1
            RETURNING id_sala, nome_sala
        `;
    const result = await conexao.query(deleteQuery, [id]);

    registrarLog({
      id_funcionario: req.usuario?.id_funcionario,
      accao: 'REMOVER_SALA',
      tabela_afectada: 'salas',
      registo_id: id,
      ip_origem: req.ip,
    });

    res.status(200).json({
      sucesso: true,
      mensagem: "Sala removida com sucesso",
      sala: result.rows[0],
    });
  } catch (error) {
    console.error("Erro ao remover sala:", error);
    res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao remover sala",
      erro: error.message,
    });
  }
});

// delete.js

/**
 * @swagger
 * /filme/{id}:
 *   delete:
 *     summary: Remove um filme
 *     description: Remove permanentemente um filme do sistema. Verifica se não há sessões ativas associadas.
 *     tags: [Filmes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do filme
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       200:
 *         description: Filme removido com sucesso
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
 *                   example: "Filme removido com sucesso"
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
 *         description: Filme possui sessões ativas
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
 *                   example: "Não é possível remover o filme pois possui sessões ativas"
 *                 sessoes_ativas:
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
 *                   example: "Erro ao remover filme"
 *                 erro:
 *                   type: string
 *                   example: "Database error"
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
