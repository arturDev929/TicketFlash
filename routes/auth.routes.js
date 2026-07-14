const express = require("express");
const router = express.Router();
const conexao = require("../infra/conexao");

const { verificarToken, autorizar } = require("../middleware/authMiddleware");
const {
  criptografarSenha,
  compararSenhas,
  gerarSenhaParaEmail,
} = require("../utils/senha");
const { registrarLog } = require("../utils/log");
const { enviarSenhaAcesso, enviarBoasVindas } = require("../utils/email");
const { v4: uuidv4 } = require("uuid");

router.post("/register", verificarToken, autorizar("administrador"), async (req, res) => {
    const { 
        nome_completo, 
        email, 
        telefone, 
        tipo_utilizador,
        cargo,
        numero_funcionario
    } = req.body;

    if (!nome_completo || !email || !telefone || !tipo_utilizador) {
        return res.status(400).json({
            sucesso: false,
            mensagem: "Preencha todos os campos: nome_completo, email, telefone, tipo_utilizador"
        });
    }

    const tiposValidos = ['cliente', 'funcionario', 'administrador'];
    if (!tiposValidos.includes(tipo_utilizador)) {
        return res.status(400).json({
            sucesso: false,
            mensagem: "Tipo de utilizador inválido. Use: cliente, funcionario ou administrador"
        });
    }

    if (nome_completo.length < 3) {
        return res.status(400).json({
            sucesso: false,
            mensagem: "Nome deve ter pelo menos 3 caracteres"
        });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({
            sucesso: false,
            mensagem: "Email inválido"
        });
    }

    const telefoneLimpo = telefone.replace(/\D/g, '');
    if (telefoneLimpo.length < 9 || telefoneLimpo.length > 12) {
        return res.status(400).json({
            sucesso: false,
            mensagem: "Telefone inválido. Deve conter entre 9 e 12 dígitos"
        });
    }

    if (tipo_utilizador !== 'cliente') {
        if (!cargo || !numero_funcionario) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Para funcionario ou administrador, informe cargo e numero_funcionario"
            });
        }
        
        if (numero_funcionario.length < 3) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Número de funcionário deve ter pelo menos 3 caracteres"
            });
        }
    }

    try {
        const checkEmailResult = await conexao.query(
            "SELECT email FROM utilizadores WHERE email = $1", 
            [email]
        );
        
        if (checkEmailResult.rows.length > 0) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Email já cadastrado no sistema"
            });
        }
        const checkTelefoneResult = await conexao.query(
            "SELECT telefone FROM utilizadores WHERE telefone = $1", 
            [telefone]
        );
        
        if (checkTelefoneResult.rows.length > 0) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Telefone já cadastrado no sistema"
            });
        }
        if (tipo_utilizador !== 'cliente') {
            const checkFuncResult = await conexao.query(
                "SELECT numero_funcionario FROM funcionarios WHERE numero_funcionario = $1", 
                [numero_funcionario]
            );
            
            if (checkFuncResult.rows.length > 0) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: "Número de funcionário já cadastrado no sistema"
                });
            }
        }

        const senhaTemporaria = gerarSenhaParaEmail();
        
        const senhaHash = await criptografarSenha(senhaTemporaria);
        
        const id_utilizador = uuidv4();
        const id_funcionario = tipo_utilizador !== 'cliente' ? uuidv4() : null;

        const sqlInsert = `
            INSERT INTO utilizadores 
            (id_utilizador, nome_completo, email, senha_hash, tipo_utilizador, telefone, estado_conta, data_cadastro) 
            VALUES ($1, $2, $3, $4, $5, $6, 'ativo', CURRENT_TIMESTAMP)
        `;

        await conexao.query(sqlInsert, [id_utilizador, nome_completo, email, senhaHash, tipo_utilizador, telefone]);

        if (tipo_utilizador !== 'cliente') {
            const sqlInsertFunc = `
                INSERT INTO funcionarios (id_funcionario, id_utilizador, cargo, numero_funcionario) 
                VALUES ($1, $2, $3, $4)
            `;
            
            await conexao.query(sqlInsertFunc, [id_funcionario, id_utilizador, cargo, numero_funcionario]);
        }

        let emailEnviado = false;
        let erroEmail = null;
        
        try {
            const resultado = await enviarSenhaAcesso(email, nome_completo, senhaTemporaria);
            emailEnviado = resultado.sucesso;
            if (!emailEnviado) {
                erroEmail = resultado.erro;
            }
        } catch (error) {
            erroEmail = error.message;
        }

        const resposta = {
            sucesso: true,
            mensagem: emailEnviado 
                ? `${tipo_utilizador.charAt(0).toUpperCase() + tipo_utilizador.slice(1)} cadastrado com sucesso! Verifique seu email para a senha de acesso.`
                : `${tipo_utilizador.charAt(0).toUpperCase() + tipo_utilizador.slice(1)} cadastrado com sucesso! Mas não foi possível enviar o email.`,
            dados: {
                id: id_utilizador,
                nome: nome_completo,
                email: email,
                telefone: telefone,
                tipo: tipo_utilizador,
                data_cadastro: new Date().toISOString()
            }
        };

        if (tipo_utilizador !== 'cliente') {
            resposta.dados.cargo = cargo;
            resposta.dados.numero_funcionario = numero_funcionario;
            resposta.dados.id_funcionario = id_funcionario;
        }

        if (process.env.NODE_ENV !== 'production') {
            resposta.senha_temporaria = senhaTemporaria;
            resposta.email_enviado = emailEnviado;
            if (erroEmail) {
                resposta.erro_email = erroEmail;
            }
        }

        registrarLog({
            id_funcionario: req.usuario?.id_funcionario,
            accao: 'CRIAR_UTILIZADOR',
            tabela_afectada: 'utilizadores',
            registo_id: id_utilizador,
            detalhes: { tipo_utilizador, email },
            ip_origem: req.ip,
        });

        return res.status(201).json(resposta);

    } catch (error) {
        console.error("Erro no cadastro:", error.message);
        
        if (error.code === '23505') {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Email, telefone ou número de funcionário já cadastrado"
            });
        }

        return res.status(500).json({
            sucesso: false,
            mensagem: "Erro interno no servidor ao cadastrar utilizador",
            erro: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

/**
 * @swagger
 * /salas:
 *   post:
 *     summary: Criar uma nova sala com lugares automáticos
 *     description: Registra uma nova sala e cria automaticamente os lugares baseados na configuracao de colunas e filas.
 *     tags: [Salas]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nome_sala
 *               - capacidade_total
 *             properties:
 *               nome_sala:
 *                 type: string
 *                 description: Nome da sala
 *                 example: "Sala Pequena"
 *               capacidade_total:
 *                 type: integer
 *                 description: Capacidade total da sala
 *                 example: 11
 *               tipo_sala:
 *                 type: string
 *                 enum: [NORMAL, VIP, 3D, IMAX]
 *                 description: Tipo da sala
 *                 example: NORMAL
 *               estado_sala:
 *                 type: string
 *                 enum: [ativa, inativa, manutencao]
 *                 description: Estado da sala
 *                 example: ativa
 *               coluna:
 *                 type: integer
 *                 description: Numero de colunas por fila
 *                 example: 4
 *               fila:
 *                 type: integer
 *                 description: Numero de filas
 *                 example: 3
 *     responses:
 *       201:
 *         description: Sala criada com sucesso
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
 *                   example: "Sala criada com 11 lugares com sucesso"
 *                 sala:
 *                   type: object
 *                   properties:
 *                     id_sala:
 *                       type: string
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
 *                 lugares_criados:
 *                   type: integer
 *                   example: 11
 *                 configuracao:
 *                   type: object
 *                   properties:
 *                     colunas:
 *                       type: integer
 *                       example: 4
 *                     filas:
 *                       type: integer
 *                       example: 3
 *                     total_posicoes:
 *                       type: integer
 *                       example: 12
 *                     lugares_ocupados:
 *                       type: integer
 *                       example: 11
 *                     lugares_vazios:
 *                       type: integer
 *                       example: 1
 *                     capacidade_solicitada:
 *                       type: integer
 *                       example: 11
 *                     porcentagem_ocupacao:
 *                       type: string
 *                       example: "92%"
 *                 mapa_visual:
 *                   type: string
 *                   example: "+---+---+---+---+\n| A | A1 | A2 | A3 | A4 |\n+---+---+---+---+\n| B | B1 | B2 | B3 | B4 |\n+---+---+---+---+\n| C | C1 | C2 | C3 | ·· |\n+---+---+---+---+"
 *                 exemplos_lugares:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id_lugar:
 *                         type: string
 *                       codigo_lugar:
 *                         type: string
 *                         example: "A1"
 *                       fileira:
 *                         type: string
 *                         example: "A"
 *                       numero:
 *                         type: integer
 *                         example: 1
 *                       estado_permanente:
 *                         type: string
 *                         example: "ativo"
 *                       estado_compra:
 *                         type: string
 *                         example: "livre"
 *       400:
 *         description: Dados invalidos
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
 *                   example: "Capacidade total deve ser maior que 0"
 *                 sugestoes:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       descricao:
 *                         type: string
 *                       filas:
 *                         type: integer
 *                       colunas:
 *                         type: integer
 *                       total:
 *                         type: integer
 *                       lugares_vazios:
 *                         type: integer
 *       409:
 *         description: Conflito - Sala ja existe
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
 *                   example: "Ja existe uma sala com o nome Sala Pequena e tipo NORMAL"
 *                 sala_existente:
 *                   type: object
 *                   properties:
 *                     id_sala:
 *                       type: string
 *                     nome_sala:
 *                       type: string
 *                     tipo_sala:
 *                       type: string
 *       500:
 *         description: Erro interno
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
 *                   example: "Erro ao criar sala e lugares"
 *                 erro:
 *                   type: string
 */

router.post('/registerClient', async (req, res) => {
    const id_utilizador = uuidv4();
    const tipo_utilizador = 'cliente';
    const data_cadastro = new Date();
    const estado_conta = 'ativo';
    
    const {
        nome_completo,
        email,
        senha_hash,
        confirmar_senha_hash,
        telefone
    } = req.body;

    // --- VALIDAÇÕES ---
    if (!nome_completo || nome_completo.trim() === '') {
        return res.status(400).json({
            sucesso: false,
            mensagem: "Nome completo é obrigatório"
        });
    }

    if (!email || email.trim() === '') {
        return res.status(400).json({
            sucesso: false,
            mensagem: "Email é obrigatório"
        });
    }

    // Validar formato do email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({
            sucesso: false,
            mensagem: "Email inválido"
        });
    }

    if (!senha_hash || senha_hash.length < 8) {
        return res.status(400).json({
            sucesso: false,
            mensagem: "A senha deve ter pelo menos 8 caracteres"
        });
    }

    if (senha_hash !== confirmar_senha_hash) {
        return res.status(400).json({
            sucesso: false,
            mensagem: "As senhas não coincidem"
        });
    }

    if (!telefone || telefone.trim() === '') {
        return res.status(400).json({
            sucesso: false,
            mensagem: "Telefone é obrigatório"
        });
    }

    try {
        // --- VERIFICAR SE EMAIL JÁ ESTÁ CADASTRADO ---
        const verificarEmailQuery = `
            SELECT id_utilizador, email FROM utilizadores WHERE email = $1
        `;
        const emailExistente = await conexao.query(verificarEmailQuery, [email.trim()]);

        if (emailExistente.rows.length > 0) {
            return res.status(409).json({
                sucesso: false,
                mensagem: "Este email já está registrado",
                email: email
            });
        }

        // ✅ Hash da senha com bcrypt — antes disto, a senha em texto puro
        // enviada pelo cliente era gravada diretamente na coluna senha_hash,
        // o que fazia o login falhar sempre (bcrypt.compare nunca reconhece
        // uma string que não é um hash bcrypt válido).
        const senhaCriptografada = await criptografarSenha(senha_hash);

        // --- INSERIR CLIENTE ---
        const sql = `
            INSERT INTO utilizadores (
                id_utilizador,
                nome_completo,
                email,
                senha_hash,
                telefone,
                tipo_utilizador,
                data_cadastro,
                estado_conta
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING id_utilizador, nome_completo, email, telefone, tipo_utilizador, estado_conta, data_cadastro
        `;

        const values = [
            id_utilizador,
            nome_completo.trim(),
            email.trim(),
            senhaCriptografada,
            telefone.trim(),
            tipo_utilizador,
            data_cadastro,
            estado_conta
        ];

        const result = await conexao.query(sql, values);

        // --- ENVIAR EMAIL DE BOAS-VINDAS ---
        try {
            await enviarBoasVindas(email, nome_completo);
        } catch (emailError) {
            console.error('Erro ao enviar email de boas-vindas:', emailError);
            // Não interrompe o fluxo
        }

        res.status(201).json({
            sucesso: true,
            mensagem: "Cliente registrado com sucesso",
            cliente: result.rows[0],
            email_enviado: true
        });

    } catch (error) {
        console.error('Erro ao registrar cliente:', error);
        res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao registrar cliente",
            erro: error.message
        });
    }
});


/**
 * @swagger
 * /alterar-senha:
 *   post:
 *     summary: Altera a senha do próprio utilizador autenticado
 *     description: Exige a senha atual correta antes de gravar a nova senha (já cifrada com bcrypt).
 *     tags: [Autenticação]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Senha alterada com sucesso
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Senha atual incorreta ou não autenticado
 *       403:
 *         description: Não pode alterar a senha de outro utilizador
 *       404:
 *         description: Utilizador não encontrado
 *       500:
 *         description: Erro interno do servidor
 */

router.post("/alterar-senha", verificarToken, async (req, res) => {
    const { id_utilizador, senha_atual, nova_senha } = req.body;

    if (!id_utilizador || !senha_atual || !nova_senha) {
        return res.status(400).json({
            sucesso: false,
            mensagem: "id_utilizador, senha_atual e nova_senha são obrigatórios"
        });
    }

    if (nova_senha.length < 6) {
        return res.status(400).json({
            sucesso: false,
            mensagem: "A nova senha deve ter pelo menos 6 caracteres"
        });
    }

    // ✅ Só é possível alterar a própria senha por esta rota
    if (req.usuario?.id !== id_utilizador) {
        return res.status(403).json({
            sucesso: false,
            mensagem: "Não pode alterar a senha de outro utilizador"
        });
    }

    try {
        const usuarioResult = await conexao.query(
            "SELECT id_utilizador, senha_hash FROM utilizadores WHERE id_utilizador = $1",
            [id_utilizador]
        );

        if (usuarioResult.rows.length === 0) {
            return res.status(404).json({
                sucesso: false,
                mensagem: "Utilizador não encontrado"
            });
        }

        const usuario = usuarioResult.rows[0];
        const senhaCorreta = await compararSenhas(senha_atual, usuario.senha_hash);

        if (!senhaCorreta) {
            return res.status(401).json({
                sucesso: false,
                mensagem: "Senha atual incorreta"
            });
        }

        const novaSenhaHash = await criptografarSenha(nova_senha);

        await conexao.query(
            "UPDATE utilizadores SET senha_hash = $1 WHERE id_utilizador = $2",
            [novaSenhaHash, id_utilizador]
        );

        // Auditoria: registar a alteração de senha (se for funcionário/administrador)
        if (req.usuario?.id_funcionario) {
            registrarLog({
                id_funcionario: req.usuario.id_funcionario,
                accao: "ALTERAR_SENHA",
                tabela_afectada: "utilizadores",
                registo_id: id_utilizador,
                ip_origem: req.ip,
            });
        }

        res.status(200).json({
            sucesso: true,
            mensagem: "Senha alterada com sucesso"
        });
    } catch (error) {
        console.error("Erro ao alterar senha:", error);
        res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao alterar senha",
            erro: error.message
        });
    }
});

router.put("/clientSenha/:id", async (req, res) => {});

router.put("/clientRecuperarSenha", async (req, res) => {
  const email = req.body;
});

// post.js

module.exports = router;
