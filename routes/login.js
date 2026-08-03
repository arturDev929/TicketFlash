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
            mensagem: "Preencha todos os campos"
        });
    }

    const sqlUtilizador = `
        SELECT u.id_utilizador as id, u.nome_completo as nome, u.email, u.senha_hash as senha, u.tipo_utilizador as tipo, u.telefone as contacto,u.estado_conta, f.id_funcionario, f.cargo, f.numero_funcionario FROM utilizadores u LEFT JOIN funcionarios f ON u.id_utilizador = f.id_utilizador WHERE u.email = $1`;

    conexao.query(sqlUtilizador, [email], async (err, result) => {
        if (err) {
            return res.status(500).json({ 
                sucesso: false, 
                mensagem: "Erro ao buscar usuário" 
            });
        }

        const usuarios = result.rows;

        if (usuarios.length === 0) {
            return res.status(401).json({ 
                sucesso: false, 
                mensagem: "Email não cadastrado" 
            });
        }

        const usuario = usuarios[0];

        if (usuario.estado_conta !== 'ativo') {
            let mensagem = "Conta ";
            if (usuario.estado_conta === 'inactivo') {
                mensagem += "inativa";
            } else if (usuario.estado_conta === 'bloqueado') {
                mensagem += "bloqueada";
            }
            mensagem += ". Contacte o administrador.";
            
            return res.status(403).json({ 
                sucesso: false, 
                mensagem: mensagem 
            });
        }

        try {
            const senhaCorreta = await compararSenhas(password, usuario.senha);

            if (!senhaCorreta) {
                return res.status(401).json({ 
                    sucesso: false, 
                    mensagem: "Senha inválida" 
                });
            }

            
            const token = gerarToken({
                id: usuario.id,
                nome: usuario.nome,
                tipo: usuario.tipo,
                id_funcionario: usuario.id_funcionario 
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
                    tipo: usuario.tipo
                }
            };

            if (usuario.contacto) {
                resposta.dados.contacto = usuario.contacto;
            }

            if (usuario.tipo === 'funcionario' || usuario.tipo === 'administrador') {
                resposta.dados.cargo = usuario.cargo;
                resposta.dados.id_funcionario = usuario.id_funcionario;
                resposta.dados.numero_funcionario = usuario.numero_funcionario;
            }

            return res.status(200).json(resposta);

        } catch (error) {
            return res.status(500).json({ 
                sucesso: false, 
                mensagem: "Erro interno no servidor" 
            });
        }
    });
});

/**
 * @swagger
 * /login:
 *   post:
 *     summary: Autentica um usuário no sistema
 *     description: Realiza o login do usuário verificando credenciais e retornando um token JWT para autenticação nas demais rotas
 *     tags: [Autenticação]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email do usuário cadastrado
 *                 example: joao.silva@empresa.com
 *               password:
 *                 type: string
 *                 format: password
 *                 description: Senha do usuário
 *                 example: Senha123!
 *     responses:
 *       200:
 *         description: Login realizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sucesso:
 *                   type: boolean
 *                   example: true
 *                 tipoUsuario:
 *                   type: string
 *                   enum: [funcionario, administrador, cliente]
 *                   example: funcionario
 *                 token:
 *                   type: string
 *                   description: Token JWT para autenticação
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwibm9tZSI6Ikpvw6NvIFNpbHZhIiwidGlwbyI6ImZ1bmNpb25hcmlvIiwiaWRfZnVuY2lvbmFyaW8iOjEsImlhdCI6MTY5MDAwMDAwMCwiZXhwIjoxNjkwMDAzNjAwfQ...
 *                 dados:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: integer
 *                       description: ID do usuário
 *                       example: 1
 *                     nome:
 *                       type: string
 *                       description: Nome completo do usuário
 *                       example: João Silva
 *                     email:
 *                       type: string
 *                       description: Email do usuário
 *                       example: joao.silva@empresa.com
 *                     tipo:
 *                       type: string
 *                       description: Tipo de usuário
 *                       enum: [funcionario, administrador, cliente]
 *                       example: funcionario
 *                     contacto:
 *                       type: string
 *                       description: Número de telefone do usuário (opcional)
 *                       example: +244 923456789
 *                     cargo:
 *                       type: string
 *                       description: Cargo do usuário (apenas para funcionários e administradores)
 *                       example: Desenvolvedor Sênior
 *                     id_funcionario:
 *                       type: integer
 *                       description: ID do funcionário (apenas para funcionários e administradores)
 *                       example: 1
 *                     numero_funcionario:
 *                       type: string
 *                       description: Número de matrícula do funcionário (apenas para funcionários e administradores)
 *                       example: FUNC-001
 *       400:
 *         description: Campos obrigatórios não preenchidos
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
 *                   example: Preencha todos os campos
 *       401:
 *         description: Credenciais inválidas
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
 *                   example: Email não cadastrado
 *       403:
 *         description: Conta bloqueada ou inativa
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
 *                   example: Conta inativa. Contacte o administrador.
 *       500:
 *         description: Erro interno no servidor
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
 *                   example: Erro ao buscar usuário
 */

module.exports = router;