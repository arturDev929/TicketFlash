const express = require("express");
const router = express.Router();
const conexao = require("../infra/conexao");
const { compararSenhas } = require("../utils/senha");
const { gerarToken } = require("../utils/token");

/**
 * @swagger
 * /login:
 *   post:
 *     summary: Login de usuario
 *     description: Autentica administrador, funcionario ou cliente
 *     tags: [Autenticacao]
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
 *                 example: "admin@cinema.com"
 *               password:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Login realizado com sucesso
 *       400:
 *         description: Campos obrigatorios
 *       401:
 *         description: Credenciais invalidas
 *       403:
 *         description: Conta bloqueada ou inativa
 *       500:
 *         description: Erro no servidor
 */

router.post("/", (req, res) => {
    const { email, password } = req.body;

    console.log("========================================");
    console.log("LOGIN - Nova tentativa de autenticacao");
    console.log("Email recebido:", email);
    console.log("Password recebida:", password ? "***" : "nao fornecida");
    console.log("========================================");

    if (!email || !password) {
        console.log("ERRO: Campos obrigatorios nao preenchidos");
        return res.status(400).json({
            sucesso: false,
            mensagem: "Preencha todos os campos"
        });
    }

    // Query unificada na tabela utilizadores
    const sqlUtilizador = `
        SELECT 
            u.id_utilizador as id,
            u.nome_completo as nome,
            u.email,
            u.senha_hash as senha,
            u.tipo_utilizador as tipo,
            u.telefone as contacto,
            u.estado_conta,
            f.id_funcionario,
            f.cargo,
            f.numero_funcionario
        FROM utilizadores u
        LEFT JOIN funcionarios f ON u.id_utilizador = f.id_utilizador
        WHERE u.email = $1
    `;

    conexao.query(sqlUtilizador, [email], async (err, result) => {
        if (err) {
            console.error("ERRO na query:", err.message);
            return res.status(500).json({ 
                sucesso: false, 
                mensagem: "Erro ao buscar usuário" 
            });
        }

        const usuarios = result.rows;
        console.log("Resultados encontrados:", usuarios.length);

        if (usuarios.length === 0) {
            console.log("ERRO: Usuario nao encontrado:", email);
            console.log("========================================\n");
            return res.status(401).json({ 
                sucesso: false, 
                mensagem: "Email não cadastrado" 
            });
        }

        const usuario = usuarios[0];
        console.log("Usuario encontrado:", usuario.email);
        console.log("Nome:", usuario.nome);
        console.log("Tipo:", usuario.tipo);
        console.log("Estado da conta:", usuario.estado_conta);

        // Verificar se a conta está ativa
        if (usuario.estado_conta !== 'activo') {
            let mensagem = "Conta ";
            if (usuario.estado_conta === 'inactivo') {
                mensagem += "inativa";
            } else if (usuario.estado_conta === 'bloqueado') {
                mensagem += "bloqueada";
            }
            mensagem += ". Contacte o administrador.";
            
            console.log("ERRO: Conta", usuario.estado_conta);
            console.log("========================================\n");
            
            return res.status(403).json({ 
                sucesso: false, 
                mensagem: mensagem 
            });
        }

        try {
            console.log("Comparando senha...");
            const senhaCorreta = await compararSenhas(password, usuario.senha);
            console.log("Senha correta?", senhaCorreta);

            if (!senhaCorreta) {
                console.log("ERRO: Senha invalida para:", usuario.email);
                
                // Opcional: Registrar tentativa de login falha
                // await registrarLogFalha(usuario.id_utilizador, req.ip);
                
                return res.status(401).json({ 
                    sucesso: false, 
                    mensagem: "Senha inválida" 
                });
            }

            // Preparar dados para o token baseado no tipo de usuário
            const payload = {
                id: usuario.id,
                nome: usuario.nome,
                tipo: usuario.tipo
            };

            // Adicionar informações específicas para funcionários
            if (usuario.tipo === 'funcionario' || usuario.tipo === 'administrador') {
                payload.id_funcionario = usuario.id_funcionario;
                payload.cargo = usuario.cargo;
                payload.numero_funcionario = usuario.numero_funcionario;
            }

            console.log("Gerando token para", usuario.tipo, "...");
            const token = gerarToken(payload, usuario.tipo);
            console.log("Token gerado com sucesso");

            // Atualizar último acesso
            const sqlUpdate = `
                UPDATE utilizadores 
                SET ultimo_acesso = CURRENT_TIMESTAMP 
                WHERE id_utilizador = $1
            `;
            
            conexao.query(sqlUpdate, [usuario.id], (updateErr) => {
                if (updateErr) {
                    console.error("ERRO ao atualizar ultimo_acesso:", updateErr.message);
                    // Não interrompe o login, apenas loga o erro
                }
            });

            // Preparar resposta base
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

            // Adicionar campos específicos
            if (usuario.contacto) {
                resposta.dados.contacto = usuario.contacto;
            }

            if (usuario.tipo === 'funcionario' || usuario.tipo === 'administrador') {
                resposta.dados.cargo = usuario.cargo;
                resposta.dados.id_funcionario = usuario.id_funcionario;
                resposta.dados.numero_funcionario = usuario.numero_funcionario;
            }

            console.log(`LOGIN ${usuario.tipo.toUpperCase()} REALIZADO COM SUCESSO:`, usuario.email);
            console.log("========================================\n");

            return res.status(200).json(resposta);

        } catch (error) {
            console.error("ERRO no processo de login:", error.message);
            console.error(error.stack);
            return res.status(500).json({ 
                sucesso: false, 
                mensagem: "Erro interno no servidor" 
            });
        }
    });
});

// Função opcional para registrar tentativas de login falhas
async function registrarLogFalha(id_utilizador, ip) {
    const sql = `
        INSERT INTO logs_funcionarios 
        (id_log, id_funcionario, accao, tabela_afectada, registo_id, ip_origem, detalhes)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;
    
    // Nota: Isso requer que o usuário seja um funcionário
    // Para clientes, você pode criar uma tabela separada de logs de clientes
    
    const id_log = require('crypto').randomUUID();
    const detalhes = JSON.stringify({ 
        tipo: "tentativa_login_falha",
        email: "provided",
        timestamp: new Date().toISOString()
    });
    
    try {
        // Buscar id_funcionario se existir
        const sqlBusca = "SELECT id_funcionario FROM funcionarios WHERE id_utilizador = $1";
        const result = await new Promise((resolve, reject) => {
            conexao.query(sqlBusca, [id_utilizador], (err, res) => {
                if (err) reject(err);
                else resolve(res);
            });
        });
        
        if (result.rows.length > 0) {
            const id_funcionario = result.rows[0].id_funcionario;
            await new Promise((resolve, reject) => {
                conexao.query(sql, [id_log, id_funcionario, 'tentativa_login_falha', 'utilizadores', id_utilizador, ip, detalhes], (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        }
    } catch (error) {
        console.error("Erro ao registrar log de falha:", error.message);
    }
}

module.exports = router;