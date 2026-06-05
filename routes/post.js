const express = require("express");
const router = express.Router();
const conexao = require("../infra/conexao");
const { criptografarSenha, gerarSenhaParaEmail, gerarCodigo } = require("../utils/senha");
const { enviarSenhaAcesso } = require("../utils/email");
const {verificarToken} = require("../middleware/authMiddleware");
const { v4: uuidv4 } = require("uuid");

/**
 * @swagger
 * /register:
 *   post:
 *     summary: Registro de novo utilizador
 *     description: Cadastra um novo cliente, funcionario ou administrador com senha temporária gerada automaticamente e enviada por email
 *     tags: [Registro]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nome_completo
 *               - email
 *               - telefone
 *               - tipo_utilizador
 *             properties:
 *               nome_completo:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 100
 *                 example: "João Silva"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "joao@gmail.com"
 *               telefone:
 *                 type: string
 *                 pattern: "^[0-9]{9,12}$"
 *                 example: "923456789"
 *               tipo_utilizador:
 *                 type: string
 *                 enum: [cliente, funcionario, administrador]
 *                 example: "cliente"
 *               cargo:
 *                 type: string
 *                 example: "Atendente"
 *               numero_funcionario:
 *                 type: string
 *                 example: "FUNC001"
 *     responses:
 *       201:
 *         description: Utilizador cadastrado com sucesso
 *       400:
 *         description: Erro de validação
 *       500:
 *         description: Erro interno no servidor
 */

router.post("/register",verificarToken, async (req, res) => {
    const { 
        nome_completo, 
        email, 
        telefone, 
        tipo_utilizador,
        cargo,
        numero_funcionario
    } = req.body;

    // Validações básicas
    if (!nome_completo || !email || !telefone || !tipo_utilizador) {
        return res.status(400).json({
            sucesso: false,
            mensagem: "Preencha todos os campos: nome_completo, email, telefone, tipo_utilizador"
        });
    }

    // Validar tipo de utilizador
    const tiposValidos = ['cliente', 'funcionario', 'administrador'];
    if (!tiposValidos.includes(tipo_utilizador)) {
        return res.status(400).json({
            sucesso: false,
            mensagem: "Tipo de utilizador inválido. Use: cliente, funcionario ou administrador"
        });
    }

    // Validar nome
    if (nome_completo.length < 3) {
        return res.status(400).json({
            sucesso: false,
            mensagem: "Nome deve ter pelo menos 3 caracteres"
        });
    }

    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({
            sucesso: false,
            mensagem: "Email inválido"
        });
    }

    // Validar telefone
    const telefoneLimpo = telefone.replace(/\D/g, '');
    if (telefoneLimpo.length < 9 || telefoneLimpo.length > 12) {
        return res.status(400).json({
            sucesso: false,
            mensagem: "Telefone inválido. Deve conter entre 9 e 12 dígitos"
        });
    }

    // Validar campos para funcionario e administrador
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
        // Verificar se email já existe
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

        // Verificar se telefone já existe
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

        // Verificar número de funcionário se for funcionario/admin
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

        // Gerar senha temporária
        const senhaTemporaria = gerarSenhaParaEmail();
        
        // Criptografar senha
        const senhaHash = await criptografarSenha(senhaTemporaria);
        
        // Gerar IDs
        const id_utilizador = uuidv4();
        const id_funcionario = tipo_utilizador !== 'cliente' ? uuidv4() : null;

        // Inserir utilizador
        const sqlInsert = `
            INSERT INTO utilizadores 
            (id_utilizador, nome_completo, email, senha_hash, tipo_utilizador, telefone, estado_conta, data_cadastro) 
            VALUES ($1, $2, $3, $4, $5, $6, 'activo', CURRENT_TIMESTAMP)
        `;

        await conexao.query(sqlInsert, [id_utilizador, nome_completo, email, senhaHash, tipo_utilizador, telefone]);

        // Inserir funcionario se necessário
        if (tipo_utilizador !== 'cliente') {
            const sqlInsertFunc = `
                INSERT INTO funcionarios (id_funcionario, id_utilizador, cargo, numero_funcionario) 
                VALUES ($1, $2, $3, $4)
            `;
            
            await conexao.query(sqlInsertFunc, [id_funcionario, id_utilizador, cargo, numero_funcionario]);
        }

        // Enviar email com a senha
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

        // Preparar resposta
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

        // Adicionar campos específicos para funcionario/admin
        if (tipo_utilizador !== 'cliente') {
            resposta.dados.cargo = cargo;
            resposta.dados.numero_funcionario = numero_funcionario;
            resposta.dados.id_funcionario = id_funcionario;
        }

        // Incluir senha apenas em desenvolvimento
        if (process.env.NODE_ENV !== 'production') {
            resposta.senha_temporaria = senhaTemporaria;
            resposta.email_enviado = emailEnviado;
            if (erroEmail) {
                resposta.erro_email = erroEmail;
            }
        }

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
 *     description: Registra uma nova sala e cria automaticamente os lugares baseados na capacidade total
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
 *                 example: Sala VIP 1
 *               capacidade_total:
 *                 type: integer
 *                 description: Capacidade total da sala
 *                 example: 50
 *               tipo_sala:
 *                 type: string
 *                 enum: [NORMAL, VIP, 3D, IMAX]
 *                 description: Tipo da sala (opcional - padrão NORMAL)
 *                 example: VIP
 *               estado_sala:
 *                 type: string
 *                 enum: [ATIVA, INATIVA, MANUTENCAO, operacional]
 *                 description: Estado da sala (opcional - padrão operacional)
 *                 example: operacional
 *               coluna:
 *                 type: integer
 *                 description: Número de colunas (opcional - padrão 10)
 *                 example: 10
 *               fila:
 *                 type: integer
 *                 description: Número de filas (opcional - calculado automaticamente se não informado)
 *                 example: 5
 *               tipo_lugar:
 *                 type: string
 *                 enum: [NORMAL, VIP, PREMIUM, ESPECIAL, CAMAROTE]
 *                 description: Tipo do lugar (opcional - padrão vip)
 *                 example: vip
 *               estado_permanente:
 *                 type: string
 *                 enum: [activo, inactivo, manutencao]
 *                 description: Estado permanente do lugar (opcional - padrão activo)
 *                 example: activo
 *               preco_adicional:
 *                 type: number
 *                 description: Preço adicional do lugar (opcional - padrão 0)
 *                 example: 5.00
 *               estado_compra:
 *                 type: string
 *                 enum: [livre, ocupado, reservado, bloqueado]
 *                 description: Estado de compra do lugar (opcional - padrão livre)
 *                 example: livre
 *     responses:
 *       201:
 *         description: Sala criada com sucesso
 *       400:
 *         description: Dados inválidos
 *       500:
 *         description: Erro interno
 */

router.post('/salas',verificarToken, async (req, res) => {
    const {
        nome_sala,
        capacidade_total,
        tipo_sala = 'NORMAL',
        estado_sala = 'operacional',
        coluna = 10,
        fila,
        tipo_lugar = 'vip',
        estado_permanente = 'activo',
        preco_adicional = 0.00,
        estado_compra = 'livre'
    } = req.body;

    // Validações
    if (!nome_sala || nome_sala.trim() === '') {
        return res.status(400).json({
            sucesso: false,
            mensagem: "Nome da sala é obrigatório"
        });
    }

    if (!capacidade_total || capacidade_total <= 0) {
        return res.status(400).json({
            sucesso: false,
            mensagem: "Capacidade total deve ser maior que 0"
        });
    }

    if (capacidade_total > 200) {
        return res.status(400).json({
            sucesso: false,
            mensagem: "Capacidade máxima permitida é de 200 lugares"
        });
    }

    if (coluna < 1 || coluna > 20) {
        return res.status(400).json({
            sucesso: false,
            mensagem: "Número de colunas deve ser entre 1 e 20"
        });
    }

    // Validar tipo_lugar
    const tiposLugarValidos = ['NORMAL', 'VIP', 'PREMIUM', 'ESPECIAL', 'CAMAROTE', 'vip', 'normal'];
    if (!tiposLugarValidos.includes(tipo_lugar)) {
        return res.status(400).json({
            sucesso: false,
            mensagem: `Tipo de lugar inválido. Use: ${tiposLugarValidos.join(', ')}`
        });
    }

    // Validar estado_permanente
    const estadosPermanenteValidos = ['activo', 'inactivo', 'manutencao'];
    if (!estadosPermanenteValidos.includes(estado_permanente)) {
        return res.status(400).json({
            sucesso: false,
            mensagem: `Estado permanente inválido. Use: ${estadosPermanenteValidos.join(', ')}`
        });
    }

    // Validar estado_compra
    const estadosCompraValidos = ['livre', 'ocupado', 'reservado', 'bloqueado'];
    if (!estadosCompraValidos.includes(estado_compra)) {
        return res.status(400).json({
            sucesso: false,
            mensagem: `Estado de compra inválido. Use: ${estadosCompraValidos.join(', ')}`
        });
    }

    // Validar preco_adicional
    // if (preco_adicional < 0 || preco_adicional > 100000) {
    //     return res.status(400).json({
    //         sucesso: false,
    //         mensagem: "Preço adicional deve ser entre 0 e 100"
    //     });
    // }

    // Calcular número de filas
    let total_filas;
    const lugares_por_fila = coluna;
    let capacidade_calculada;

    if (fila && fila > 0) {
        total_filas = fila;
        capacidade_calculada = total_filas * lugares_por_fila;
        
        if (capacidade_total > capacidade_calculada) {
            return res.status(400).json({
                sucesso: false,
                mensagem: `Capacidade total (${capacidade_total}) excede a capacidade máxima com ${total_filas} filas e ${lugares_por_fila} colunas (${capacidade_calculada} lugares)`
            });
        }
    } else {
        total_filas = Math.ceil(capacidade_total / lugares_por_fila);
        capacidade_calculada = total_filas * lugares_por_fila;
    }

    const id_sala = uuidv4();

    try {
        // Iniciar transação
        await conexao.query('BEGIN');

        // Inserir sala
        const insertSalaQuery = `
            INSERT INTO salas (id_sala, nome_sala, capacidade_total, tipo_sala, estado_sala, coluna, fila)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `;

        await conexao.query(insertSalaQuery, [
            id_sala,
            nome_sala.trim(),
            capacidade_total,
            tipo_sala,
            estado_sala,
            lugares_por_fila,
            total_filas
        ]);

        // Gerar lugares
        const fileiras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
        let lugaresInseridos = 0;
        const lugaresGerados = [];
        
        for (let filaIndex = 0; filaIndex < total_filas; filaIndex++) {
            const letraFileira = fileiras[filaIndex % fileiras.length];
            
            let lugares_na_fila;
            if (fila && fila > 0) {
                // Modo manual: todas as filas têm o mesmo número de lugares
                lugares_na_fila = lugares_por_fila;
            } else {
                // Modo automático: última fila pode ter menos lugares
                const lugaresRestantes = capacidade_total - lugaresInseridos;
                lugares_na_fila = Math.min(lugares_por_fila, lugaresRestantes);
            }
            
            for (let numero = 1; numero <= lugares_na_fila; numero++) {
                const codigo_lugar = `${letraFileira}${numero}`;
                const id_lugar = uuidv4();
                const codigo_unico = gerarCodigo();
                
                const insertLugarQuery = `
                    INSERT INTO lugares (id_lugar, id_sala, codigo_lugar, tipo_lugar, fileira, numero, estado_permanente, preco_adicional, estado_compra, codigo)
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                `;
                
                await conexao.query(insertLugarQuery, [
                    id_lugar,
                    id_sala,
                    codigo_lugar,
                    tipo_lugar,
                    letraFileira,
                    numero,
                    estado_permanente,
                    preco_adicional,
                    estado_compra,
                    codigo_unico
                ]);
                
                lugaresGerados.push({
                    id_lugar,
                    codigo_lugar,
                    tipo_lugar,
                    fileira: letraFileira,
                    numero,
                    estado_permanente,
                    estado_compra,
                    preco_adicional,
                    codigo: codigo_unico
                });
                
                lugaresInseridos++;
            }
        }

        // Atualizar capacidade total real da sala se necessário
        if (lugaresInseridos !== capacidade_total) {
            const updateCapacidadeQuery = `
                UPDATE salas 
                SET capacidade_total = $1 
                WHERE id_sala = $2
            `;
            await conexao.query(updateCapacidadeQuery, [lugaresInseridos, id_sala]);
        }

        // Commit da transação
        await conexao.query('COMMIT');

        // Buscar a sala criada para retornar
        const selectSalaQuery = `
            SELECT id_sala, nome_sala, capacidade_total, tipo_sala, estado_sala, coluna, fila 
            FROM salas 
            WHERE id_sala = $1
        `;
        const salaCriada = await conexao.query(selectSalaQuery, [id_sala]);

        res.status(201).json({
            sucesso: true,
            mensagem: `Sala criada com ${lugaresInseridos} lugares com sucesso`,
            sala: salaCriada.rows[0],
            lugares_criados: lugaresInseridos,
            configuracao: {
                colunas: lugares_por_fila,
                filas: total_filas,
                lugares_por_fila: lugares_por_fila,
                total_lugares: total_filas * lugares_por_fila,
                capacidade_solicitada: capacidade_total,
                diferenca: (total_filas * lugares_por_fila) - capacidade_total
            },
            exemplos_lugares: lugaresGerados.slice(0, 5)
        });

    } catch (err) {
        // Rollback em caso de erro
        await conexao.query('ROLLBACK');
        
        res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao criar sala e lugares",
            erro: err.message
        });
    }
});

module.exports = router;