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

    // Validação do estado_permanente
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

    // Validação do ID
    if (!id_lugar) {
        return res.status(400).json({
            sucesso: false,
            mensagem: "ID do lugar é obrigatório"
        });
    }

    try {
        // Verificar se o lugar existe primeiro
        const checkQuery = "SELECT id_lugar, codigo_lugar, estado_permanente FROM lugares WHERE id_lugar = $1";
        const checkResult = await conexao.query(checkQuery, [id_lugar]);

        if (checkResult.rows.length === 0) {
            return res.status(404).json({
                sucesso: false,
                mensagem: `Lugar com ID ${id_lugar} não encontrado`
            });
        }

        // Atualizar o lugar
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
        
        // Verificar se é erro de conexão
        if (err.code === 'ECONNREFUSED') {
            return res.status(500).json({
                sucesso: false,
                mensagem: "Erro de conexão com o banco de dados"
            });
        }

        // Outros erros
        return res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao atualizar lugar",
            erro: err.message
        });
    }
});

router.put('estadoFilme/:id_filme', async (req, res) => {
    const { id_filme } = req.params;
});

module.exports = router;