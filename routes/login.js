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
 *     description: Autentica admin, funcionario ou cliente
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
 *                 example: "admin@ticketflash.com"
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

    console.log("1. Verificando na tabela ADMIN...");
    const sqlAdmin = "SELECT id_admin as id, nome, email, senha, 'admin' as tipo FROM admin WHERE estado = 'Ativo' AND email = $1";
    
    conexao.query(sqlAdmin, [email], async (err, result) => {
        if (err) {
            console.error("ERRO na query ADMIN:", err.message);
            return res.status(500).json({ sucesso: false, mensagem: err.message });
        }

        const adminResults = result.rows;
        console.log("Resultados ADMIN encontrados:", adminResults.length);

        if (adminResults.length > 0) {
            const usuario = adminResults[0];
            console.log("Usuario encontrado na tabela ADMIN:", usuario.email);
            console.log("Nome:", usuario.nome);
            console.log("ID:", usuario.id);

            try {
                console.log("Comparando senha...");
                const senhaCorreta = await compararSenhas(password, usuario.senha);
                console.log("Senha correta?", senhaCorreta);

                if (!senhaCorreta) {
                    console.log("ERRO: Senha invalida para ADMIN");
                    return res.status(401).json({ sucesso: false, mensagem: "Senha invalida" });
                }

                console.log("Gerando token para ADMIN...");
                const token = gerarToken({ id: usuario.id, nome: usuario.nome, tipo: usuario.tipo }, "admin");
                console.log("Token gerado com sucesso");

                console.log("LOGIN ADMIN REALIZADO COM SUCESSO:", usuario.email);
                console.log("========================================\n");

                return res.status(200).json({
                    sucesso: true,
                    tipoUsuario: "admin",
                    token: token,
                    dados: {
                        id: usuario.id,
                        nome: usuario.nome,
                        email: usuario.email,
                        tipo: "admin"
                    }
                });

            } catch (error) {
                console.error("ERRO no try/catch ADMIN:", error.message);
                return res.status(500).json({ sucesso: false, mensagem: error.message });
            }
        } else {
            console.log("2. Verificando na tabela FUNCIONARIO...");
            const sqlFuncionario = "SELECT id_funcionario as id, nome, email, senha, 'funcionario' as tipo, contacto FROM funcionario WHERE estado = 'Ativo' AND email = $1";
            
            conexao.query(sqlFuncionario, [email], async (err, result) => {
                if (err) {
                    console.error("ERRO na query FUNCIONARIO:", err.message);
                    return res.status(500).json({ sucesso: false, mensagem: err.message });
                }

                const funcResults = result.rows;
                console.log("Resultados FUNCIONARIO encontrados:", funcResults.length);

                if (funcResults.length > 0) {
                    const usuario = funcResults[0];
                    console.log("Usuario encontrado na tabela FUNCIONARIO:", usuario.email);
                    console.log("Nome:", usuario.nome);
                    console.log("ID:", usuario.id);

                    try {
                        console.log("Comparando senha...");
                        const senhaCorreta = await compararSenhas(password, usuario.senha);
                        console.log("Senha correta?", senhaCorreta);

                        if (!senhaCorreta) {
                            console.log("ERRO: Senha invalida para FUNCIONARIO");
                            return res.status(401).json({ sucesso: false, mensagem: "Senha invalida" });
                        }

                        console.log("Gerando token para FUNCIONARIO...");
                        const token = gerarToken({ id: usuario.id, nome: usuario.nome, tipo: usuario.tipo }, "funcionario");
                        console.log("Token gerado com sucesso");

                        console.log("LOGIN FUNCIONARIO REALIZADO COM SUCESSO:", usuario.email);
                        console.log("========================================\n");

                        return res.status(200).json({
                            sucesso: true,
                            tipoUsuario: "funcionario",
                            token: token,
                            dados: {
                                id: usuario.id,
                                nome: usuario.nome,
                                email: usuario.email,
                                contacto: usuario.contacto,
                                tipo: "funcionario"
                            }
                        });

                    } catch (error) {
                        console.error("ERRO no try/catch FUNCIONARIO:", error.message);
                        return res.status(500).json({ sucesso: false, mensagem: error.message });
                    }
                } else {
                    console.log("3. Verificando na tabela CLIENTE...");
                    const sqlCliente = "SELECT id_cliente as id, nome, email, senha, 'cliente' as tipo, contacto FROM cliente WHERE email = $1";
                    
                    conexao.query(sqlCliente, [email], async (err, result) => {
                        if (err) {
                            console.error("ERRO na query CLIENTE:", err.message);
                            return res.status(500).json({ sucesso: false, mensagem: err.message });
                        }

                        const clientResults = result.rows;
                        console.log("Resultados CLIENTE encontrados:", clientResults.length);

                        if (clientResults.length > 0) {
                            const usuario = clientResults[0];
                            console.log("Usuario encontrado na tabela CLIENTE:", usuario.email);
                            console.log("Nome:", usuario.nome);
                            console.log("ID:", usuario.id);

                            try {
                                console.log("Comparando senha...");
                                const senhaCorreta = await compararSenhas(password, usuario.senha);
                                console.log("Senha correta?", senhaCorreta);

                                if (!senhaCorreta) {
                                    console.log("ERRO: Senha invalida para CLIENTE");
                                    return res.status(401).json({ sucesso: false, mensagem: "Senha invalida" });
                                }

                                console.log("Gerando token para CLIENTE...");
                                const token = gerarToken({ id: usuario.id, nome: usuario.nome, tipo: usuario.tipo }, "cliente");
                                console.log("Token gerado com sucesso");

                                console.log("LOGIN CLIENTE REALIZADO COM SUCESSO:", usuario.email);
                                console.log("========================================\n");

                                return res.status(200).json({
                                    sucesso: true,
                                    tipoUsuario: "cliente",
                                    token: token,
                                    dados: {
                                        id: usuario.id,
                                        nome: usuario.nome,
                                        email: usuario.email,
                                        contacto: usuario.contacto,
                                        tipo: "cliente"
                                    }
                                });

                            } catch (error) {
                                console.error("ERRO no try/catch CLIENTE:", error.message);
                                return res.status(500).json({ sucesso: false, mensagem: error.message });
                            }
                        } else {
                            console.log("ERRO: Usuario nao encontrado em nenhuma tabela:", email);
                            console.log("========================================\n");
                            return res.status(401).json({ sucesso: false, mensagem: "Email nao cadastrado" });
                        }
                    });
                }
            });
        }
    });
});

module.exports = router;