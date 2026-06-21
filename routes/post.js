const express = require("express");
const router = express.Router();
const conexao = require("../infra/conexao");
const { criptografarSenha, gerarSenhaParaEmail, gerarCodigo,gerarId,gerarSugestoes,gerarMapaVisual } = require("../utils/senha");
const { enviarSenhaAcesso } = require("../utils/email");
const {verificarToken} = require("../middleware/authMiddleware");
const { v4: uuidv4 } = require("uuid");
const QRCode = require('qrcode');

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
 *                 enum: [ATIVA, INATIVA, MANUTENCAO, operacional]
 *                 description: Estado da sala
 *                 example: operacional
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
 *                       example: "operacional"
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
 *                         example: "activo"
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
router.post('/salas', async (req, res) => {
    const {
        nome_sala,
        capacidade_total,
        tipo_sala = 'NORMAL',
        estado_sala = 'operacional',
        coluna = 10,
        fila
    } = req.body;

    // --- VALIDAÇÕES BÁSICAS ---
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

    // --- CALCULAR CONFIGURAÇÃO ---
    const lugaresPorFila = coluna;
    let totalFilas;
    let totalPosicoes;

    if (fila && fila > 0) {
        totalFilas = fila;
        totalPosicoes = totalFilas * lugaresPorFila;
        
        if (capacidade_total > totalPosicoes) {
            const sugestoes = gerarSugestoes(capacidade_total, coluna, fila);
            
            return res.status(400).json({
                sucesso: false,
                mensagem: `Capacidade total (${capacidade_total}) excede o total de posições (${totalPosicoes}) com ${totalFilas} filas e ${lugaresPorFila} colunas`,
                sugestoes: sugestoes
            });
        }
    } else {
        totalFilas = Math.ceil(capacidade_total / lugaresPorFila);
        totalPosicoes = totalFilas * lugaresPorFila;
    }

    const id_sala = uuidv4();

    try {
        // --- VERIFICAR SE SALA JÁ EXISTE ---
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

        // --- INICIAR TRANSAÇÃO ---
        await conexao.query('BEGIN');

        // --- INSERIR SALA ---
        const insertSalaQuery = `
            INSERT INTO salas (id_sala, nome_sala, capacidade_total, tipo_sala, estado_sala, coluna, fila)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *
        `;

        const salaResult = await conexao.query(insertSalaQuery, [
            id_sala,
            nome_sala.trim(),
            capacidade_total,
            tipo_sala,
            estado_sala,
            lugaresPorFila,
            totalFilas
        ]);

        // --- GERAR LUGARES ---
        const fileiras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
        let lugaresInseridos = 0;
        const lugaresGerados = [];
        const lugaresOrganizados = [];

        for (let filaIndex = 0; filaIndex < totalFilas && lugaresInseridos < capacidade_total; filaIndex++) {
            const letraFileira = fileiras[filaIndex % fileiras.length];
            const linha = [];
            let linhaTemAtivos = false;

            const lugaresRestantes = capacidade_total - lugaresInseridos;
            const lugaresNaFila = Math.min(lugaresPorFila, lugaresRestantes);

            for (let numero = 1; numero <= lugaresNaFila; numero++) {
                const codigo_lugar = `${letraFileira}${numero}`;
                const id_lugar = uuidv4();
                const codigo_unico = gerarCodigo();
                
                const insertLugarQuery = `
                    INSERT INTO lugares (id_lugar, id_sala, codigo_lugar, fileira, numero, estado_permanente, codigo)
                    VALUES ($1, $2, $3, $4, $5, 'activo', $6)
                    RETURNING *
                `;
                
                const lugarResult = await conexao.query(insertLugarQuery, [
                    id_lugar,
                    id_sala,
                    codigo_lugar,
                    letraFileira,
                    numero,
                    codigo_unico
                ]);
                
                const lugarObj = {
                    id_lugar: lugarResult.rows[0].id_lugar,
                    codigo_lugar: lugarResult.rows[0].codigo_lugar,
                    fileira: lugarResult.rows[0].fileira,
                    numero: lugarResult.rows[0].numero,
                    estado_permanente: lugarResult.rows[0].estado_permanente,
                    estado_compra: lugarResult.rows[0].estado_compra,
                    codigo: lugarResult.rows[0].codigo,
                    ativo: true
                };

                lugaresGerados.push(lugarObj);
                linha.push(lugarObj);
                linhaTemAtivos = true;
                lugaresInseridos++;
            }

            if (linhaTemAtivos) {
                for (let c = linha.length; c < lugaresPorFila; c++) {
                    const codigoLugar = `${letraFileira}${c + 1}`;
                    linha.push({
                        codigo_lugar: codigoLugar,
                        fileira: letraFileira,
                        numero: c + 1,
                        ativo: false,
                        id_lugar: null,
                        estado_permanente: null,
                        estado_compra: null
                    });
                }

                lugaresOrganizados.push({
                    fila: letraFileira,
                    lugares: linha,
                    total_ativos: linha.filter(l => l.ativo).length,
                    total_vazios: linha.filter(l => !l.ativo).length
                });
            }
        }

        for (let f = lugaresOrganizados.length; f < totalFilas; f++) {
            const letraFileira = fileiras[f % fileiras.length];
            const linha = [];
            
            for (let c = 0; c < lugaresPorFila; c++) {
                const codigoLugar = `${letraFileira}${c + 1}`;
                linha.push({
                    codigo_lugar: codigoLugar,
                    fileira: letraFileira,
                    numero: c + 1,
                    ativo: false,
                    id_lugar: null,
                    estado_permanente: null,
                    estado_compra: null
                });
            }

            lugaresOrganizados.push({
                fila: letraFileira,
                lugares: linha,
                total_ativos: 0,
                total_vazios: lugaresPorFila
            });
        }

        if (lugaresInseridos !== capacidade_total) {
            const updateCapacidadeQuery = `
                UPDATE salas 
                SET capacidade_total = $1 
                WHERE id_sala = $2
            `;
            await conexao.query(updateCapacidadeQuery, [lugaresInseridos, id_sala]);
        }

        await conexao.query('COMMIT');

        const selectSalaQuery = `
            SELECT id_sala, nome_sala, capacidade_total, tipo_sala, estado_sala, coluna, fila 
            FROM salas 
            WHERE id_sala = $1
        `;
        const salaCriada = await conexao.query(selectSalaQuery, [id_sala]);

        const mapaVisual = gerarMapaVisual(lugaresOrganizados, lugaresPorFila);

        const lugaresVazios = totalPosicoes - lugaresInseridos;
        const porcentagemOcupacao = Math.round((lugaresInseridos / totalPosicoes) * 100);

        res.status(201).json({
            sucesso: true,
            mensagem: `Sala criada com ${lugaresInseridos} lugares com sucesso`,
            sala: salaCriada.rows[0],
            lugares_criados: lugaresInseridos,
            configuracao: {
                colunas: lugaresPorFila,
                filas: totalFilas,
                total_posicoes: totalPosicoes,
                lugares_ocupados: lugaresInseridos,
                lugares_vazios: lugaresVazios,
                capacidade_solicitada: capacidade_total,
                porcentagem_ocupacao: `${porcentagemOcupacao}%`
            },
            estatisticas: {
                total_lugares: lugaresInseridos,
                lugares_ativos: lugaresInseridos,
                lugares_inativos: lugaresVazios,
                filas_completas: Math.floor(lugaresInseridos / lugaresPorFila),
                filas_parciais: lugaresInseridos % lugaresPorFila > 0 ? 1 : 0,
                ultima_fila_lugares: lugaresInseridos % lugaresPorFila || lugaresPorFila,
                lugares_por_fila: lugaresOrganizados.map(f => ({
                    fila: f.fila,
                    ativos: f.total_ativos,
                    vazios: f.total_vazios
                }))
            },
            lugares: lugaresOrganizados,
            mapa_visual: mapaVisual,
            exemplos_lugares: lugaresGerados.slice(0, 5)
        });

    } catch (err) {
        await conexao.query('ROLLBACK');
        
        console.error('Erro ao criar sala:', err);
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

router.post('/sessoes', async (req, res) => {
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
        console.log('Erro de validação: Campos obrigatórios faltando', {
            id_filme, id_sala, data_hora_inicio, data_hora_fim, 
            tipo_sessao, preco, estado_sessao, criado_por
        });
        return res.status(400).json({
            sucesso: false,
            mensagem: "Preencha todos os campos obrigatórios"
        });
    }

    const inicio = new Date(data_hora_inicio);
    const fim = new Date(data_hora_fim);

    // Validação de horário
    if (inicio >= fim) {
        console.log('Erro de validação: Data/hora inválida', { inicio, fim });
        return res.status(400).json({
            sucesso: false,
            mensagem: "Data/hora de início deve ser anterior à data/hora de fim"
        });
    }

    // Validação de preço
    if (preco <= 0) {
        console.log('Erro de validação: Preço inválido', { preco });
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
                (data_hora_inicio <= $2 AND data_hora_fim >= $2) OR
                (data_hora_inicio <= $3 AND data_hora_fim >= $3) OR
                (data_hora_inicio >= $2 AND data_hora_fim <= $3) OR
                (data_hora_inicio BETWEEN $2 AND $3) OR
                (data_hora_fim BETWEEN $2 AND $3)
            )
            ORDER BY data_hora_inicio
        `;

        const conflitos = await conexao.query(verificarConflitoQuery, [id_sala, inicio, fim]);

        if (conflitos.rows.length > 0) {
            let mensagemConflito = "Conflito de horário. ";
            
            for (const conflito of conflitos.rows) {
                const conflitoInicio = new Date(conflito.data_hora_inicio);
                const conflitoFim = new Date(conflito.data_hora_fim);
                
                if ((inicio < conflitoFim && fim > conflitoInicio)) {
                    mensagemConflito = `Já existe uma sessão agendada para esta sala no período de ${conflitoInicio.toLocaleString()} até ${conflitoFim.toLocaleString()}`;
                    console.log('Erro de conflito: Sessão existente', {
                        id_sessao: conflito.id_sessao,
                        conflitoInicio,
                        conflitoFim,
                        novaSessaoInicio: inicio,
                        novaSessaoFim: fim
                    });
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
            const intervaloMinimo = new Date(fimUltimaSessao.getTime() + 15 * 60000);
            
            if (inicio < intervaloMinimo) {
                const tempoNecessario = Math.ceil((intervaloMinimo - inicio) / 60000);
                console.log('Erro de intervalo: Tempo insuficiente entre sessões', {
                    ultimaSessaoId: ultimaSessao.rows[0].id_sessao,
                    fimUltimaSessao,
                    inicioNovaSessao: inicio,
                    intervaloMinimo,
                    tempoNecessario
                });
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

        // Verificar se há sessão programada para começar muito cedo
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
                console.log('Erro de intervalo: Próxima sessão muito cedo', {
                    proximaSessaoId: proximaSessao.rows[0].id_sessao,
                    inicioProximaSessao,
                    fimAtualComIntervalo,
                    fimSessaoAtual: fim
                });
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

        // Criar a sessão
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
        console.error('Erro detalhado ao criar sessão:', {
            message: err.message,
            code: err.code,
            constraint: err.constraint,
            detail: err.detail,
            where: err.where,
            table: err.table,
            routine: err.routine,
            stack: err.stack
        });
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
 *     summary: Registra uma nova compra de bilhetes
 *     description: |
 *       Cria uma nova compra com os lugares selecionados para uma sessão.
 *       
 *       **Regras de negócio:**
 *       - Sessão deve existir e não estar cancelada
 *       - Sessão não pode ter iniciado
 *       - Lugares devem existir e pertencer à sala da sessão
 *       - Lugares não podem estar ocupados (status 'reservado' ou 'ocupado')
 *       - Mínimo de 1 lugar por compra
 *       - Gera número de factura automático
 *       - Gera QR Code para identificação da compra
 *     tags: [Compras]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - id_cliente
 *               - forma_pagamento
 *               - sessao_id
 *               - lugares
 *             properties:
 *               id_cliente:
 *                 type: string
 *                 description: ID do cliente
 *                 example: "cliente_001"
 *               forma_pagamento:
 *                 type: string
 *                 enum: [cartao_credito, cartao_debito, dinheiro, pix, multicaixa]
 *                 description: Forma de pagamento
 *                 example: "multicaixa"
 *               sessao_id:
 *                 type: string
 *                 format: uuid
 *                 description: UUID da sessão
 *                 example: "dcad0787-7de1-483e-b64b-aea3b3a87256"
 *               lugares:
 *                 type: array
 *                 description: Lista de lugares selecionados
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required:
 *                     - id_lugar
 *                   properties:
 *                     id_lugar:
 *                       type: string
 *                       description: ID do lugar
 *                       example: "1"
 *     responses:
 *       201:
 *         description: Compra realizada com sucesso
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
 *                   example: "Compra realizada com sucesso"
 *                 compra:
 *                   type: object
 *                   properties:
 *                     id_compra:
 *                       type: string
 *                       format: uuid
 *                       example: "550e8400-e29b-41d4-a716-446655440001"
 *                     id_cliente:
 *                       type: string
 *                       example: "cliente_001"
 *                     data_compra:
 *                       type: string
 *                       format: date-time
 *                       example: "2026-06-19T14:30:00.000Z"
 *                     valor_total:
 *                       type: number
 *                       format: float
 *                       example: 45.50
 *                     forma_pagamento:
 *                       type: string
 *                       example: "multicaixa"
 *                     estado_pagamento:
 *                       type: string
 *                       enum: [pendente, pago, cancelado]
 *                       example: "pendente"
 *                     numero_factura:
 *                       type: string
 *                       example: "FACT-20260619-0001"
 *                     qr_code:
 *                       type: string
 *                       example: "eyJpZF9jb21wcmEiOiI1NTBlODQwMC1lMjliLTQxZDQtYTcxNi00NDY2NTU0NDAwMDEifQ=="
 *                     lugares_ocupados:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id_lo:
 *                             type: string
 *                             example: "1"
 *                           id_lugar:
 *                             type: string
 *                             example: "1"
 *                           id_sala:
 *                             type: string
 *                             example: "1"
 *                           id_compra:
 *                             type: string
 *                             format: uuid
 *                             example: "550e8400-e29b-41d4-a716-446655440001"
 *                           id_sessao:
 *                             type: string
 *                             format: uuid
 *                             example: "dcad0787-7de1-483e-b64b-aea3b3a87256"
 *                           status:
 *                             type: string
 *                             enum: [reservado, ocupado, cancelado]
 *                             example: "reservado"
 *       400:
 *         description: Dados inválidos na requisição
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
 *                   example: "Preencha todos os campos obrigatórios e selecione pelo menos um lugar"
 *                 erro:
 *                   type: string
 *                   example: "Detalhes do erro"
 *       404:
 *         description: Sessão ou lugares não encontrados
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
 *                   example: "Sessão não encontrada ou já foi cancelada"
 *                 lugares_nao_encontrados:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["5", "6"]
 *       409:
 *         description: Conflito - lugares já ocupados ou sessão indisponível
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
 *                   example: "Os lugares 1, 3 já estão ocupados para esta sessão"
 *                 lugares_ocupados:
 *                   type: array
 *                   items:
 *                     type: string
 *                   example: ["1", "3"]
 *                 detalhes:
 *                   type: object
 *                   properties:
 *                     inicio_sessao:
 *                       type: string
 *                       format: date-time
 *                       example: "2026-06-19T15:00:00.000Z"
 *                     agora:
 *                       type: string
 *                       format: date-time
 *                       example: "2026-06-19T15:30:00.000Z"
 *       500:
 *         description: Erro interno do servidor
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
 *                   example: "Erro ao processar compra"
 *                 erro:
 *                   type: string
 *                   example: "Database connection error"
 */

router.post('/compras', async (req, res) => {
    const {
        id_cliente,
        forma_pagamento,
        sessao_id,
        lugares
    } = req.body;

    const id_compra = uuidv4();

    // Validação de campos obrigatórios
    if (!id_cliente || !forma_pagamento || !sessao_id || !lugares || lugares.length === 0) {
        console.log('Erro de validação: Campos obrigatórios faltando', {
            id_cliente,
            forma_pagamento,
            sessao_id,
            lugares
        });
        return res.status(400).json({
            sucesso: false,
            mensagem: "Preencha todos os campos obrigatórios e selecione pelo menos um lugar"
        });
    }

    // Validação de forma de pagamento
    const formasPermitidas = ['cartao_credito', 'cartao_debito', 'dinheiro', 'pix', 'multicaixa'];

    if (!formasPermitidas.includes(forma_pagamento)) {
        console.log('Erro de validação: Forma de pagamento inválida', { forma_pagamento });
        return res.status(400).json({
            sucesso: false,
            mensagem: "Forma de pagamento inválida. Opções: cartao_credito, cartao_debito, dinheiro, pix, multicaixa"
        });
    }

    try {
        await conexao.query('BEGIN');
        
        // Configurar timeouts para evitar deadlocks
        await conexao.query('SET LOCAL lock_timeout = 5000');
        await conexao.query('SET LOCAL statement_timeout = 10000');

        // 1. Verificar se a sessão existe e obter dados
        const sessaoQuery = `
            SELECT id_sessao, id_sala, preco, data_hora_inicio, data_hora_fim
            FROM sessoes 
            WHERE id_sessao = $1 
            AND estado_sessao NOT IN ('cancelada')
        `;

        const sessaoResult = await conexao.query(sessaoQuery, [sessao_id]);

        if (sessaoResult.rows.length === 0) {
            console.log('Erro: Sessão não encontrada ou cancelada', { sessao_id });
            await conexao.query('ROLLBACK');
            return res.status(404).json({
                sucesso: false,
                mensagem: "Sessão não encontrada ou já foi cancelada"
            });
        }

        const sessao = sessaoResult.rows[0];
        const { id_sala, preco, data_hora_inicio } = sessao;

        // Verificar se a sessão já passou
        const agora = new Date();
        const inicioSessao = new Date(data_hora_inicio);
        
        if (agora >= inicioSessao) {
            console.log('Erro: Sessão já iniciada ou encerrada', { 
                agora, 
                inicioSessao 
            });
            await conexao.query('ROLLBACK');
            return res.status(409).json({
                sucesso: false,
                mensagem: "Não é possível comprar ingressos para uma sessão que já iniciou"
            });
        }

        // 2. Validar lugares e verificar se pertencem à sala
        const lugarIds = lugares.map(l => l.id_lugar);
        const lugaresQuery = `
            SELECT id_lugar, id_sala, estado_permanente, codigo_lugar
            FROM lugares 
            WHERE id_lugar = ANY($1::text[]) 
            AND id_sala = $2
            AND estado_permanente = 'activo'
        `;

        const lugaresResult = await conexao.query(lugaresQuery, [lugarIds, id_sala]);

        if (lugaresResult.rows.length !== lugares.length) {
            const encontrados = lugaresResult.rows.map(r => r.id_lugar);
            const faltantes = lugarIds.filter(id => !encontrados.includes(id));
            
            console.log('Erro: Lugares não encontrados ou não pertencem à sala', {
                lugaresSolicitados: lugarIds,
                lugaresEncontrados: encontrados,
                lugaresFaltantes: faltantes,
                id_sala
            });
            await conexao.query('ROLLBACK');
            return res.status(404).json({
                sucesso: false,
                mensagem: `Um ou mais lugares não existem, estão inativos ou não pertencem à sala da sessão`,
                lugares_faltantes: faltantes
            });
        }

        // 3. Limpar reservas pendentes expiradas (15 minutos)
        const limparPendentesQuery = `
            DELETE FROM lugares_ocupados 
            WHERE id_sessao = $1 
            AND id_lugar = ANY($2::text[]) 
            AND status = 'pendente' 
            AND data_reserva <= NOW() - INTERVAL '15 minutes'
            RETURNING id_lugar
        `;

        const limparPendentesResult = await conexao.query(
            limparPendentesQuery, 
            [sessao_id, lugarIds]
        );

        if (limparPendentesResult.rows.length > 0) {
            console.log('Reservas pendentes expiradas removidas:', 
                limparPendentesResult.rows.map(r => r.id_lugar)
            );
        }

        // 4. Verificar disponibilidade completa dos lugares
        const disponibilidadeQuery = `
            SELECT 
                l.id_lugar,
                l.codigo_lugar,
                lo.status,
                lo.data_reserva,
                lo.id_compra,
                CASE 
                    WHEN lo.id_lugar IS NULL THEN 'disponivel'
                    WHEN lo.status = 'pendente' AND lo.data_reserva <= NOW() - INTERVAL '15 minutes' THEN 'expirado'
                    WHEN lo.status IN ('reservado', 'ocupado') THEN 'ocupado'
                    WHEN lo.status = 'pendente' THEN 'pendente'
                    ELSE 'indisponivel'
                END as disponibilidade
            FROM lugares l
            LEFT JOIN lugares_ocupados lo 
                ON l.id_lugar = lo.id_lugar 
                AND lo.id_sessao = $1
            WHERE l.id_lugar = ANY($2::text[])
            AND l.estado_permanente = 'activo'
            ORDER BY l.id_lugar
        `;

        const disponibilidadeResult = await conexao.query(
            disponibilidadeQuery,
            [sessao_id, lugarIds]
        );

        // Verificar lugares indisponíveis
        const lugaresIndisponiveis = disponibilidadeResult.rows.filter(r => 
            r.disponibilidade === 'ocupado' || r.disponibilidade === 'pendente'
        );

        if (lugaresIndisponiveis.length > 0) {
            const detalhesIndisponiveis = lugaresIndisponiveis.map(r => ({
                id_lugar: r.id_lugar,
                codigo: r.codigo_lugar,
                status: r.status,
                motivo: r.disponibilidade === 'ocupado' ? 'Já ocupado' : 'Reserva pendente',
                tempo_restante: r.data_reserva ? 
                    Math.max(0, Math.floor((15 * 60 * 1000 - (Date.now() - new Date(r.data_reserva).getTime())) / 1000)) 
                    : null
            }));

            console.log('Erro: Lugares indisponíveis', {
                lugaresIndisponiveis: detalhesIndisponiveis,
                sessao_id
            });

            await conexao.query('ROLLBACK');
            return res.status(409).json({
                sucesso: false,
                mensagem: "Alguns lugares estão indisponíveis para esta sessão",
                lugares_indisponiveis: detalhesIndisponiveis,
                total_indisponiveis: lugaresIndisponiveis.length
            });
        }

        // 5. Calcular valor total
        const valorTotal = preco * lugares.length;

        // 6. Gerar número de factura
        const dataAtual = new Date();
        const ano = dataAtual.getFullYear();
        const mes = String(dataAtual.getMonth() + 1).padStart(2, '0');
        const dia = String(dataAtual.getDate()).padStart(2, '0');
        const sequencial = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
        const numeroFactura = `FACT-${ano}${mes}${dia}-${sequencial}`;

        // 7. Gerar QR Code no formato correto
        // Primeiro, criar os dados do QR Code
        const qrData = JSON.stringify({
            id_compra,
            id_cliente,
            sessao_id,
            lugares: lugarIds,
            data: dataAtual.toISOString(),
            valor_total: valorTotal,
            numero_factura: numeroFactura
        });

        // Converter para base64 (simulado - em produção use uma biblioteca real de QR Code)
        const qrCodeBase64 = Buffer.from(qrData).toString('base64');
        
        // Formato final: data:image/png;base64,{codigo}
        // NOTA: Em produção, você deve usar uma biblioteca como 'qrcode' para gerar a imagem PNG
        // Exemplo com a biblioteca qrcode:
        // const QRCode = require('qrcode');
        // const qrCodeImage = await QRCode.toBuffer(qrData);
        // const qrCodeBase64 = qrCodeImage.toString('base64');
        
        const qrCode = `data:image/png;base64,${qrCodeBase64}`;

        // 8. Inserir compra - CORRIGIDO: adicionando id_sessao
        const insertCompraQuery = `
            INSERT INTO compras (
                id_compra,
                id_cliente,
                id_sessao,  -- ADICIONADO
                data_compra,
                valor_total,
                forma_pagamento,
                estado_pagamento,
                numero_factura,
                qr_code
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id_compra, id_cliente, id_sessao, data_compra, valor_total, 
                      forma_pagamento, estado_pagamento, numero_factura, qr_code
        `;

        const compraResult = await conexao.query(insertCompraQuery, [
            id_compra,
            id_cliente,
            sessao_id,  // ADICIONADO
            dataAtual,
            valorTotal,
            forma_pagamento,
            'aprovado',
            numeroFactura,
            qrCode
        ]);

        // 9. Inserir lugares ocupados com data de reserva
        const insertLugaresOcupadosQuery = `
            INSERT INTO lugares_ocupados (
                id_lo,
                id_lugar, 
                id_sala, 
                id_compra, 
                id_sessao, 
                status,
                data_reserva
            ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
            RETURNING id_lo, id_lugar, id_sala, id_compra, id_sessao, status, data_reserva
        `;

        const lugaresOcupadosInseridos = [];
        
        for (const lugar of lugares) {
            const id_lo = uuidv4();
            const result = await conexao.query(insertLugaresOcupadosQuery, [
                id_lo,
                lugar.id_lugar,
                id_sala,
                id_compra,
                sessao_id,
                'ocupado'
            ]);
            lugaresOcupadosInseridos.push(result.rows[0]);
        }

        // 10. Commit da transação
        await conexao.query('COMMIT');

        // 11. Buscar detalhes completos para resposta
        const detalhesCompraQuery = `
            SELECT 
                c.*,
                s.data_hora_inicio,
                s.data_hora_fim,
                f.titulo as filme_titulo,
                json_agg(
                    json_build_object(
                        'id_lugar', lo.id_lugar,
                        'codigo_lugar', l.codigo_lugar,
                        'status', lo.status,
                        'data_reserva', lo.data_reserva
                    ) ORDER BY l.id_lugar
                ) as lugares
            FROM compras c
            JOIN sessoes s ON s.id_sessao = c.id_sessao
            JOIN filmes f ON f.id_filme = s.id_filme
            JOIN salas sa ON sa.id_sala = s.id_sala
            JOIN lugares_ocupados lo ON lo.id_compra = c.id_compra
            JOIN lugares l ON l.id_lugar = lo.id_lugar
            WHERE c.id_compra = $1
            GROUP BY c.id_compra, s.data_hora_inicio, s.data_hora_fim, 
                     f.titulo
        `;

        const detalhesCompra = await conexao.query(detalhesCompraQuery, [id_compra]);

        // 12. Retornar resposta completa
        res.status(201).json({
            sucesso: true,
            mensagem: "Compra realizada com sucesso",
            compra: {
                ...compraResult.rows[0],
                sessao: {
                    id_sessao: sessao_id,
                    data_hora_inicio: sessao.data_hora_inicio,
                    data_hora_fim: sessao.data_hora_fim
                },
                detalhes: detalhesCompra.rows[0] || null,
                lugares_ocupados: lugaresOcupadosInseridos,
                total_lugares: lugares.length,
                valor_unitario: preco,
                tempo_reserva: 15, // minutos
                tempo_expiracao: new Date(Date.now() + 15 * 60 * 1000).toISOString()
            }
        });

    } catch (err) {
        await conexao.query('ROLLBACK');
        
        // Tratamento específico para diferentes tipos de erro
        let mensagemErro = "Erro ao processar compra";
        let statusCode = 500;
        
        if (err.code === '23505') { // Unique violation
            mensagemErro = "Conflito: Este lugar já está reservado";
            statusCode = 409;
        } else if (err.code === '23503') { // Foreign key violation
            mensagemErro = "Dados inválidos: Verifique os IDs fornecidos";
            statusCode = 400;
        } else if (err.code === '40P01') { // Deadlock
            mensagemErro = "Sistema ocupado. Tente novamente em alguns segundos";
            statusCode = 503;
        } else if (err.message && err.message.includes('timeout')) {
            mensagemErro = "Tempo limite excedido. Tente novamente";
            statusCode = 408;
        }

        console.error('Erro detalhado ao processar compra:', {
            message: err.message,
            code: err.code,
            constraint: err.constraint,
            detail: err.detail,
            where: err.where,
            table: err.table,
            routine: err.routine,
            stack: err.stack,
            body: req.body,
            timestamp: new Date().toISOString()
        });

        res.status(statusCode).json({
            sucesso: false,
            mensagem: mensagemErro,
            erro: process.env.NODE_ENV === 'development' ? err.message : undefined,
            codigo_erro: err.code || undefined
        });
    }
});

/**
 * @swagger
 * /genero:
 *   post:
 *     summary: Criar um novo gênero
 *     description: Registra um novo gênero para filmes
 *     tags: [Gêneros]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nome_genero
 *             properties:
 *               nome_genero:
 *                 type: string
 *                 description: Nome do gênero
 *                 example: "Ação"
 *               descricao:
 *                 type: string
 *                 description: Descrição do gênero
 *                 example: "Filmes com cenas de ação intensas e perseguições"
 *     responses:
 *       201:
 *         description: Gênero criado com sucesso
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
 *                   example: "Gênero criado com sucesso"
 *                 genero:
 *                   type: object
 *                   properties:
 *                     id_genero:
 *                       type: string
 *                       format: uuid
 *                       example: "550e8400-e29b-41d4-a716-446655440001"
 *                     nome_genero:
 *                       type: string
 *                       example: "Ação"
 *                     descricao:
 *                       type: string
 *                       example: "Filmes com cenas de ação intensas e perseguições"
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
 *                   example: "Nome do gênero é obrigatório"
 *       409:
 *         description: Gênero já existe
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
 *                   example: "Já existe um gênero com o nome 'Ação'"
 *       500:
 *         description: Erro interno do servidor
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
 *                   example: "Erro ao criar gênero"
 *                 erro:
 *                   type: string
 *                   example: "Database error"
 */
router.post('/genero', async (req, res) => {
    const id_genero = uuidv4();
    const { nome_genero, descricao } = req.body;

    // --- VALIDAÇÕES ---
    if (!nome_genero || nome_genero.trim() === '') {
        return res.status(400).json({
            sucesso: false,
            mensagem: "Nome do gênero é obrigatório"
        });
    }

    try {
        // --- VERIFICAR SE GÊNERO JÁ EXISTE ---
        const verificarGenero = `
            SELECT id_genero FROM generos WHERE nome_genero = $1
        `;
        const generoExistente = await conexao.query(verificarGenero, [nome_genero.trim()]);

        if (generoExistente.rows.length > 0) {
            return res.status(409).json({
                sucesso: false,
                mensagem: `Já existe um gênero com o nome '${nome_genero.trim()}'`
            });
        }

        // --- INSERIR GÊNERO ---
        const sql = `
            INSERT INTO generos (id_genero, nome_genero, descricao)
            VALUES ($1, $2, $3)
            RETURNING *
        `;

        const values = [
            id_genero,
            nome_genero.trim(),
            descricao || null
        ];

        const result = await conexao.query(sql, values);

        res.status(201).json({
            sucesso: true,
            mensagem: "Gênero criado com sucesso",
            genero: result.rows[0]
        });

    } catch (error) {
        console.error('Erro ao criar gênero:', error);
        res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao criar gênero",
            erro: error.message
        });
    }
});

/**
 * @swagger
 * /filme:
 *   post:
 *     summary: Criar um novo filme com gêneros
 *     description: Registra um novo filme e associa a um ou mais gêneros
 *     tags: [Filmes]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - titulo
 *               - duracao_minuto
 *               - ano_lancamento
 *               - id_funcionario
 *               - id_genero
 *             properties:
 *               titulo:
 *                 type: string
 *                 description: Título do filme
 *                 example: "Avatar 3"
 *               sinopse:
 *                 type: string
 *                 description: Sinopse do filme
 *                 example: "Uma jornada épica em Pandora..."
 *               duracao_minuto:
 *                 type: integer
 *                 description: Duração em minutos
 *                 example: 180
 *               ano_lancamento:
 *                 type: integer
 *                 description: Ano de lançamento
 *                 example: 2025
 *               classificacao_etaria:
 *                 type: string
 *                 enum: [L, 6, 12, 14, 16, 18]
 *                 description: Classificação indicativa (L = Livre)
 *                 example: "12"
 *               nota_media:
 *                 type: number
 *                 format: float
 *                 description: Nota média do filme
 *                 example: 8.5
 *               cartaz_url:
 *                 type: string
 *                 description: URL do cartaz do filme
 *                 example: "https://example.com/poster.jpg"
 *               trailer_url:
 *                 type: string
 *                 description: URL do trailer do filme
 *                 example: "https://youtube.com/watch?v=123"
 *               id_funcionario:
 *                 type: string
 *                 format: uuid
 *                 description: ID do funcionário que cadastrou
 *                 example: "550e8400-e29b-41d4-a716-446655440000"
 *               pais_origem:
 *                 type: string
 *                 description: País de origem do filme
 *                 example: "EUA"
 *               idioma_original:
 *                 type: string
 *                 description: Idioma original do filme
 *                 example: "Inglês"
 *               estado_exibicao:
 *                 type: string
 *                 enum: [disponivel, indisponivel, brevemente]
 *                 description: Estado de exibição do filme
 *                 example: "disponivel"
 *               destaque:
 *                 type: boolean
 *                 description: Indica se o filme está em destaque
 *                 example: true
 *               id_genero:
 *                 type: array
 *                 description: Lista de IDs dos gêneros
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 example: ["550e8400-e29b-41d4-a716-446655440001", "550e8400-e29b-41d4-a716-446655440002"]
 *     responses:
 *       201:
 *         description: Filme criado com sucesso
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
 *                   example: "Filme criado com 2 gêneros com sucesso"
 *                 filme:
 *                   type: object
 *                   properties:
 *                     id_filme:
 *                       type: string
 *                       format: uuid
 *                       example: "550e8400-e29b-41d4-a716-446655440000"
 *                     titulo:
 *                       type: string
 *                       example: "Avatar 3"
 *                     sinopse:
 *                       type: string
 *                       example: "Uma jornada épica em Pandora..."
 *                     duracao_minuto:
 *                       type: integer
 *                       example: 180
 *                     ano_lancamento:
 *                       type: integer
 *                       example: 2025
 *                     classificacao_etaria:
 *                       type: string
 *                       example: "12"
 *                     nota_media:
 *                       type: number
 *                       example: 8.5
 *                     cartaz_url:
 *                       type: string
 *                       example: "https://example.com/poster.jpg"
 *                     trailer_url:
 *                       type: string
 *                       example: "https://youtube.com/watch?v=123"
 *                     pais_origem:
 *                       type: string
 *                       example: "EUA"
 *                     idioma_original:
 *                       type: string
 *                       example: "Inglês"
 *                     estado_exibicao:
 *                       type: string
 *                       example: "disponivel"
 *                     destaque:
 *                       type: boolean
 *                       example: true
 *                     cadastrado_por:
 *                       type: string
 *                       format: uuid
 *                       example: "550e8400-e29b-41d4-a716-446655440000"
 *                     data_cadastro:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-15T10:30:00Z"
 *                 generos_associados:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id_genero:
 *                         type: string
 *                         format: uuid
 *                         example: "550e8400-e29b-41d4-a716-446655440001"
 *                       nome_genero:
 *                         type: string
 *                         example: "Ação"
 *                 generos_nao_encontrados:
 *                   type: array
 *                   items:
 *                     type: string
 *                     format: uuid
 *                     example: ["550e8400-e29b-41d4-a716-446655440099"]
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
 *                   example: "Classificação etária inválida. Valores permitidos: L, 6, 12, 14, 16, 18"
 *       404:
 *         description: Funcionário ou gênero não encontrado
 *       409:
 *         description: Filme já existe
 *       500:
 *         description: Erro interno do servidor
 */
router.post('/filme', async (req, res) => {
    const id_filme = uuidv4();
    const data_cadastro = new Date();
    const {
        titulo,
        sinopse,
        duracao_minuto,
        ano_lancamento,
        classificacao_etaria,
        nota_media,
        cartaz_url,
        trailer_url,
        id_funcionario,
        pais_origem,
        idioma_original,
        estado_exibicao,
        destaque,
        id_genero
    } = req.body;

    // --- VALIDAÇÕES ---
    if (!titulo || titulo.trim() === '') {
        return res.status(400).json({
            sucesso: false,
            mensagem: "Título é obrigatório"
        });
    }

    if (!duracao_minuto || duracao_minuto <= 0) {
        return res.status(400).json({
            sucesso: false,
            mensagem: "Duração deve ser maior que 0"
        });
    }

    if (!ano_lancamento || ano_lancamento < 1900 || ano_lancamento > new Date().getFullYear() + 5) {
        return res.status(400).json({
            sucesso: false,
            mensagem: "Ano de lançamento inválido"
        });
    }

    if (!id_funcionario) {
        return res.status(400).json({
            sucesso: false,
            mensagem: "ID do funcionário é obrigatório"
        });
    }

    if (!id_genero || !Array.isArray(id_genero) || id_genero.length === 0) {
        return res.status(400).json({
            sucesso: false,
            mensagem: "Pelo menos um gênero é obrigatório"
        });
    }

    // --- VALIDAR CLASSIFICAÇÃO ETÁRIA ---
    // Valores permitidos: 'L', '6', '12', '14', '16', '18'
    const CLASSIFICACOES_VALIDAS = ['L', '6', '12', '14', '16', '18'];
    
    // Se não for enviado, usar 'L' (Livre) como padrão
    let classificacaoFinal = classificacao_etaria || 'L';
    
    // Converter para string e remover espaços
    classificacaoFinal = String(classificacaoFinal).trim();
    
    // Validar se é um valor permitido
    if (!CLASSIFICACOES_VALIDAS.includes(classificacaoFinal)) {
        return res.status(400).json({
            sucesso: false,
            mensagem: `Classificação etária inválida. Valores permitidos: ${CLASSIFICACOES_VALIDAS.join(', ')}`,
            valor_enviado: classificacao_etaria
        });
    }

    try {
        await conexao.query('BEGIN');

        // --- VERIFICAR FUNCIONÁRIO ---
        const verificarFuncionario = `
            SELECT id_funcionario FROM funcionarios WHERE id_funcionario = $1
        `;
        const funcionario = await conexao.query(verificarFuncionario, [id_funcionario]);

        if (funcionario.rows.length === 0) {
            await conexao.query('ROLLBACK');
            return res.status(404).json({
                sucesso: false,
                mensagem: "Funcionário não encontrado"
            });
        }

        // --- VERIFICAR SE FILME JÁ EXISTE ---
        const verificarFilme = `
            SELECT id_filme FROM filmes WHERE titulo = $1 AND ano_lancamento = $2
        `;
        const filmeExistente = await conexao.query(verificarFilme, [titulo.trim(), ano_lancamento]);

        if (filmeExistente.rows.length > 0) {
            await conexao.query('ROLLBACK');
            return res.status(409).json({
                sucesso: false,
                mensagem: `Já existe um filme com o título "${titulo}" e ano "${ano_lancamento}"`
            });
        }

        // --- VERIFICAR GÊNEROS ---
        const generosValidos = [];
        const generosInvalidos = [];

        for (const generoId of id_genero) {
            const verificarGenero = `
                SELECT id_genero, nome_genero FROM generos WHERE id_genero = $1
            `;
            const genero = await conexao.query(verificarGenero, [generoId]);
            
            if (genero.rows.length > 0) {
                generosValidos.push({
                    id_genero: genero.rows[0].id_genero,
                    nome_genero: genero.rows[0].nome_genero
                });
            } else {
                generosInvalidos.push(generoId);
            }
        }

        if (generosValidos.length === 0) {
            await conexao.query('ROLLBACK');
            return res.status(404).json({
                sucesso: false,
                mensagem: "Nenhum gênero válido foi encontrado",
                generos_invalidos: generosInvalidos
            });
        }

        // --- INSERIR FILME ---
        const sql = `
            INSERT INTO filmes (
                id_filme,
                titulo,
                sinopse,
                duracao_minutos,
                ano_lancamento,
                classificacao_etaria,
                nota_media,
                cartaz_url,
                trailer_url,
                cadastrado_por,
                pais_origem,
                idioma_original,
                estado_exibicao,
                destaque,
                data_cadastro
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
            )
            RETURNING *
        `;

        const values = [
            id_filme,
            titulo.trim(),
            sinopse || null,
            duracao_minuto,
            ano_lancamento,
            classificacaoFinal, // 'L', '6', '12', '14', '16' ou '18'
            nota_media || 0,
            cartaz_url || null,
            trailer_url || null,
            id_funcionario,
            pais_origem || null,
            idioma_original || null,
            estado_exibicao || 'disponivel',
            destaque || false,
            data_cadastro
        ];

        const result = await conexao.query(sql, values);

        // --- ASSOCIAR GÊNEROS ---
        const generosAssociados = [];
        for (const genero of generosValidos) {
            const sqlGenero = `
                INSERT INTO filmes_generos (id_filme, id_genero)
                VALUES ($1, $2)
                RETURNING *
            `;
            await conexao.query(sqlGenero, [id_filme, genero.id_genero]);
            generosAssociados.push(genero);
        }

        await conexao.query('COMMIT');

        // --- BUSCAR GÊNEROS DO FILME ---
        const buscarGeneros = `
            SELECT g.id_genero, g.nome_genero 
            FROM generos g
            INNER JOIN filmes_generos fg ON g.id_genero = fg.id_genero
            WHERE fg.id_filme = $1
            ORDER BY g.nome_genero
        `;
        const generosFilme = await conexao.query(buscarGeneros, [id_filme]);

        res.status(201).json({
            sucesso: true,
            mensagem: `Filme criado com ${generosAssociados.length} gênero(s) com sucesso`,
            filme: result.rows[0],
            generos_associados: generosAssociados,
            generos_nao_encontrados: generosInvalidos,
            todos_generos_filme: generosFilme.rows
        });

    } catch (error) {
        await conexao.query('ROLLBACK');
        
        console.error('Erro ao criar filme:', error);
        res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao criar filme",
            erro: error.message,
            detalhe: error.detail || null
        });
    }
});



module.exports = router;