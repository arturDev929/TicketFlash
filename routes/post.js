const express = require("express");
const router = express.Router();
const conexao = require("../infra/conexao");
const { criptografarSenha, gerarSenhaParaEmail, gerarCodigo,gerarId } = require("../utils/senha");
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
            VALUES ($1, $2, $3, $4, $5, $6, 'activo', CURRENT_TIMESTAMP)
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
 *     description: Registra uma nova sala e cria automaticamente os lugares baseados na capacidade total. Os lugares são criados com estado_permanente='activo' e estado_compra='livre' por padrão.
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
 *                 description: Nome da sala (deve ser único por tipo de sala)
 *                 example: Sala VIP 1
 *               capacidade_total:
 *                 type: integer
 *                 description: Capacidade total da sala (máximo 200 lugares)
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
 *                 description: Número de colunas por fila (opcional - padrão 10, mínimo 1, máximo 20)
 *                 example: 10
 *               fila:
 *                 type: integer
 *                 description: Número de filas (opcional - calculado automaticamente se não informado)
 *                 example: 5
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
 *                   example: Sala criada com 50 lugares com sucesso
 *                 sala:
 *                   type: object
 *                   properties:
 *                     id_sala:
 *                       type: string
 *                       example: "550e8400-e29b-41d4-a716-446655440000"
 *                     nome_sala:
 *                       type: string
 *                       example: "Sala VIP 1"
 *                     capacidade_total:
 *                       type: integer
 *                       example: 50
 *                     tipo_sala:
 *                       type: string
 *                       example: "VIP"
 *                     estado_sala:
 *                       type: string
 *                       example: "operacional"
 *                     coluna:
 *                       type: integer
 *                       example: 10
 *                     fila:
 *                       type: integer
 *                       example: 5
 *                 lugares_criados:
 *                   type: integer
 *                   example: 50
 *                 configuracao:
 *                   type: object
 *                   properties:
 *                     colunas:
 *                       type: integer
 *                       example: 10
 *                     filas:
 *                       type: integer
 *                       example: 5
 *                     lugares_por_fila:
 *                       type: integer
 *                       example: 10
 *                     total_lugares:
 *                       type: integer
 *                       example: 50
 *                     capacidade_solicitada:
 *                       type: integer
 *                       example: 50
 *                     diferenca:
 *                       type: integer
 *                       example: 0
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
 *                         example: "activo"
 *                       estado_compra:
 *                         type: string
 *                         example: "livre"
 *                       codigo:
 *                         type: string
 *                         example: "ABC123"
 *       400:
 *         description: Dados inválidos
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
 *       409:
 *         description: Conflito - Sala já existe
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
 *                   example: "Já existe uma sala com o nome \"Sala VIP 1\" e tipo \"VIP\""
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

router.post('/salas',verificarToken, async (req, res) => {
    const {
        nome_sala,
        capacidade_total,
        tipo_sala,
        estado_sala,
        coluna,
        fila
    } = req.body;

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
        // Verificar se já existe uma sala com o mesmo nome e tipo
        const verificarSalaQuery = `
            SELECT id_sala, nome_sala, tipo_sala 
            FROM salas 
            WHERE nome_sala = $1 AND tipo_sala = $2
        `;
        
        const salaExistente = await conexao.query(verificarSalaQuery, [nome_sala.trim(), tipo_sala]);
        
        if (salaExistente.rows.length > 0) {
            return res.status(409).json({
                sucesso: false,
                mensagem: `Já existe uma sala com o nome "${nome_sala}" e tipo "${tipo_sala}"`,
                sala_existente: {
                    id_sala: salaExistente.rows[0].id_sala,
                    nome_sala: salaExistente.rows[0].nome_sala,
                    tipo_sala: salaExistente.rows[0].tipo_sala
                }
            });
        }

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
                    INSERT INTO lugares (id_lugar, id_sala, codigo_lugar, fileira, numero, estado_permanente, estado_compra, codigo)
                    VALUES ($1, $2, $3, $4, $5, 'activo', 'livre', $6)
                `;
                
                await conexao.query(insertLugarQuery, [
                    id_lugar,
                    id_sala,
                    codigo_lugar,
                    letraFileira,
                    numero,
                    codigo_unico
                ]);
                
                lugaresGerados.push({
                    id_lugar,
                    codigo_lugar,
                    fileira: letraFileira,
                    numero,
                    estado_permanente: 'activo',
                    estado_compra: 'livre',
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

/**
 * @swagger
 * /sessoes:
 *   post:
 *     summary: Cria uma nova sessão de cinema
 *     description: Registra uma nova sessão com filme, sala, horários e preço. Não permite conflitos de horário na mesma sala e exige intervalo mínimo de 15 minutos entre sessões.
 *     tags: [Sessões]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id_filme
 *               - id_sala
 *               - data_hora_inicio
 *               - data_hora_fim
 *               - tipo_sessao
 *               - preco
 *               - estado_sessao
 *               - criado_por
 *             properties:
 *               id_filme:
 *                 type: string
 *                 format: uuid
 *                 description: UUID do filme
 *                 example: "0729f7e0-e31e-4c61-91cd-5809d05419eb"
 *               id_sala:
 *                 type: string
 *                 format: uuid
 *                 description: UUID da sala
 *                 example: "a3b8c9d1-2e4f-4a5b-8c6d-7e9f1a2b3c4d"
 *               data_hora_inicio:
 *                 type: string
 *                 format: date-time
 *                 description: Data e hora de início da sessão (ISO 8601)
 *                 example: "2024-12-25T14:00:00Z"
 *               data_hora_fim:
 *                 type: string
 *                 format: date-time
 *                 description: Data e hora de fim da sessão (ISO 8601)
 *                 example: "2024-12-25T16:30:00Z"
 *               tipo_sessao:
 *                 type: string
 *                 enum: [2D, 3D, IMAX, 4DX, D-BOX]
 *                 description: Tipo de sessão
 *                 example: "2D"
 *               preco:
 *                 type: number
 *                 format: float
 *                 minimum: 0
 *                 description: Preço do ingresso
 *                 example: 24.90
 *               estado_sessao:
 *                 type: string
 *                 enum: [agendada, em_andamento, concluida, cancelada]
 *                 description: Estado atual da sessão
 *                 example: "agendada"
 *               criado_por:
 *                 type: string
 *                 format: uuid
 *                 description: UUID do funcionário que criou a sessão
 *                 example: "f47ac10b-58cc-4372-a567-0e02b2c3d479"
 *               observacoes:
 *                 type: string
 *                 description: Observações adicionais sobre a sessão
 *                 maxLength: 500
 *                 nullable: true
 *                 example: "Sessão especial de Natal"
 *     responses:
 *       201:
 *         description: Sessão criada com sucesso
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Não autorizado
 *       409:
 *         description: Conflito de horário - Sala já ocupada ou intervalo insuficiente
 *       500:
 *         description: Erro interno
 */

router.post('/sessoes',verificarToken, async (req, res) => {
    const {
        id_filme, 
        id_sala,
        data_hora_inicio,
        data_hora_fim,
        tipo_sessao,
        preco,
        estado_sessao,
        criado_por,
        observacoes
    } = req.body;
    
    const id_sessao = uuidv4();

    // Validação de campos obrigatórios
    if (!id_filme || !id_sala || !data_hora_inicio || !data_hora_fim || 
        !tipo_sessao || !preco || !estado_sessao || !criado_por) {
        return res.status(400).json({
            sucesso: false,
            mensagem: "Preencha todos os campos obrigatórios"
        });
    }

    const inicio = new Date(data_hora_inicio);
    const fim = new Date(data_hora_fim);

    // Validação de horário
    if (inicio >= fim) {
        return res.status(400).json({
            sucesso: false,
            mensagem: "Data/hora de início deve ser anterior à data/hora de fim"
        });
    }

    // Validação de preço
    if (preco <= 0) {
        return res.status(400).json({
            sucesso: false,
            mensagem: "O preço deve ser maior que zero"
        });
    }

    try {
        // Verificar conflitos de horário na mesma sala
        const verificarConflitoQuery = `
            SELECT id_sessao, data_hora_inicio, data_hora_fim
            FROM sessoes 
            WHERE id_sala = $1 
            AND estado_sessao NOT IN ('cancelada')
            AND (
                (data_hora_inicio <= $2 AND data_hora_fim >= $2) OR -- Sessão existente começa antes e termina depois do início da nova
                (data_hora_inicio <= $3 AND data_hora_fim >= $3) OR -- Sessão existente começa antes e termina depois do fim da nova
                (data_hora_inicio >= $2 AND data_hora_fim <= $3) OR -- Sessão existente está dentro do novo horário
                (data_hora_inicio BETWEEN $2 AND $3) OR -- Início da sessão existente dentro do novo horário
                (data_hora_fim BETWEEN $2 AND $3) -- Fim da sessão existente dentro do novo horário
            )
            ORDER BY data_hora_inicio
        `;

        const conflitos = await conexao.query(verificarConflitoQuery, [id_sala, inicio, fim]);

        if (conflitos.rows.length > 0) {
            // Verificar se há conflito com intervalo de 15 minutos
            let mensagemConflito = "Conflito de horário. ";
            
            for (const conflito of conflitos.rows) {
                const conflitoInicio = new Date(conflito.data_hora_inicio);
                const conflitoFim = new Date(conflito.data_hora_fim);
                
                // Verificar se o conflito é sobreposição direta
                if ((inicio < conflitoFim && fim > conflitoInicio)) {
                    mensagemConflito = `Já existe uma sessão agendada para esta sala no período de ${conflitoInicio.toLocaleString()} até ${conflitoFim.toLocaleString()}`;
                    return res.status(409).json({
                        sucesso: false,
                        mensagem: mensagemConflito,
                        conflito: {
                            id_sessao: conflito.id_sessao,
                            data_hora_inicio: conflitoInicio,
                            data_hora_fim: conflitoFim
                        }
                    });
                }
            }
        }

        // Verificar intervalo mínimo de 15 minutos após o fim da última sessão
        const verificarIntervaloQuery = `
            SELECT id_sessao, data_hora_inicio, data_hora_fim
            FROM sessoes 
            WHERE id_sala = $1 
            AND estado_sessao NOT IN ('cancelada')
            AND data_hora_fim <= $2
            ORDER BY data_hora_fim DESC
            LIMIT 1
        `;

        const ultimaSessao = await conexao.query(verificarIntervaloQuery, [id_sala, inicio]);

        if (ultimaSessao.rows.length > 0) {
            const fimUltimaSessao = new Date(ultimaSessao.rows[0].data_hora_fim);
            const intervaloMinimo = new Date(fimUltimaSessao.getTime() + 15 * 60000); // 15 minutos
            
            if (inicio < intervaloMinimo) {
                const tempoNecessario = Math.ceil((intervaloMinimo - inicio) / 60000);
                return res.status(409).json({
                    sucesso: false,
                    mensagem: `É necessário aguardar 15 minutos entre sessões. Próximo horário disponível: ${intervaloMinimo.toLocaleString()}`,
                    ultima_sessao: {
                        id_sessao: ultimaSessao.rows[0].id_sessao,
                        data_hora_fim: fimUltimaSessao.toLocaleString()
                    },
                    proximo_horario_disponivel: intervaloMinimo.toLocaleString(),
                    minutos_necessarios: tempoNecessario
                });
            }
        }

        // Verificar se há sessão programada para começar muito cedo (intervalo de 15 minutos antes)
        const verificarProximaSessaoQuery = `
            SELECT id_sessao, data_hora_inicio, data_hora_fim
            FROM sessoes 
            WHERE id_sala = $1 
            AND estado_sessao NOT IN ('cancelada')
            AND data_hora_inicio >= $2
            ORDER BY data_hora_inicio ASC
            LIMIT 1
        `;

        const proximaSessao = await conexao.query(verificarProximaSessaoQuery, [id_sala, fim]);

        if (proximaSessao.rows.length > 0) {
            const inicioProximaSessao = new Date(proximaSessao.rows[0].data_hora_inicio);
            const fimAtualComIntervalo = new Date(fim.getTime() + 15 * 60000);
            
            if (inicioProximaSessao < fimAtualComIntervalo) {
                return res.status(409).json({
                    sucesso: false,
                    mensagem: `A próxima sessão começa muito cedo. É necessário intervalo de 15 minutos entre sessões.`,
                    proxima_sessao: {
                        id_sessao: proximaSessao.rows[0].id_sessao,
                        data_hora_inicio: inicioProximaSessao.toLocaleString()
                    },
                    horario_minimo_proxima_sessao: fimAtualComIntervalo.toLocaleString()
                });
            }
        }

        // Se passou por todas as verificações, criar a sessão
        const sqlInsert = `
            INSERT INTO sessoes (
                id_sessao, 
                id_filme, 
                id_sala, 
                data_hora_inicio, 
                data_hora_fim, 
                tipo_sessao, 
                preco, 
                estado_sessao, 
                criado_por, 
                observacoes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `;

        await conexao.query(sqlInsert, [
            id_sessao,
            id_filme,
            id_sala,
            inicio,
            fim,
            tipo_sessao,
            preco,
            estado_sessao,
            criado_por,
            observacoes || null
        ]);

        res.status(201).json({
            sucesso: true,
            mensagem: "Sessão criada com sucesso",
            sessao: { 
                id_sessao, 
                id_filme, 
                id_sala, 
                data_hora_inicio: inicio, 
                data_hora_fim: fim, 
                tipo_sessao, 
                preco, 
                estado_sessao, 
                criado_por, 
                observacoes 
            }
        });

    } catch (err) {
        console.error('Erro ao criar sessão:', err);
        res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao criar sessão",
            erro: err.message
        });
    }
});

/**
 * @swagger
 * /compras:
 *   post:
 *     summary: Cria uma nova compra com bilhetes e lugares
 *     description: Registra uma compra, os bilhetes e os lugares associados em uma única transação. Após a compra, os lugares ficam com estado_compra='ocupado'
 *     tags: [Compras]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id_cliente
 *               - forma_pagamento
 *               - bilhetes
 *             properties:
 *               id_cliente:
 *                 type: string
 *                 format: uuid
 *                 description: UUID do cliente (utilizador)
 *                 example: "f47ac10b-58cc-4372-a567-0e02b2c3d479"
 *               forma_pagamento:
 *                 type: string
 *                 enum: [multicaixa, dinheiro, cartao_credito, cartao_debito, pix_angola]
 *                 description: Forma de pagamento
 *                 example: "multicaixa"
 *               bilhetes:
 *                 type: array
 *                 description: Lista de bilhetes a serem comprados
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required:
 *                     - id_sessao
 *                     - tipo_bilhete
 *                     - preco_pago
 *                     - id_lugares
 *                   properties:
 *                     id_sessao:
 *                       type: string
 *                       format: uuid
 *                       description: UUID da sessão
 *                       example: "123e4567-e89b-12d3-a456-426614174000"
 *                     tipo_bilhete:
 *                       type: string
 *                       enum: [inteiro, meio, vip, acessivel]
 *                       description: Tipo do bilhete
 *                       example: "vip"
 *                     preco_pago:
 *                       type: number
 *                       format: float
 *                       minimum: 0
 *                       description: Preço pago pelo bilhete
 *                       example: 49.90
 *                     id_lugares:
 *                       type: array
 *                       description: IDs dos lugares ocupados por este bilhete
 *                       minItems: 1
 *                       items:
 *                         type: string
 *                         format: uuid
 *                         example: "lugar-uuid-123"
 *     responses:
 *       201:
 *         description: Compra criada com sucesso
 *       400:
 *         description: Requisição inválida
 *       401:
 *         description: Não autorizado
 *       409:
 *         description: Conflito - Lugares ocupados
 *       500:
 *         description: Erro interno do servidor
 */

router.post('/compras',verificarToken, async (req, res) => {
    const { id_cliente, forma_pagamento, bilhetes } = req.body;
    
    // Validações básicas
    if (!id_cliente || !forma_pagamento || !bilhetes || bilhetes.length === 0) {
        return res.status(400).json({
            sucesso: false,
            mensagem: "Preencha todos os campos obrigatórios: id_cliente, forma_pagamento, bilhetes"
        });
    }

    // Validar forma de pagamento
    const formasValidas = ['multicaixa', 'dinheiro', 'cartao_credito', 'cartao_debito', 'pix_angola'];
    if (!formasValidas.includes(forma_pagamento)) {
        return res.status(400).json({
            sucesso: false,
            mensagem: "Forma de pagamento inválida. Opções: multicaixa, dinheiro, cartao_credito, cartao_debito, pix_angola"
        });
    }

    // Calcular valor total
    let valorTotal = 0;
    for (const bilhete of bilhetes) {
        if (!bilhete.preco_pago || bilhete.preco_pago <= 0) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Preço do bilhete inválido"
            });
        }
        valorTotal += bilhete.preco_pago;
    }

    try {
        // Verificar se os lugares estão disponíveis
        for (const bilhete of bilhetes) {
            const { id_sessao, id_lugares } = bilhete;
            
            if (!id_sessao || !id_lugares || id_lugares.length === 0) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: "Cada bilhete deve ter id_sessao e pelo menos um id_lugar"
                });
            }

            // Verificar lugares duplicados na mesma compra
            const todosLugares = bilhetes.flatMap(b => b.id_lugares);
            const lugaresUnicos = new Set(todosLugares);
            if (todosLugares.length !== lugaresUnicos.size) {
                return res.status(400).json({
                    sucesso: false,
                    mensagem: "Existem lugares duplicados na compra"
                });
            }

            // Verificar se lugares já estão ocupados (estado_compra = 'ocupado')
            const lugaresOcupadosQuery = `
                SELECT id_lugar, estado_compra
                FROM lugares 
                WHERE id_lugar = ANY($1) AND estado_compra = 'ocupado'
            `;
            
            const lugaresOcupados = await conexao.query(lugaresOcupadosQuery, [id_lugares]);
            
            if (lugaresOcupados.rows.length > 0) {
                return res.status(409).json({
                    sucesso: false,
                    mensagem: `Os seguintes lugares já estão ocupados: ${lugaresOcupados.rows.map(l => l.id_lugar).join(', ')}`
                });
            }

            // Verificar se lugares estão permanentemente inativos ou em manutenção
            const lugaresIndisponiveisQuery = `
                SELECT id_lugar, estado_permanente
                FROM lugares 
                WHERE id_lugar = ANY($1) AND estado_permanente IN ('inactivo', 'manutencao')
            `;
            
            const lugaresIndisponiveis = await conexao.query(lugaresIndisponiveisQuery, [id_lugares]);
            
            if (lugaresIndisponiveis.rows.length > 0) {
                return res.status(409).json({
                    sucesso: false,
                    mensagem: `Os seguintes lugares estão permanentemente indisponíveis: ${lugaresIndisponiveis.rows.map(l => l.id_lugar).join(', ')}`
                });
            }
        }

        // Gerar número da fatura
        const numeroFactura = gerarCodigo();
        const id_compra = gerarId();
        const dataAtual = new Date();

        // Iniciar transação
        await conexao.query('BEGIN');

        try {
            // 1. Inserir na tabela compras
            const insertCompraQuery = `
                INSERT INTO compras (
                    id_compra, 
                    id_cliente, 
                    valor_total, 
                    forma_pagamento, 
                    estado_pagamento, 
                    numero_factura,
                    data_compra
                ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            `;

            await conexao.query(insertCompraQuery, [
                id_compra,
                id_cliente,
                valorTotal,
                forma_pagamento,
                'aprovado',
                numeroFactura,
                dataAtual
            ]);

            // 2. Inserir bilhetes e associar lugares
            const bilhetesCriados = [];
            const todosLugaresParaAtualizar = [];
            
            for (const bilhete of bilhetes) {
                const id_bilhete = gerarId();
                
                const insertBilheteQuery = `
                    INSERT INTO bilhetes (
                        id_bilhete,
                        id_compra,
                        id_sessao,
                        preco_pago,
                        tipo_bilhete,
                        estado_uso
                    ) VALUES ($1, $2, $3, $4, $5, $6)
                `;

                await conexao.query(insertBilheteQuery, [
                    id_bilhete,
                    id_compra,
                    bilhete.id_sessao,
                    bilhete.preco_pago,
                    bilhete.tipo_bilhete,
                    'activo'
                ]);

                // 3. Associar lugares ao bilhete
                for (const id_lugar of bilhete.id_lugares) {
                    const insertBilheteLugarQuery = `
                        INSERT INTO bilhetes_lugares (
                            id_bilhete,
                            id_lugar
                        ) VALUES ($1, $2)
                    `;

                    await conexao.query(insertBilheteLugarQuery, [id_bilhete, id_lugar]);
                    
                    // Guardar lugares para atualizar estado_compra
                    todosLugaresParaAtualizar.push(id_lugar);
                }

                bilhetesCriados.push({
                    id_bilhete,
                    tipo_bilhete: bilhete.tipo_bilhete,
                    preco_pago: bilhete.preco_pago,
                    lugares: bilhete.id_lugares
                });
            }

            // 4. Atualizar o estado_compra dos lugares para 'ocupado'
            if (todosLugaresParaAtualizar.length > 0) {
                const updateLugaresQuery = `
                    UPDATE lugares 
                    SET estado_compra = 'ocupado'
                    WHERE id_lugar = ANY($1)
                    RETURNING id_lugar, codigo_lugar, estado_compra
                `;
                
                const lugaresAtualizados = await conexao.query(updateLugaresQuery, [todosLugaresParaAtualizar]);
                
                console.log(`Lugares atualizados para ocupado: ${lugaresAtualizados.rows.length}`);
            }

            // Commit da transação
            await conexao.query('COMMIT');

            // Retornar sucesso
            res.status(201).json({
                sucesso: true,
                mensagem: "Compra realizada com sucesso",
                dados: {
                    id_compra,
                    numero_factura,
                    valor_total: valorTotal,
                    data_compra: dataAtual,
                    forma_pagamento,
                    bilhetes: bilhetesCriados,
                    lugares_atualizados: todosLugaresParaAtualizar.length
                }
            });

        } catch (error) {
            // Rollback em caso de erro
            await conexao.query('ROLLBACK');
            
            console.error('Erro ao criar compra:', error);
            
            // Verificar se é erro de chave duplicada (numero_factura)
            if (error.code === '23505' || error.constraint === 'compras_numero_factura_key') {
                return res.status(409).json({
                    sucesso: false,
                    mensagem: "Erro ao gerar número da fatura. Tente novamente."
                });
            }
            
            res.status(500).json({
                sucesso: false,
                mensagem: "Erro ao processar compra",
                erro: error.message
            });
        }
        
    } catch (err) {
        console.error('Erro na validação:', err);
        res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao validar compra",
            erro: err.message
        });
    }
});

module.exports = router;