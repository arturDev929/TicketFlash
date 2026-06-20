const express = require("express");
const router = express.Router();
const conexao = require("../infra/conexao");
const { verificarToken } = require("../middleware/authMiddleware");

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
 *                 example: "activo"
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

router.put('/lugares/:id_lugar', async (req, res) => {
    const { id_lugar } = req.params;
    const { estado_permanente } = req.body;

    const estadosValidos = ['activo', 'inactivo', 'manutencao'];
    if (!estado_permanente) {
        return res.status(400).json({
            sucesso: false,
            mensagem: "O campo estado_permanente é obrigatório"
        });
    }

    if (!estadosValidos.includes(estado_permanente)) {
        return res.status(400).json({
            sucesso: false,
            mensagem: `Estado inválido. Use: ${estadosValidos.join(', ')}`
        });
    }

    if (!id_lugar) {
        return res.status(400).json({
            sucesso: false,
            mensagem: "ID do lugar é obrigatório"
        });
    }

    try {

        const checkQuery = "SELECT id_lugar, codigo_lugar, estado_permanente FROM lugares WHERE id_lugar = $1";
        const checkResult = await conexao.query(checkQuery, [id_lugar]);

        if (checkResult.rows.length === 0) {
            return res.status(404).json({
                sucesso: false,
                mensagem: `Lugar com ID ${id_lugar} não encontrado`
            });
        }

        const updateQuery = `
            UPDATE lugares 
            SET estado_permanente = $1 
            WHERE id_lugar = $2 
            RETURNING *
        `;

        const updateResult = await conexao.query(updateQuery, [estado_permanente, id_lugar]);

        if (updateResult.rows.length === 0) {
            return res.status(404).json({
                sucesso: false,
                mensagem: "Lugar não encontrado ou não foi possível atualizar"
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
                estado_compra: lugarAtualizado.estado_compra,
                fileira: lugarAtualizado.fileira,
                numero: lugarAtualizado.numero
            }
        });

    } catch (err) {
        console.error("Erro detalhado ao atualizar lugar:", err);
        
        if (err.code === 'ECONNREFUSED') {
            return res.status(500).json({
                sucesso: false,
                mensagem: "Erro de conexão com o banco de dados"
            });
        }

        return res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao atualizar lugar",
            erro: err.message
        });
    }
});

/**
 * @swagger
 * /estadoFilme/{id_filme}:
 *   put:
 *     summary: Atualiza o estado de exibição de um filme
 *     description: Permite alterar o status de exibição de um filme específico para disponível, indisponível ou em breve
 *     tags: [Filmes]
 *     parameters:
 *       - in: path
 *         name: id_filme
 *         required: true
 *         description: UUID do filme a ser atualizado
 *         schema:
 *           type: string
 *           format: uuid
 *           example: "123e4567-e89b-12d3-a456-426614174000"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - estado_exibicao
 *             properties:
 *               estado_exibicao:
 *                 type: string
 *                 enum: [disponivel, indisponivel, brevemente]
 *                 description: Novo estado de exibição do filme
 *                 example: "disponivel"
 *           examples:
 *             disponivel:
 *               summary: Marcar como disponível
 *               value:
 *                 estado_exibicao: "disponivel"
 *             indisponivel:
 *               summary: Marcar como indisponível
 *               value:
 *                 estado_exibicao: "indisponivel"
 *             brevemente:
 *               summary: Marcar como em breve
 *               value:
 *                 estado_exibicao: "brevemente"
 *     responses:
 *       200:
 *         description: Estado do filme atualizado com sucesso
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
 *                   example: "Estado do filme atualizado com sucesso"
 *                 filme:
 *                   type: object
 *                   properties:
 *                     id_filme:
 *                       type: string
 *                       format: uuid
 *                       example: "123e4567-e89b-12d3-a456-426614174000"
 *                     titulo:
 *                       type: string
 *                       example: "O Poderoso Chefão"
 *                     estado_exibicao:
 *                       type: string
 *                       enum: [disponivel, indisponivel, brevemente]
 *                       example: "disponivel"
 *                     destaque:
 *                       type: boolean
 *                       example: false
 *       400:
 *         description: Requisição inválida - campo obrigatório faltando, valor inválido ou UUID inválido
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
 *                   example: "O campo estado_exibicao é obrigatório"
 *             examples:
 *               campoFaltando:
 *                 summary: Campo obrigatório não informado
 *                 value:
 *                   sucesso: false
 *                   mensagem: "O campo estado_exibicao é obrigatório"
 *               valorInvalido:
 *                 summary: Valor inválido para estado_exibicao
 *                 value:
 *                   sucesso: false
 *                   mensagem: "Estado inválido. Use: disponivel, indisponivel, brevemente"
 *               uuidInvalido:
 *                 summary: UUID inválido
 *                 value:
 *                   sucesso: false
 *                   mensagem: "ID do filme inválido. Deve ser um UUID válido"
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
 *                   example: "Filme com ID 123e4567-e89b-12d3-a456-426614174000 não encontrado"
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
 *                   example: "Erro ao atualizar estado do filme"
 *                 erro:
 *                   type: string
 *                   example: "Database connection error"
 */

router.put('/estadoFilme/:id_filme', async (req, res) => {
    const { id_filme } = req.params;
    const { estado_exibicao } = req.body;

    const estadosValidos = ['disponivel', 'indisponivel', 'brevemente'];

    if (!estado_exibicao) {
        return res.status(400).json({
            sucesso: false,
            mensagem: "O campo estado_exibicao é obrigatório"
        });
    }

    if (!estadosValidos.includes(estado_exibicao)) {
        return res.status(400).json({
            sucesso: false,
            mensagem: `Estado inválido. Use: ${estadosValidos.join(', ')}`
        });
    }

    const sql = `UPDATE filmes SET estado_exibicao = $1 WHERE id_filme = $2 RETURNING *`;

    conexao.query(sql, [estado_exibicao, id_filme], (err, result) => {
        if (err) {
            console.error("Erro detalhado ao atualizar estado do filme:", err);
            return res.status(500).json({
                sucesso: false,
                mensagem: "Erro ao atualizar estado do filme",
                erro: err.message
            });
        }

        if (result.rows.length === 0) {
            return res.status(404).json({
                sucesso: false,
                mensagem: `Filme com ID ${id_filme} não encontrado`
            });
        }

        return res.status(200).json({
            sucesso: true,
            mensagem: "Estado do filme atualizado com sucesso",
            filme: result.rows[0]
        });
    });
});

/**
 * @swagger
 * /destaque/{id_filme}:
 *   put:
 *     summary: Atualiza o status de destaque de um filme
 *     description: Permite definir se um filme específico aparecerá em destaque ou não
 *     tags: [Filmes]
 *     parameters:
 *       - in: path
 *         name: id_filme
 *         required: true
 *         description: UUID do filme a ser atualizado
 *         schema:
 *           type: string
 *           format: uuid
 *           example: "123e4567-e89b-12d3-a456-426614174000"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - destaque
 *             properties:
 *               destaque:
 *                 type: boolean
 *                 description: Status de destaque do filme (true/false)
 *                 example: true
 *           examples:
 *             ativarDestaque:
 *               summary: Ativar destaque para o filme
 *               value:
 *                 destaque: true
 *             desativarDestaque:
 *               summary: Desativar destaque do filme
 *               value:
 *                 destaque: false
 *     responses:
 *       200:
 *         description: Status de destaque do filme atualizado com sucesso
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
 *                   example: "Destaque do filme atualizado com sucesso"
 *                 filme:
 *                   type: object
 *                   properties:
 *                     id_filme:
 *                       type: string
 *                       format: uuid
 *                       example: "123e4567-e89b-12d3-a456-426614174000"
 *                     titulo:
 *                       type: string
 *                       example: "O Poderoso Chefão"
 *                     estado_exibicao:
 *                       type: string
 *                       enum: [disponivel, indisponivel, brevemente]
 *                       example: "disponivel"
 *                     destaque:
 *                       type: boolean
 *                       example: true
 *       400:
 *         description: Requisição inválida - campo obrigatório faltando, valor inválido ou UUID inválido
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
 *                   example: "O campo destaque é obrigatório"
 *             examples:
 *               campoFaltando:
 *                 summary: Campo obrigatório não informado
 *                 value:
 *                   sucesso: false
 *                   mensagem: "O campo destaque é obrigatório"
 *               valorInvalido:
 *                 summary: Valor inválido para destaque
 *                 value:
 *                   sucesso: false
 *                   mensagem: "Destaque inválido. Use: true ou false (boolean)"
 *               uuidInvalido:
 *                 summary: UUID inválido
 *                 value:
 *                   sucesso: false
 *                   mensagem: "ID do filme inválido. Deve ser um UUID válido"
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
 *                   example: "Filme com ID 123e4567-e89b-12d3-a456-426614174000 não encontrado"
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
 *                   example: "Erro ao atualizar destaque do filme"
 *                 erro:
 *                   type: string
 *                   example: "Database update error"
 */

router.put('/destaque/:id_filme', async (req, res) => {
    const { id_filme } = req.params;
    const { destaque } = req.body;

    // Validação do campo destaque
    if (destaque === undefined || destaque === null) {
        return res.status(400).json({
            sucesso: false,
            mensagem: "O campo destaque é obrigatório"
        });
    }

    if (typeof destaque !== 'boolean') {
        return res.status(400).json({
            sucesso: false,
            mensagem: "Destaque inválido. Use: true ou false (boolean)"
        });
    }

    // Primeiro, verificar se o filme existe e qual é o seu estado atual
    const checkSql = `SELECT estado_exibicao FROM filmes WHERE id_filme = $1`;
    
    conexao.query(checkSql, [id_filme], (checkErr, checkResult) => {
        if (checkErr) {
            console.error("Erro ao verificar estado do filme:", checkErr);
            return res.status(500).json({
                sucesso: false,
                mensagem: "Erro ao verificar estado do filme",
                erro: checkErr.message
            });
        }

        // Verificar se o filme existe
        if (checkResult.rows.length === 0) {
            return res.status(404).json({
                sucesso: false,
                mensagem: `Filme com ID ${id_filme} não encontrado`
            });
        }

        const estadoAtual = checkResult.rows[0].estado_exibicao;

        // REGRA DE NEGÓCIO: Filme indisponível NÃO pode ser destaque
        if (estadoAtual === 'indisponivel' && destaque === true) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Não é possível marcar um filme indisponível como destaque",
                estado_atual: estadoAtual,
                destaque_solicitado: destaque
            });
        }

        // Se estiver tudo ok, prosseguir com a atualização
        const sql = `UPDATE filmes SET destaque = $1 WHERE id_filme = $2 RETURNING *`;

        conexao.query(sql, [destaque, id_filme], (err, result) => {
            if (err) {
                console.error("Erro detalhado ao atualizar destaque do filme:", err);
                return res.status(500).json({
                    sucesso: false,
                    mensagem: "Erro ao atualizar destaque do filme",
                    erro: err.message
                });
            }

            return res.status(200).json({
                sucesso: true,
                mensagem: destaque ? "Filme marcado como destaque com sucesso" : "Destaque do filme removido com sucesso",
                filme: result.rows[0]
            });
        });
    });
});

module.exports = router;