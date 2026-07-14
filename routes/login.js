const express = require("express");
const router = express.Router();
const conexao = require("../infra/conexao");
const { compararSenhas } = require("../utils/senha");
const { gerarToken } = require("../utils/token");

router.post("/", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      sucesso: false,
      mensagem: "Preencha todos os campos",
    });
  }

  const sqlUtilizador = `
        SELECT u.id_utilizador as id, u.nome_completo as nome, u.email, u.senha_hash as senha, u.tipo_utilizador as tipo, u.telefone as contacto,u.estado_conta, f.id_funcionario, f.cargo, f.numero_funcionario FROM utilizadores u LEFT JOIN funcionarios f ON u.id_utilizador = f.id_utilizador WHERE u.email = $1`;

  conexao.query(sqlUtilizador, [email], async (err, result) => {
    if (err) {
      return res.status(500).json({
        sucesso: false,
        mensagem: "Erro ao buscar usuário",
      });
    }

    const usuarios = result.rows;

    if (usuarios.length === 0) {
      return res.status(401).json({
        sucesso: false,
        mensagem: "Email não cadastrado",
      });
    }

    const usuario = usuarios[0];

    if (usuario.estado_conta !== "ativo") {
      let mensagem = "Conta ";
      if (usuario.estado_conta === "inativo") {
        mensagem += "inativa";
      } else if (usuario.estado_conta === "bloqueado") {
        mensagem += "bloqueada";
      }
      mensagem += ". Contacte o administrador.";

      return res.status(403).json({
        sucesso: false,
        mensagem: mensagem,
      });
    }

    try {
      const senhaCorreta = await compararSenhas(password, usuario.senha);

      if (!senhaCorreta) {
        return res.status(401).json({
          sucesso: false,
          mensagem: "Senha inválida",
        });
      }

      // ✅ CORRETO - Gerando token com todos os dados
      const token = gerarToken({
        id: usuario.id,
        nome: usuario.nome,
        tipo: usuario.tipo,
        id_funcionario: usuario.id_funcionario,
      });

      const sqlUpdate = `
                UPDATE utilizadores 
                SET ultimo_acesso = CURRENT_TIMESTAMP 
                WHERE id_utilizador = $1
            `;

      conexao.query(sqlUpdate, [usuario.id], (updateErr) => {
        if (updateErr) {
          console.error("ERRO ao atualizar ultimo_acesso:", updateErr.message);
        }
      });

      const resposta = {
        sucesso: true,
        tipoUsuario: usuario.tipo,
        token: token,
        dados: {
          id: usuario.id,
          nome: usuario.nome,
          email: usuario.email,
          tipo: usuario.tipo,
        },
      };

      if (usuario.contacto) {
        resposta.dados.contacto = usuario.contacto;
      }

      if (usuario.tipo === "funcionario" || usuario.tipo === "administrador") {
        resposta.dados.cargo = usuario.cargo;
        resposta.dados.id_funcionario = usuario.id_funcionario;
        resposta.dados.numero_funcionario = usuario.numero_funcionario;
      }

      return res.status(200).json(resposta);
    } catch (error) {
      return res.status(500).json({
        sucesso: false,
        mensagem: "Erro interno no servidor",
      });
    }
  });
});

module.exports = router;
