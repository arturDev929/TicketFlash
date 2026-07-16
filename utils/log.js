const { v4: uuidv4 } = require("uuid");
const conexao = require("../infra/conexao");

/**
 * Regista uma ação de um funcionário/administrador na tabela logs_funcionarios.
 * Nunca deve derrubar o pedido principal: falhas de log são apenas registadas na consola.
 *
 * @param {object} params
 * @param {string} params.id_funcionario
 * @param {string} params.accao         ex: "CRIAR_FILME", "CANCELAR_SESSAO"
 * @param {string} [params.tabela_afectada]
 * @param {string} [params.registo_id]
 * @param {object} [params.detalhes]
 * @param {string} [params.ip_origem]
 */
async function registrarLog({
  id_funcionario,
  accao,
  tabela_afectada = null,
  registo_id = null,
  detalhes = null,
  ip_origem = null,
}) {
  if (!id_funcionario || !accao) return;

  try {
    await conexao.query(
      `INSERT INTO logs_funcionarios
        (id_log, id_funcionario, accao, tabela_afectada, registo_id, detalhes, ip_origem)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        uuidv4(),
        id_funcionario,
        accao,
        tabela_afectada,
        registo_id,
        detalhes ? JSON.stringify(detalhes) : null,
        ip_origem,
      ]
    );
  } catch (error) {
    console.error("Aviso: falha ao registar log de funcionário:", error.message);
  }
}

module.exports = { registrarLog };
