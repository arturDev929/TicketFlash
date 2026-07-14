const express = require("express");
const router = express.Router();
const conexao = require("../infra/conexao");

const { verificarToken, autorizar } = require("../middleware/authMiddleware");

router.get('/logs', verificarToken, autorizar('funcionario', 'administrador'), async (req, res) => {
    try {
        let limite = parseInt(req.query.limite, 10);
        if (!Number.isFinite(limite) || limite <= 0) limite = 100;
        if (limite > 500) limite = 500;

        const query = `
            SELECT
                lf.id_log,
                lf.id_funcionario,
                lf.accao,
                lf.tabela_afectada,
                lf.registo_id,
                lf.data_accao,
                lf.detalhes,
                lf.ip_origem,
                u.nome_completo AS funcionario_nome,
                u.email AS funcionario_email,
                f.cargo AS funcionario_cargo
            FROM logs_funcionarios lf
            JOIN funcionarios f ON f.id_funcionario = lf.id_funcionario
            JOIN utilizadores u ON u.id_utilizador = f.id_utilizador
            ORDER BY lf.data_accao DESC
            LIMIT $1
        `;
        const result = await conexao.query(query, [limite]);

        res.status(200).json({
            sucesso: true,
            total: result.rows.length,
            logs: result.rows
        });
    } catch (error) {
        console.error('Erro ao buscar logs:', error);
        res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao buscar logs",
            erro: error.message
        });
    }
});

module.exports = router;
