const express = require("express");
const router = express.Router();
const conexao = require("../infra/conexao");

const { verificarToken, autorizar } = require("../middleware/authMiddleware");
const {
  gerarCodigo,
  gerarId,
  gerarSugestoes,
  gerarMapaVisual,
  gerarMapaVisualAssentos,
} = require("../utils/senha");
const { registrarLog } = require("../utils/log");
const { v4: uuidv4 } = require("uuid");

router.get('/sala/:id/assentos', async (req, res) => {
    const id = req.params.id;
    
    try {
        // --- BUSCAR DADOS DA SALA ---
        const sqlSala = `
            SELECT id_sala, nome_sala, capacidade_total, tipo_sala, estado_sala, coluna, fila
            FROM salas 
            WHERE id_sala = $1
        `;
        const salaResult = await conexao.query(sqlSala, [id]);
        
        if (salaResult.rows.length === 0) {
            return res.status(404).json({
                sucesso: false,
                mensagem: "Sala não encontrada"
            });
        }
        
        const sala = salaResult.rows[0];
        
        // --- BUSCAR ASSENTOS DA SALA ---
        const sqlAssentos = `
            SELECT id_lugar, codigo_lugar, fileira, numero, estado_permanente, codigo
            FROM lugares 
            WHERE id_sala = $1
            ORDER BY fileira, numero
        `;
        const assentosResult = await conexao.query(sqlAssentos, [id]);
        const assentos = assentosResult.rows;
        
        // --- ORGANIZAR ASSENTOS POR FILA ---
        const assentosPorFila = {};
        const fileiras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
        const colunas = sala.coluna || 0;
        const filas = sala.fila || 0;
        
        // Inicializar estrutura para todas as filas
        for (let i = 0; i < filas; i++) {
            const letra = fileiras[i % fileiras.length];
            assentosPorFila[letra] = {
                fila: letra,
                assentos: [],
                total_ativos: 0,
                total_inativos: 0
            };
        }
        
        // Preencher com os assentos existentes
        assentos.forEach(assento => {
            const fila = assento.fileira;
            if (!assentosPorFila[fila]) {
                assentosPorFila[fila] = {
                    fila: fila,
                    assentos: [],
                    total_ativos: 0,
                    total_inativos: 0
                };
            }
            
            const ativo = assento.estado_permanente === 'ativo';
            assentosPorFila[fila].assentos.push({
                id_lugar: assento.id_lugar,
                codigo_lugar: assento.codigo_lugar,
                fileira: assento.fileira,
                numero: assento.numero,
                estado_permanente: assento.estado_permanente,
                codigo: assento.codigo,
                ativo: ativo
            });
            
            if (ativo) {
                assentosPorFila[fila].total_ativos++;
            } else {
                assentosPorFila[fila].total_inativos++;
            }
        });
        
        // --- COMPLETAR FILAS COM ASSENTOS VAZIOS (VISUAL) ---
        for (let i = 0; i < filas; i++) {
            const letra = fileiras[i % fileiras.length];
            const filaAtual = assentosPorFila[letra];
            
            if (filaAtual) {
                // Ordenar assentos por número
                filaAtual.assentos.sort((a, b) => a.numero - b.numero);
                
                // Verificar se faltam assentos na fila
                const assentosExistentes = filaAtual.assentos.length;
                if (assentosExistentes < colunas) {
                    // Adicionar assentos vazios (placeholder)
                    for (let c = assentosExistentes + 1; c <= colunas; c++) {
                        filaAtual.assentos.push({
                            id_lugar: null,
                            codigo_lugar: `${letra}${c}`,
                            fileira: letra,
                            numero: c,
                            estado_permanente: null,
                            codigo: null,
                            ativo: false,
                            vazio: true
                        });
                    }
                }
            }
        }
        
        // --- CONVERTER PARA ARRAY ORDENADO ---
        const assentosOrganizados = Object.values(assentosPorFila)
            .filter(f => f.assentos.length > 0)
            .sort((a, b) => a.fila.localeCompare(b.fila));
        
        // --- CALCULAR ESTATÍSTICAS ---
        const totalAssentos = assentos.length;
        const totalAtivos = assentos.filter(a => a.estado_permanente === 'ativo').length;
        const totalInativos = totalAssentos - totalAtivos;
        const totalPosicoes = filas * colunas;
        const assentosVazios = totalPosicoes - totalAssentos;
        
        // --- GERAR MAPA VISUAL ---
        const mapaVisual = gerarMapaVisualAssentos(assentosOrganizados, colunas);
        
        res.status(200).json({
            sucesso: true,
            sala: {
                id_sala: sala.id_sala,
                nome_sala: sala.nome_sala,
                capacidade_total: sala.capacidade_total,
                tipo_sala: sala.tipo_sala,
                estado_sala: sala.estado_sala,
                coluna: sala.coluna,
                fila: sala.fila
            },
            total_assentos: totalAssentos,
            configuracao: {
                filas: filas,
                colunas: colunas,
                total_posicoes: totalPosicoes,
                assentos_ocupados: totalAssentos,
                assentos_vazios: assentosVazios,
                assentos_ativos: totalAtivos,
                assentos_inativos: totalInativos,
                porcentagem_ocupacao: totalPosicoes > 0 
                    ? Math.round((totalAssentos / totalPosicoes) * 100) 
                    : 0
            },
            assentos: assentosOrganizados,
            mapa_visual: mapaVisual
        });
        
    } catch (error) {
        console.error('Erro ao buscar assentos:', error);
        res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao buscar assentos",
            erro: error.message
        });
    }
});

/**
 * @swagger
 * /compras/estatisticas:
 *   get:
 *     summary: Obtém estatísticas de compras
 *     description: Retorna o total de compras e valores com filtros diário, semanal, mensal e anual
 *     tags: [Compras]
 *     parameters:
 *       - in: query
 *         name: periodo
 *         required: false
 *         description: Período para filtrar (dia, semana, mes, ano)
 *         schema:
 *           type: string
 *           enum: [dia, semana, mes, ano, todos]
 *           default: todos
 *       - in: query
 *         name: data_referencia
 *         required: false
 *         description: Data de referência para o filtro (formato YYYY-MM-DD)
 *         schema:
 *           type: string
 *           format: date
 *           example: "2026-06-21"
 *     responses:
 *       200:
 *         description: Estatísticas obtidas com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sucesso:
 *                   type: boolean
 *                   example: true
 *                 total_geral:
 *                   type: object
 *                   properties:
 *                     compras:
 *                       type: integer
 *                       example: 150
 *                     valor_total:
 *                       type: number
 *                       format: float
 *                       example: 12500.50
 *                 periodo:
 *                   type: object
 *                   properties:
 *                     tipo:
 *                       type: string
 *                       example: "todos"
 *                     data_referencia:
 *                       type: string
 *                       format: date
 *                       example: "2026-06-21"
 *                     total_compras:
 *                       type: integer
 *                       example: 150
 *                     valor_total:
 *                       type: number
 *                       format: float
 *                       example: 12500.50
 *                     media_por_compra:
 *                       type: number
 *                       format: float
 *                       example: 83.34
 *                 por_forma_pagamento:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       forma_pagamento:
 *                         type: string
 *                         example: "multicaixa"
 *                       total:
 *                         type: integer
 *                         example: 45
 *                       valor_total:
 *                         type: number
 *                         format: float
 *                         example: 3750.00
 *                 por_estado:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       estado_pagamento:
 *                         type: string
 *                         example: "aprovado"
 *                       total:
 *                         type: integer
 *                         example: 120
 *                       valor_total:
 *                         type: number
 *                         format: float
 *                         example: 10000.00
 *                 por_dia:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       data:
 *                         type: string
 *                         format: date
 *                         example: "2026-06-21"
 *                       total_compras:
 *                         type: integer
 *                         example: 15
 *                       valor_total:
 *                         type: number
 *                         format: float
 *                         example: 1250.00
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
 *                   example: "Erro ao buscar estatísticas"
 *                 erro:
 *                   type: string
 *                   example: "Database error"
 */

router.get('/salas', async (req, res) => {
    try {
        const sql = `
            SELECT
                id_sala,
                nome_sala,
                capacidade_total,
                tipo_sala,
                estado_sala,
                coluna,
                fila
            FROM salas
            ORDER BY nome_sala ASC
        `;

        const result = await conexao.query(sql);

        res.status(200).json({
            sucesso: true,
            total: result.rows.length,
            salas: result.rows
        });

    } catch (error) {
        console.error("Erro ao buscar salas:", error);
        res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao buscar salas",
            erro: error.message
        });
    }
});

/**
 * @swagger
 * /generos:
 *   get:
 *     summary: Lista todos os gêneros
 *     description: Retorna uma lista de todos os gêneros cadastrados
 *     tags: [Gêneros]
 *     responses:
 *       200:
 *         description: Lista de gêneros retornada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id_genero:
 *                     type: string
 *                     format: uuid
 *                     example: "550e8400-e29b-41d4-a716-446655440001"
 *                   nome_genero:
 *                     type: string
 *                     example: "Ação"
 *                   descricao:
 *                     type: string
 *                     example: "Filmes com cenas de ação intensas"
 *       500:
 *         description: Erro interno do servidor
 */

router.post('/salas', verificarToken, autorizar('funcionario', 'administrador'), async (req, res) => {
    const {
        nome_sala,
        capacidade_total,
        tipo_sala = 'NORMAL',
        estado_sala = 'ativa',
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
                    VALUES ($1, $2, $3, $4, $5, 'ativo', $6)
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

router.put("/lugares/:id_lugar", verificarToken, autorizar("funcionario", "administrador"), async (req, res) => {
  const { id_lugar } = req.params;
  const { estado_permanente } = req.body;

  const estadosValidos = ["ativo", "inativo", "manutencao"];
  if (!estado_permanente) {
    return res.status(400).json({
      sucesso: false,
      mensagem: "O campo estado_permanente é obrigatório",
    });
  }

  if (!estadosValidos.includes(estado_permanente)) {
    return res.status(400).json({
      sucesso: false,
      mensagem: `Estado inválido. Use: ${estadosValidos.join(", ")}`,
    });
  }

  if (!id_lugar) {
    return res.status(400).json({
      sucesso: false,
      mensagem: "ID do lugar é obrigatório",
    });
  }

  try {
    const checkQuery =
      "SELECT id_lugar, codigo_lugar, estado_permanente FROM lugares WHERE id_lugar = $1";
    const checkResult = await conexao.query(checkQuery, [id_lugar]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        sucesso: false,
        mensagem: `Lugar com ID ${id_lugar} não encontrado`,
      });
    }

    const updateQuery = `
            UPDATE lugares 
            SET estado_permanente = $1 
            WHERE id_lugar = $2 
            RETURNING *
        `;

    const updateResult = await conexao.query(updateQuery, [
      estado_permanente,
      id_lugar,
    ]);

    if (updateResult.rows.length === 0) {
      return res.status(404).json({
        sucesso: false,
        mensagem: "Lugar não encontrado ou não foi possível atualizar",
      });
    }

    const lugarAtualizado = updateResult.rows[0];

    return res.status(200).json({
      sucesso: true,
      mensagem: "Lugar atualizado com sucesso",
      lugar: {
        id_lugar: lugarAtualizado.id_lugar,
        codigo_lugar: lugarAtualizado.codigo_lugar,
        estado_permanente: lugarAtualizado.estado_permanente,
        fileira: lugarAtualizado.fileira,
        numero: lugarAtualizado.numero,
      },
    });
  } catch (err) {
    console.error("Erro detalhado ao atualizar lugar:", err);

    if (err.code === "ECONNREFUSED") {
      return res.status(500).json({
        sucesso: false,
        mensagem: "Erro de conexão com o banco de dados",
      });
    }

    return res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao atualizar lugar",
      erro: err.message,
    });
  }
});

/**
 * @swagger
 * /user/{id}:
 *   put:
 *     summary: Atualiza um utilizador
 *     description: Atualiza os dados de um utilizador e seu cargo filtrando pelo ID
 *     tags: [Utilizadores]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID do utilizador
 *         schema:
 *           type: string
 *           example: "550e8400-e29b-41d4-a716-446655440000"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome:
 *                 type: string
 *                 description: Nome do utilizador
 *                 example: "João Silva"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email do utilizador
 *                 example: "joao.silva@empresa.com"
 *               telefone:
 *                 type: string
 *                 description: Número de telefone
 *                 example: "+351 912345678"
 *               tipo_utilizador:
 *                 type: string
 *                 description: Tipo de utilizador
 *                 example: "admin"
 *               estado:
 *                 type: string
 *                 description: Estado do utilizador
 *                 example: "ativo"
 *               cargo:
 *                 type: string
 *                 description: Cargo do funcionário
 *                 example: "Desenvolvedor"
 *     responses:
 *       200:
 *         description: Utilizador atualizado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 mensagem:
 *                   type: string
 *                   description: Mensagem de sucesso
 *                   example: "Utilizador atualizado com sucesso"
 *                 utilizador:
 *                   type: object
 *                   properties:
 *                     id_utilizador:
 *                       type: string
 *                       description: ID do utilizador
 *                       example: "550e8400-e29b-41d4-a716-446655440000"
 *                     nome:
 *                       type: string
 *                       description: Nome do utilizador
 *                       example: "João Silva"
 *                     email:
 *                       type: string
 *                       format: email
 *                       description: Email do utilizador
 *                       example: "joao.silva@empresa.com"
 *                     telefone:
 *                       type: string
 *                       description: Número de telefone
 *                       example: "+351 912345678"
 *                     tipo_utilizador:
 *                       type: string
 *                       description: Tipo de utilizador
 *                       example: "admin"
 *                     estado:
 *                       type: string
 *                       description: Estado do utilizador
 *                       example: "ativo"
 *                     data_registo:
 *                       type: string
 *                       format: date-time
 *                       description: Data de registo
 *                       example: "2024-01-15T10:30:00Z"
 *                     id_funcionario:
 *                       type: string
 *                       description: ID do funcionário
 *                       example: "660e8400-e29b-41d4-a716-446655440001"
 *                     cargo:
 *                       type: string
 *                       description: Cargo do funcionário
 *                       example: "Desenvolvedor"
 *       400:
 *         description: Dados inválidos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 erro:
 *                   type: string
 *                   description: Mensagem de erro
 *                   example: "Nome e email são obrigatórios"
 *       404:
 *         description: Utilizador não encontrado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 mensagem:
 *                   type: string
 *                   description: Mensagem de erro
 *                   example: "Utilizador não encontrado"
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 erro:
 *                   type: string
 *                   description: Mensagem de erro
 *                   example: "Erro ao atualizar utilizador"
 *                 detalhe:
 *                   type: string
 *                   description: Detalhe do erro
 *                   example: "Database connection error"
 */

router.put("/salas/:id", verificarToken, autorizar("funcionario", "administrador"), async (req, res) => {
  const id_sala = req.params.id;
  const { nome_sala, capacidade_total, tipo_sala, estado_sala, coluna, fila } =
    req.body;

  // --- VALIDAÇÕES BÁSICAS ---
  if (!nome_sala || nome_sala.trim() === "") {
    return res.status(400).json({
      sucesso: false,
      mensagem: "Nome da sala é obrigatório",
    });
  }

  if (!capacidade_total || capacidade_total <= 0) {
    return res.status(400).json({
      sucesso: false,
      mensagem: "Capacidade total deve ser maior que 0",
    });
  }

  if (capacidade_total > 200) {
    return res.status(400).json({
      sucesso: false,
      mensagem: "Capacidade máxima permitida é de 200 lugares",
    });
  }

  if (coluna < 1 || coluna > 20) {
    return res.status(400).json({
      sucesso: false,
      mensagem: "Número de colunas deve ser entre 1 e 20",
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
        sugestoes: sugestoes,
      });
    }
  } else {
    totalFilas = Math.ceil(capacidade_total / lugaresPorFila);
    totalPosicoes = totalFilas * lugaresPorFila;
  }

  try {
    // --- VERIFICAR SE SALA EXISTE ---
    const verificarSalaQuery = `
            SELECT id_sala, nome_sala, tipo_sala 
            FROM salas 
            WHERE id_sala = $1
        `;
    const salaExistente = await conexao.query(verificarSalaQuery, [id_sala]);

    if (salaExistente.rows.length === 0) {
      return res.status(404).json({
        sucesso: false,
        mensagem: "Sala não encontrada",
      });
    }

    // --- VERIFICAR SE JÁ EXISTE OUTRA SALA COM MESMO NOME E TIPO ---
    const verificarDuplicado = `
            SELECT id_sala FROM salas 
            WHERE nome_sala = $1 AND tipo_sala = $2 AND id_sala != $3
        `;
    const duplicado = await conexao.query(verificarDuplicado, [
      nome_sala.trim(),
      tipo_sala,
      id_sala,
    ]);

    if (duplicado.rows.length > 0) {
      return res.status(409).json({
        sucesso: false,
        mensagem: `Já existe uma sala com o nome "${nome_sala}" e tipo "${tipo_sala}"`,
        sala_existente: {
          id_sala: duplicado.rows[0].id_sala,
        },
      });
    }

    // --- INICIAR TRANSAÇÃO ---
    await conexao.query("BEGIN");

    // --- BUSCAR LUGARES ATUAIS ---
    const buscarLugaresAtuais = `
            SELECT id_lugar, codigo_lugar, fileira, numero, estado_permanente
            FROM lugares 
            WHERE id_sala = $1
        `;
    const lugaresAtuais = await conexao.query(buscarLugaresAtuais, [id_sala]);

    // --- GERAR NOVOS CÓDIGOS DE LUGARES ---
    const fileiras = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    const novosCodigos = new Set();
    let lugaresParaManter = 0;
    let lugaresParaRemover = 0;
    let lugaresParaAdicionar = 0;

    // Criar mapa dos lugares existentes por código
    const mapaCodigosExistentes = {};
    lugaresAtuais.rows.forEach((lugar) => {
      mapaCodigosExistentes[lugar.codigo_lugar] = lugar;
    });

    // Gerar novos códigos baseados na nova configuração
    for (let f = 0; f < totalFilas; f++) {
      const letraFileira = fileiras[f % fileiras.length];
      for (let c = 0; c < lugaresPorFila; c++) {
        const codigo = `${letraFileira}${c + 1}`;
        novosCodigos.add(codigo);
      }
    }

    // --- REMOVER LUGARES QUE NÃO ESTÃO NA NOVA CONFIGURAÇÃO ---
    for (const lugar of lugaresAtuais.rows) {
      if (!novosCodigos.has(lugar.codigo_lugar)) {
        const sqlRemover = `DELETE FROM lugares WHERE id_lugar = $1`;
        await conexao.query(sqlRemover, [lugar.id_lugar]);
        lugaresParaRemover++;
      } else {
        lugaresParaManter++;
      }
    }

    // --- ADICIONAR NOVOS LUGARES ---
    let lugaresInseridos = 0;
    const lugaresGerados = [];
    const lugaresOrganizados = [];

    for (
      let f = 0;
      f < totalFilas && lugaresInseridos < capacidade_total;
      f++
    ) {
      const letraFileira = fileiras[f % fileiras.length];
      const linha = [];
      let linhaTemAtivos = false;

      const lugaresRestantes = capacidade_total - lugaresInseridos;
      const lugaresNaFila = Math.min(lugaresPorFila, lugaresRestantes);

      for (let numero = 1; numero <= lugaresNaFila; numero++) {
        const codigo_lugar = `${letraFileira}${numero}`;

        // Verificar se o lugar já existe
        if (mapaCodigosExistentes[codigo_lugar]) {
          // Lugar já existe, manter
          const lugarExistente = mapaCodigosExistentes[codigo_lugar];
          linha.push({
            id_lugar: lugarExistente.id_lugar,
            codigo_lugar: lugarExistente.codigo_lugar,
            fileira: lugarExistente.fileira,
            numero: lugarExistente.numero,
            estado_permanente: lugarExistente.estado_permanente,
            ativo: true,
          });
          lugaresGerados.push({
            id_lugar: lugarExistente.id_lugar,
            codigo_lugar: lugarExistente.codigo_lugar,
            fileira: lugarExistente.fileira,
            numero: lugarExistente.numero,
            estado_permanente: lugarExistente.estado_permanente,
            ativo: true,
          });
          linhaTemAtivos = true;
          lugaresInseridos++;
        } else {
          // Criar novo lugar
          const id_lugar = gerarId();
          const codigo_unico = gerarCodigo();

          const insertLugarQuery = `
                        INSERT INTO lugares (id_lugar, id_sala, codigo_lugar, fileira, numero, estado_permanente, codigo)
                        VALUES ($1, $2, $3, $4, $5, 'ativo', $6)
                        RETURNING *
                    `;

          const lugarResult = await conexao.query(insertLugarQuery, [
            id_lugar,
            id_sala,
            codigo_lugar,
            letraFileira,
            numero,
            codigo_unico,
          ]);

          const lugarObj = {
            id_lugar: lugarResult.rows[0].id_lugar,
            codigo_lugar: lugarResult.rows[0].codigo_lugar,
            fileira: lugarResult.rows[0].fileira,
            numero: lugarResult.rows[0].numero,
            estado_permanente: lugarResult.rows[0].estado_permanente,
            codigo: lugarResult.rows[0].codigo,
            ativo: true,
          };

          lugaresGerados.push(lugarObj);
          linha.push(lugarObj);
          linhaTemAtivos = true;
          lugaresInseridos++;
          lugaresParaAdicionar++;
        }
      }

      // --- COMPLETAR LINHA COM LUGARES VAZIOS (INATIVOS) ---
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
          });
        }

        lugaresOrganizados.push({
          fila: letraFileira,
          lugares: linha,
          total_ativos: linha.filter((l) => l.ativo).length,
          total_vazios: linha.filter((l) => !l.ativo).length,
        });
      }
    }

    // --- ADICIONAR FILAS COMPLETAMENTE VAZIAS (SE NECESSÁRIO) ---
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
        });
      }

      lugaresOrganizados.push({
        fila: letraFileira,
        lugares: linha,
        total_ativos: 0,
        total_vazios: lugaresPorFila,
      });
    }

    // --- ATUALIZAR SALA ---
    const updateSalaQuery = `
            UPDATE salas 
            SET nome_sala = $1, 
                capacidade_total = $2, 
                tipo_sala = $3, 
                estado_sala = $4, 
                coluna = $5, 
                fila = $6
            WHERE id_sala = $7
            RETURNING *
        `;

    const salaAtualizada = await conexao.query(updateSalaQuery, [
      nome_sala.trim(),
      lugaresInseridos,
      tipo_sala,
      estado_sala,
      lugaresPorFila,
      totalFilas,
      id_sala,
    ]);

    // --- COMMIT DA TRANSAÇÃO ---
    await conexao.query("COMMIT");

    // --- GERAR MAPA VISUAL ---
    const mapaVisual = gerarMapaVisual(lugaresOrganizados, lugaresPorFila);

    // --- CALCULAR ESTATÍSTICAS ---
    const lugaresVazios = totalPosicoes - lugaresInseridos;
    const porcentagemOcupacao = Math.round(
      (lugaresInseridos / totalPosicoes) * 100,
    );

    res.status(200).json({
      sucesso: true,
      mensagem: `Sala atualizada com ${lugaresInseridos} lugares com sucesso`,
      sala: salaAtualizada.rows[0],
      lugares_afetados: {
        adicionados: lugaresParaAdicionar,
        removidos: lugaresParaRemover,
        mantidos: lugaresParaManter,
      },
      configuracao: {
        colunas: lugaresPorFila,
        filas: totalFilas,
        total_posicoes: totalPosicoes,
        lugares_ocupados: lugaresInseridos,
        lugares_vazios: lugaresVazios,
        capacidade_solicitada: capacidade_total,
        porcentagem_ocupacao: `${porcentagemOcupacao}%`,
      },
      estatisticas: {
        total_lugares: lugaresInseridos,
        lugares_ativos: lugaresInseridos,
        lugares_inativos: lugaresVazios,
        filas_completas: Math.floor(lugaresInseridos / lugaresPorFila),
        filas_parciais: lugaresInseridos % lugaresPorFila > 0 ? 1 : 0,
        ultima_fila_lugares:
          lugaresInseridos % lugaresPorFila || lugaresPorFila,
        lugares_por_fila: lugaresOrganizados.map((f) => ({
          fila: f.fila,
          ativos: f.total_ativos,
          vazios: f.total_vazios,
        })),
      },
      lugares: lugaresOrganizados,
      mapa_visual: mapaVisual,
    });
  } catch (err) {
    // --- ROLLBACK EM CASO DE ERRO ---
    await conexao.query("ROLLBACK");

    console.error("Erro ao atualizar sala:", err);
    res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao atualizar sala",
      erro: err.message,
    });
  }
});

/**
 * @swagger
 * /sala/{idSala}/assentos/{idLugar}:
 *   put:
 *     summary: Alterar estado de um assento
 *     description: Atualiza o estado permanente de um assento específico de uma sala
 *     tags: [Salas]
 *     parameters:
 *       - in: path
 *         name: idSala
 *         required: true
 *         description: ID da sala
 *         schema:
 *           type: string
 *           format: uuid
 *           example: "550e8400-e29b-41d4-a716-446655440000"
 *       - in: path
 *         name: idLugar
 *         required: true
 *         description: ID do lugar
 *         schema:
 *           type: string
 *           format: uuid
 *           example: "660e8400-e29b-41d4-a716-446655440001"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - estado_permanente
 *             properties:
 *               estado_permanente:
 *                 type: string
 *                 enum: [activo, inactivo, manutencao]
 *                 description: Novo estado do assento
 *                 example: "manutencao"
 *     responses:
 *       200:
 *         description: Assento atualizado com sucesso
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
 *                   example: "Estado do assento atualizado com sucesso"
 *                 assento:
 *                   type: object
 *                   properties:
 *                     id_lugar:
 *                       type: string
 *                       format: uuid
 *                       example: "660e8400-e29b-41d4-a716-446655440001"
 *                     codigo_lugar:
 *                       type: string
 *                       example: "A1"
 *                     fileira:
 *                       type: string
 *                       example: "A"
 *                     numero:
 *                       type: integer
 *                       example: 1
 *                     estado_permanente:
 *                       type: string
 *                       enum: [activo, inactivo, manutencao]
 *                       example: "manutencao"
 *                     id_sala:
 *                       type: string
 *                       format: uuid
 *                       example: "550e8400-e29b-41d4-a716-446655440000"
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
 *                   example: "Estado inválido. Valores permitidos: activo, inactivo, manutencao"
 *       404:
 *         description: Sala ou assento não encontrado
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
 *                   example: "Assento não encontrado nesta sala"
 *       409:
 *         description: Conflito - assento com reservas ativas
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
 *                   example: "Não é possível alterar o estado. O assento possui reservas ativas"
 *                 reservas_ativas:
 *                   type: integer
 *                   example: 3
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
 *                   example: "Erro ao atualizar estado do assento"
 *                 erro:
 *                   type: string
 *                   example: "Database error"
 */

router.put("/sala/:idSala/assentos/:idLugar", verificarToken, autorizar("funcionario", "administrador"), async (req, res) => {
  const id_sala = req.params.idSala;
  const id_lugar = req.params.idLugar;
  const { estado_permanente } = req.body;

  // --- VALIDAÇÕES ---
  const estadosPermitidos = ["ativo", "inativo", "manutencao"];

  if (!estado_permanente) {
    return res.status(400).json({
      sucesso: false,
      mensagem: "Estado permanente é obrigatório",
    });
  }

  if (!estadosPermitidos.includes(estado_permanente.toLowerCase())) {
    return res.status(400).json({
      sucesso: false,
      mensagem: `Estado inválido. Valores permitidos: ${estadosPermitidos.join(", ")}`,
      valor_enviado: estado_permanente,
    });
  }

  try {
    // --- VERIFICAR SE A SALA EXISTE ---
    const verificarSalaQuery = `
            SELECT id_sala, nome_sala FROM salas WHERE id_sala = $1
        `;
    const salaResult = await conexao.query(verificarSalaQuery, [id_sala]);

    if (salaResult.rows.length === 0) {
      return res.status(404).json({
        sucesso: false,
        mensagem: "Sala não encontrada",
      });
    }

    // --- VERIFICAR SE O ASSENTO EXISTE E PERTENCE À SALA ---
    const verificarAssentoQuery = `
            SELECT id_lugar, codigo_lugar, fileira, numero, estado_permanente, id_sala
            FROM lugares 
            WHERE id_lugar = $1 AND id_sala = $2
        `;
    const assentoResult = await conexao.query(verificarAssentoQuery, [
      id_lugar,
      id_sala,
    ]);

    if (assentoResult.rows.length === 0) {
      return res.status(404).json({
        sucesso: false,
        mensagem: "Assento não encontrado nesta sala",
      });
    }

    const assento = assentoResult.rows[0];

    // --- VERIFICAR SE O ASSENTO TEM RESERVAS ATIVAS (se for desativar) ---
    if (
      estado_permanente.toLowerCase() === "inativo" ||
      estado_permanente.toLowerCase() === "manutencao"
    ) {
      const verificarReservasQuery = `
                SELECT COUNT(*) as total
                FROM lugares_ocupados
                WHERE id_lugar = $1 
                AND status IN ('ocupado', 'reservado', 'pendente')
                AND data_reserva > NOW() - INTERVAL '2 hours'
            `;
      const reservasResult = await conexao.query(verificarReservasQuery, [
        id_lugar,
      ]);

      if (parseInt(reservasResult.rows[0].total) > 0) {
        return res.status(409).json({
          sucesso: false,
          mensagem: `Não é possível alterar o estado. O assento possui ${reservasResult.rows[0].total} reserva(s) ativa(s)`,
          reservas_ativas: parseInt(reservasResult.rows[0].total),
        });
      }
    }

    // --- ATUALIZAR ESTADO DO ASSENTO ---
    const updateQuery = `
            UPDATE lugares 
            SET estado_permanente = $1
            WHERE id_lugar = $2 AND id_sala = $3
            RETURNING id_lugar, codigo_lugar, fileira, numero, estado_permanente, id_sala
        `;

    const result = await conexao.query(updateQuery, [
      estado_permanente.toLowerCase(),
      id_lugar,
      id_sala,
    ]);

    // --- LOG DA ALTERAÇÃO (opcional) ---
    console.log(
      `Assento ${result.rows[0].codigo_lugar} da sala ${salaResult.rows[0].nome_sala} alterado para ${estado_permanente}`,
    );

    res.status(200).json({
      sucesso: true,
      mensagem: `Estado do assento atualizado com sucesso para '${estado_permanente}'`,
      assento: {
        ...result.rows[0],
        sala: {
          id_sala: salaResult.rows[0].id_sala,
          nome_sala: salaResult.rows[0].nome_sala,
        },
        estado_anterior: assento.estado_permanente,
        estado_atual: estado_permanente.toLowerCase(),
      },
    });
  } catch (error) {
    console.error("Erro ao atualizar estado do assento:", error);
    res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao atualizar estado do assento",
      erro: error.message,
    });
  }
});

/**
 * @swagger
 * /client/{id}:
 *   put:
 *     summary: Atualizar dados do cliente
 *     description: Atualiza o nome e telefone do cliente
 *     tags: [Clientes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID do cliente
 *         schema:
 *           type: string
 *           format: uuid
 *           example: "550e8400-e29b-41d4-a716-446655440000"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               nome_completo:
 *                 type: string
 *                 description: Nome completo do cliente
 *                 example: "João Silva Atualizado"
 *               telefone:
 *                 type: string
 *                 description: Número de telefone
 *                 example: "+351 912345679"
 *     responses:
 *       200:
 *         description: Cliente atualizado com sucesso
 *       400:
 *         description: Dados inválidos
 *       404:
 *         description: Cliente não encontrado
 *       500:
 *         description: Erro interno do servidor
 */

router.delete("/salas/:id", verificarToken, autorizar("funcionario", "administrador"), async (req, res) => {
  const { id } = req.params;

  try {
    // --- VALIDAR UUID ---
    const uuidRegex =
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "ID inválido. Deve ser um UUID válido.",
      });
    }

    // --- VERIFICAR SE SALA EXISTE ---
    const checkQuery = `
            SELECT id_sala, nome_sala 
            FROM salas 
            WHERE id_sala = $1
        `;
    const checkResult = await conexao.query(checkQuery, [id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        sucesso: false,
        mensagem: "Sala não encontrada",
      });
    }

    // --- VERIFICAR SE HÁ SESSÕES ATIVAS NA SALA ---
    const sessoesQuery = `
            SELECT COUNT(*) as total
            FROM sessoes 
            WHERE id_sala = $1 
            AND estado_sessao NOT IN ('cancelada', 'concluida')
        `;
    const sessoesResult = await conexao.query(sessoesQuery, [id]);

    if (parseInt(sessoesResult.rows[0].total) > 0) {
      return res.status(409).json({
        sucesso: false,
        mensagem: "Não é possível remover a sala pois possui sessões ativas",
        sessoes_ativas: parseInt(sessoesResult.rows[0].total),
      });
    }

    // --- REMOVER SALA (CASCADE REMOVE OS LUGARES) ---
    const deleteQuery = `
            DELETE FROM salas 
            WHERE id_sala = $1
            RETURNING id_sala, nome_sala
        `;
    const result = await conexao.query(deleteQuery, [id]);

    registrarLog({
      id_funcionario: req.usuario?.id_funcionario,
      accao: 'REMOVER_SALA',
      tabela_afectada: 'salas',
      registo_id: id,
      ip_origem: req.ip,
    });

    res.status(200).json({
      sucesso: true,
      mensagem: "Sala removida com sucesso",
      sala: result.rows[0],
    });
  } catch (error) {
    console.error("Erro ao remover sala:", error);
    res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao remover sala",
      erro: error.message,
    });
  }
});

// delete.js

/**
 * @swagger
 * /filme/{id}:
 *   delete:
 *     summary: Remove um filme
 *     description: Remove permanentemente um filme do sistema. Verifica se não há sessões ativas associadas.
 *     tags: [Filmes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do filme
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       200:
 *         description: Filme removido com sucesso
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
 *                   example: "Filme removido com sucesso"
 *       400:
 *         description: ID inválido
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
 *                   example: "ID inválido"
 *       401:
 *         description: Não autorizado
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
 *                   example: "Token não fornecido"
 *       404:
 *         description: Filme não encontrado
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
 *                   example: "Filme não encontrado"
 *       409:
 *         description: Filme possui sessões ativas
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
 *                   example: "Não é possível remover o filme pois possui sessões ativas"
 *                 sessoes_ativas:
 *                   type: integer
 *                   example: 3
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
 *                   example: "Erro ao remover filme"
 *                 erro:
 *                   type: string
 *                   example: "Database error"
 */

module.exports = router;
