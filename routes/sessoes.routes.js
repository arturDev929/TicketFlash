const express = require("express");
const router = express.Router();
const conexao = require("../infra/conexao");

const { verificarToken, autorizar } = require("../middleware/authMiddleware");
const {
  gerarId,
} = require("../utils/senha");
const { registrarLog } = require("../utils/log");
const { v4: uuidv4 } = require("uuid");

router.get("/sessoes", (req, res) => {
  const query = `
        WITH sessao_detalhes AS (
            SELECT 
                f.id_filme,
                f.titulo,
                f.duracao_minutos,
                f.ano_lancamento,
                f.sinopse,
                f.classificacao_etaria,
                f.nota_media,
                f.cartaz_url,
                f.trailer_url,
                f.estado_exibicao,
                f.pais_origem,
                f.idioma_original,
                s.id_sessao,
                s.estado_sessao,
                s.data_hora_inicio,
                s.data_hora_fim,
                s.preco,
                sl.nome_sala,
                -- Classificar sessão como ativa ou não
                CASE 
                    WHEN s.estado_sessao NOT IN ('concluida', 'cancelada', 'Concluída', 'Cancelada', 'finalizada') 
                    THEN 'ativa'
                    ELSE 'inativa'
                END as status_sessao
            FROM filmes f 
            INNER JOIN sessoes s ON f.id_filme = s.id_filme 
            INNER JOIN salas sl ON sl.id_sala = s.id_sala 
            INNER JOIN funcionarios fr ON fr.id_funcionario = s.criado_por 
            INNER JOIN utilizadores u ON fr.id_utilizador = u.id_utilizador
        )
        SELECT 
            id_filme,
            titulo,
            duracao_minutos,
            ano_lancamento,
            sinopse,
            classificacao_etaria,
            nota_media,
            cartaz_url,
            trailer_url,
            estado_exibicao,
            pais_origem,
            idioma_original,
            -- Total de sessões
            COUNT(*) as total_sessoes,
            -- Total de sessões ativas
            COUNT(CASE WHEN status_sessao = 'ativa' THEN 1 END) as sessoes_ativas,
            -- Lista de estados únicos
            ARRAY_AGG(DISTINCT estado_sessao) as estados_sessao,
            -- Primeira e última sessão
            MIN(data_hora_inicio) as primeira_sessao,
            MAX(data_hora_fim) as ultima_sessao,
            -- Salas disponíveis
            STRING_AGG(DISTINCT nome_sala, ', ') as salas_disponiveis,
            -- Preços
            MIN(preco) as preco_minimo,
            MAX(preco) as preco_maximo
        FROM sessao_detalhes
        GROUP BY 
            id_filme,
            titulo,
            duracao_minutos,
            ano_lancamento,
            sinopse,
            classificacao_etaria,
            nota_media,
            cartaz_url,
            trailer_url,
            estado_exibicao,
            pais_origem,
            idioma_original
        ORDER BY nota_media DESC
        LIMIT 1000
    `;

  conexao.query(query, (err, results) => {
    if (err) {
      console.error("❌ Erro ao buscar filmes com sessões:", err);
      return res.status(500).json({
        erro: err.message,
      });
    }

    res.json(results.rows);
  });
});

/**
 * @swagger
 * /sessoes-completas/{id_filme}:
 *   get:
 *     summary: Busca sessões completas de um filme
 *     parameters:
 *       - in: path
 *         name: id_filme
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Sucesso
 */

router.get('/sessoes-completas/:id_filme', async (req, res) => {
    try {
        const { id_filme } = req.params;

        // Validação básica do UUID
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(id_filme)) {
            return res.status(400).json({
                success: false,
                erro: 'ID do filme inválido. Formato UUID esperado.'
            });
        }

        const query = `
    SELECT 
        f.id_filme,
        f.titulo,
        s.id_sessao,
        s.tipo_sessao,
        s.preco,
        s.observacoes,
        s.data_hora_inicio,
        s.data_hora_fim,
        s.estado_sessao,
        sl.id_sala,
        sl.nome_sala,
        sl.capacidade_total,
        sl.tipo_sala,
        sl.estado_sala,
        sl.coluna,
        sl.fila,
        -- Lugares agrupados em JSON com informações de ocupação
        json_agg(
            json_build_object(
                'id_lugar', l.id_lugar,
                'codigo_lugar', l.codigo_lugar,
                'estado_permanente', l.estado_permanente,
                'status_ocupacao', COALESCE(lo.status, 'Livre'),
                'id_ocupacao', lo.id_lo,
                'data_ocupacao', lo.data_reserva
            )
            ORDER BY l.codigo_lugar
        ) as lugares
    FROM filmes f 
    INNER JOIN sessoes s ON f.id_filme = s.id_filme 
    INNER JOIN salas sl ON sl.id_sala = s.id_sala 
    INNER JOIN lugares l ON l.id_sala = sl.id_sala 
    LEFT JOIN lugares_ocupados lo ON lo.id_sala = l.id_sala 
        AND lo.id_lugar = l.id_lugar
        AND lo.id_sessao = s.id_sessao
    WHERE f.id_filme = $1
    GROUP BY 
        f.id_filme, f.titulo,
        s.id_sessao, s.tipo_sessao, s.preco, s.observacoes, 
        s.data_hora_inicio, s.data_hora_fim, s.estado_sessao,
        sl.id_sala, sl.nome_sala, sl.capacidade_total, sl.tipo_sala, 
        sl.estado_sala, sl.coluna, sl.fila
    ORDER BY s.data_hora_inicio
`;

        const results = await conexao.query(query, [id_filme]);

        if (results.rows.length === 0) {
            return res.status(404).json({
                success: false,
                erro: 'Nenhuma sessão disponível para este filme'
            });
        }

        // Formatar a resposta
        const filmesAgrupados = results.rows.map(row => ({
            filme: {
                id: row.id_filme,
                titulo: row.titulo
            },
            sessoes: results.rows
                .filter(r => r.id_filme === row.id_filme)
                .map(sessao => ({
                    id: sessao.id_sessao,
                    tipo: sessao.tipo_sessao,
                    preco: parseFloat(sessao.preco),
                    observacoes: sessao.observacoes,
                    data_hora_inicio: sessao.data_hora_inicio,
                    data_hora_fim: sessao.data_hora_fim,
                    estado: sessao.estado_sessao,
                    sala: {
                        id: sessao.id_sala,
                        nome: sessao.nome_sala,
                        capacidade_total: sessao.capacidade_total,
                        tipo: sessao.tipo_sala,
                        estado: sessao.estado_sala,
                        configuracao: {
                            colunas: sessao.coluna,
                            filas: sessao.fila
                        }
                    },
                    lugares: sessao.lugares.map(lugar => ({
                        ...lugar,
                        // Garantir que o status de ocupação seja tratado
                        status_ocupacao: lugar.status_ocupacao || 'Livre'
                    }))
                }))
        }));

        // Remover duplicatas (pegar apenas o primeiro)
        const respostaUnica = filmesAgrupados.filter((filme, index, self) =>
            index === self.findIndex(f => f.filme.id === filme.filme.id)
        );

        res.status(200).json({
            success: true,
            data: respostaUnica[0] || { filme: null, sessoes: [] }
        });

    } catch (error) {
        console.error('Erro ao buscar sessões:', error);
        
        // Tratamento específico para erros do banco de dados
        if (error.code) {
            switch (error.code) {
                case '42P01':
                    return res.status(500).json({
                        success: false,
                        erro: 'Erro de configuração no banco de dados'
                    });
                default:
                    return res.status(500).json({
                        success: false,
                        erro: 'Erro interno no servidor'
                    });
            }
        }
        
        res.status(500).json({
            success: false,
            erro: 'Erro ao processar a requisição'
        });
    }
});

/**
 * @swagger
 * /destaque:
 *   get:
 *     summary: Lista filmes em destaque
 *     description: Retorna uma lista de filmes marcados como destaque, limitada a 50 resultados
 *     tags: [Filmes]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Número máximo de filmes a retornar
 *     responses:
 *       200:
 *         description: Lista de filmes em destaque retornada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: integer
 *                   example: 5
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Filme'
 *       500:
 *         description: Erro interno do servidor
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 erro:
 *                   type: string
 *                   example: "Database connection error"
 */

router.post('/sessoes', verificarToken, autorizar('funcionario', 'administrador'), async (req, res) => {
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
 *       - Gera QR Code com o número da factura
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
 *                       example: "FACT-20260605-1780675024383"
 *                     qr_code:
 *                       type: string
 *                       example: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
 *       400:
 *         description: Dados inválidos na requisição
 *       404:
 *         description: Sessão ou lugares não encontrados
 *       409:
 *         description: Conflito - lugares já ocupados ou sessão indisponível
 *       500:
 *         description: Erro interno do servidor
 */

router.put("/sessoes/:id", verificarToken, autorizar("funcionario", "administrador"), async (req, res) => {
  const { id } = req.params;
  const {
    id_filme,
    id_sala,
    data_hora_inicio,
    data_hora_fim,
    tipo_sessao,
    preco,
    estado_sessao,
    observacoes,
    criado_por, // ← IGNORAR este campo na atualização
  } = req.body;

  // --- VALIDAR ID ---
  if (!id) {
    return res.status(400).json({
      sucesso: false,
      mensagem: "ID da sessão é obrigatório",
    });
  }

  try {
    // --- VERIFICAR SE SESSÃO EXISTE ---
    const checkQuery = `
      SELECT id_sessao, id_sala, estado_sessao, data_hora_inicio, data_hora_fim
      FROM sessoes 
      WHERE id_sessao = $1
    `;
    const checkResult = await conexao.query(checkQuery, [id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        sucesso: false,
        mensagem: "Sessão não encontrada",
      });
    }

    const sessaoAtual = checkResult.rows[0];

    // --- CONSTRUIR QUERY DINÂMICA ---
    const updates = [];
    const values = [];
    let paramCount = 1;

    // Não permitir atualizar criado_por
    // Não permitir atualizar campos vazios

    if (id_filme !== undefined && id_filme !== null && id_filme !== "") {
      updates.push(`id_filme = $${paramCount}`);
      values.push(id_filme);
      paramCount++;
    }

    if (id_sala !== undefined && id_sala !== null && id_sala !== "") {
      // Verificar conflitos na nova sala
      if (id_sala !== sessaoAtual.id_sala) {
        const inicio = data_hora_inicio
          ? new Date(data_hora_inicio)
          : new Date(sessaoAtual.data_hora_inicio);
        const fim = data_hora_fim
          ? new Date(data_hora_fim)
          : new Date(sessaoAtual.data_hora_fim);

        const conflitoQuery = `
          SELECT id_sessao, data_hora_inicio, data_hora_fim
          FROM sessoes 
          WHERE id_sala = $1 
          AND id_sessao != $2
          AND estado_sessao NOT IN ('cancelada', 'concluida')
          AND (
            (data_hora_inicio <= $3 AND data_hora_fim >= $3) OR
            (data_hora_inicio <= $4 AND data_hora_fim >= $4) OR
            (data_hora_inicio >= $3 AND data_hora_fim <= $4)
          )
        `;
        const conflitoResult = await conexao.query(conflitoQuery, [
          id_sala,
          id,
          inicio,
          fim,
        ]);

        if (conflitoResult.rows.length > 0) {
          return res.status(409).json({
            sucesso: false,
            mensagem: "A sala selecionada já possui uma sessão neste horário",
            conflito: conflitoResult.rows[0],
          });
        }
      }

      updates.push(`id_sala = $${paramCount}`);
      values.push(id_sala);
      paramCount++;
    }

    if (
      data_hora_inicio !== undefined &&
      data_hora_inicio !== null &&
      data_hora_inicio !== ""
    ) {
      const inicio = new Date(data_hora_inicio);
      const fim = data_hora_fim
        ? new Date(data_hora_fim)
        : new Date(sessaoAtual.data_hora_fim);

      if (inicio >= fim) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "Data/hora de início deve ser anterior à data/hora de fim",
        });
      }

      updates.push(`data_hora_inicio = $${paramCount}`);
      values.push(inicio);
      paramCount++;
    }

    if (
      data_hora_fim !== undefined &&
      data_hora_fim !== null &&
      data_hora_fim !== ""
    ) {
      const inicio = data_hora_inicio
        ? new Date(data_hora_inicio)
        : new Date(sessaoAtual.data_hora_inicio);
      const fim = new Date(data_hora_fim);

      if (inicio >= fim) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "Data/hora de início deve ser anterior à data/hora de fim",
        });
      }

      updates.push(`data_hora_fim = $${paramCount}`);
      values.push(fim);
      paramCount++;
    }

    if (
      tipo_sessao !== undefined &&
      tipo_sessao !== null &&
      tipo_sessao !== ""
    ) {
      updates.push(`tipo_sessao = $${paramCount}`);
      values.push(tipo_sessao);
      paramCount++;
    }

    if (preco !== undefined && preco !== null && preco !== "") {
      const precoNum = Number(preco);
      if (precoNum <= 0) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "O preço deve ser maior que zero",
        });
      }
      updates.push(`preco = $${paramCount}`);
      values.push(precoNum);
      paramCount++;
    }

    if (
      estado_sessao !== undefined &&
      estado_sessao !== null &&
      estado_sessao !== ""
    ) {
      // Validar estado
      const estadosPermitidos = [
        "agendada",
        "em_andamento",
        "concluida",
        "cancelada",
      ];
      const estadoNormalizado = estado_sessao.toLowerCase();

      if (!estadosPermitidos.includes(estadoNormalizado)) {
        return res.status(400).json({
          sucesso: false,
          mensagem: `Estado inválido. Valores permitidos: ${estadosPermitidos.join(", ")}`,
        });
      }

      // Verificar se é permitido mudar para este estado
      const estadoAtualNormalizado = sessaoAtual.estado_sessao.toLowerCase();

      // Se o estado já é o mesmo, não faz nada
      if (estadoNormalizado !== estadoAtualNormalizado) {
        // Transições válidas — mesma regra usada em PATCH /sessoes/:id/estado
        const transicoesValidas = {
          agendada: ["em_andamento", "cancelada"],
          em_andamento: ["concluida", "cancelada"],
          concluida: [],
          cancelada: [],
        };

        if (
          !transicoesValidas[estadoAtualNormalizado]?.includes(
            estadoNormalizado,
          )
        ) {
          return res.status(409).json({
            sucesso: false,
            mensagem: `Não é possível mudar de "${estadoAtualNormalizado}" para "${estadoNormalizado}"`,
            estado_atual: estadoAtualNormalizado,
            estado_solicitado: estadoNormalizado,
            transicoes_permitidas:
              transicoesValidas[estadoAtualNormalizado] || [],
          });
        }
      }

      updates.push(`estado_sessao = $${paramCount}`);
      values.push(estadoNormalizado);
      paramCount++;
    }

    if (observacoes !== undefined) {
      updates.push(`observacoes = $${paramCount}`);
      values.push(observacoes || null);
      paramCount++;
    }

    // Se não houver atualizações
    if (updates.length === 0) {
      return res.status(400).json({
        sucesso: false,
        mensagem: "Nenhum campo para atualizar",
      });
    }

    // Adicionar data_atualizacao
    updates.push(`data_atualizacao = CURRENT_TIMESTAMP`);

    // --- EXECUTAR UPDATE ---
    values.push(id);
    const query = `
      UPDATE sessoes 
      SET ${updates.join(", ")}
      WHERE id_sessao = $${paramCount}
      RETURNING *
    `;

    console.log("📝 Query:", query);
    console.log("📝 Values:", values);

    const result = await conexao.query(query, values);

    res.status(200).json({
      sucesso: true,
      mensagem: "Sessão atualizada com sucesso",
      sessao: result.rows[0],
    });
  } catch (error) {
    console.error("Erro ao atualizar sessão:", error);
    res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao atualizar sessão",
      erro: error.message,
    });
  }
});
// put.js - Adicionar esta rota

/**
 * @swagger
 * /sessoes/{id}/estado:
 *   patch:
 *     summary: Atualiza apenas o estado de uma sessão
 *     description: Atualiza o estado de uma sessão (agendada, em_andamento, concluida, cancelada)
 *     tags: [Sessões]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID da sessão
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - estado_sessao
 *             properties:
 *               estado_sessao:
 *                 type: string
 *                 enum: [agendada, em_andamento, concluida, cancelada]
 *                 description: Novo estado da sessão
 *     responses:
 *       200:
 *         description: Estado atualizado com sucesso
 *       400:
 *         description: Estado inválido
 *       404:
 *         description: Sessão não encontrada
 *       409:
 *         description: Transição de estado inválida
 *       500:
 *         description: Erro interno do servidor
 */

router.patch("/sessoes/:id/estado", verificarToken, autorizar("funcionario", "administrador"), async (req, res) => {
  const { id } = req.params;
  const { estado_sessao } = req.body;

  if (!id) {
    return res.status(400).json({
      sucesso: false,
      mensagem: "ID da sessão é obrigatório",
    });
  }

  if (!estado_sessao) {
    return res.status(400).json({
      sucesso: false,
      mensagem: "Estado da sessão é obrigatório",
    });
  }

  const estadosPermitidos = [
    "agendada",
    "em_andamento",
    "concluida",
    "cancelada",
  ];
  const estadoNormalizado = estado_sessao.toLowerCase();

  if (!estadosPermitidos.includes(estadoNormalizado)) {
    return res.status(400).json({
      sucesso: false,
      mensagem: `Estado inválido. Valores permitidos: ${estadosPermitidos.join(", ")}`,
    });
  }

  try {
    // --- VERIFICAR SE SESSÃO EXISTE ---
    const checkQuery = `
      SELECT id_sessao, id_filme, estado_sessao, data_hora_inicio, data_hora_fim
      FROM sessoes 
      WHERE id_sessao = $1
    `;
    const checkResult = await conexao.query(checkQuery, [id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        sucesso: false,
        mensagem: "Sessão não encontrada",
      });
    }

    const sessao = checkResult.rows[0];
    const estadoAtual = sessao.estado_sessao;

    // Se o estado já é o mesmo, retorna sucesso sem fazer nada
    if (estadoAtual === estadoNormalizado) {
      return res.status(200).json({
        sucesso: true,
        mensagem: `A sessão já está no estado "${estadoNormalizado}"`,
        sessao: sessao,
        estado_anterior: estadoAtual,
        estado_novo: estadoNormalizado,
        ja_estava: true,
      });
    }

    // --- VALIDAR TRANSIÇÃO DE ESTADO ---
    const transicoesValidas = {
      agendada: ["em_andamento", "cancelada"],
      em_andamento: ["concluida", "cancelada"],
      concluida: [],
      cancelada: [],
    };

    if (!transicoesValidas[estadoAtual]?.includes(estadoNormalizado)) {
      return res.status(409).json({
        sucesso: false,
        mensagem: `Não é possível mudar de "${estadoAtual}" para "${estadoNormalizado}"`,
        estado_atual: estadoAtual,
        estado_solicitado: estadoNormalizado,
        transicoes_permitidas: transicoesValidas[estadoAtual] || [],
      });
    }

    // --- ATUALIZAR ESTADO ---
    const updateQuery = `
      UPDATE sessoes 
      SET estado_sessao = $1,
          data_atualizacao = CURRENT_TIMESTAMP
      WHERE id_sessao = $2
      RETURNING *
    `;

    const result = await conexao.query(updateQuery, [estadoNormalizado, id]);

    // Se for cancelada, liberar lugares e cancelar compras
    if (estadoNormalizado === "cancelada") {
      // Liberar lugares ocupados
      await conexao.query(
        `
        UPDATE lugares_ocupados 
        SET status = 'cancelado'
        WHERE id_sessao = $1
        AND status IN ('ocupado', 'pendente', 'reservado')
      `,
        [id],
      );

      // Cancelar compras
      await conexao.query(
        `
        UPDATE compras 
        SET estado_pagamento = 'cancelado',
            data_cancelamento = CURRENT_TIMESTAMP,
            valor_reembolsado = valor_total
        WHERE id_sessao = $1
        AND estado_pagamento != 'cancelado'
      `,
        [id],
      );

      // Cancelar bilhetes
      await conexao.query(
        `UPDATE bilhetes SET estado_uso = 'cancelado' WHERE id_sessao = $1 AND estado_uso != 'usado'`,
        [id],
      );
    }

    // --- ATUALIZAR HISTÓRICO DE EXIBIÇÃO QUANDO A SESSÃO É CONCLUÍDA ---
    if (estadoNormalizado === "concluida") {
      try {
        const metricas = await conexao.query(
          `
          SELECT
            COUNT(DISTINCT b.id_bilhete) AS total_bilhetes,
            COALESCE(SUM(c.valor_total), 0) AS receita
          FROM compras c
          LEFT JOIN bilhetes b ON b.id_compra = c.id_compra
          WHERE c.id_sessao = $1 AND c.estado_pagamento != 'cancelado'
          `,
          [id]
        );
        const { total_bilhetes, receita } = metricas.rows[0];

        const existente = await conexao.query(
          `SELECT id_historico FROM historico_exibicoes
           WHERE id_filme = $1 AND data_fim_exibicao IS NULL`,
          [sessao.id_filme || result.rows[0].id_filme]
        );

        if (existente.rows.length > 0) {
          await conexao.query(
            `UPDATE historico_exibicoes
             SET total_sessoes = total_sessoes + 1,
                 total_bilhetes_vendidos = total_bilhetes_vendidos + $2,
                 receita_total = receita_total + $3
             WHERE id_historico = $1`,
            [existente.rows[0].id_historico, total_bilhetes, receita]
          );
        } else {
          await conexao.query(
            `INSERT INTO historico_exibicoes
              (id_historico, id_filme, data_inicio_exibicao, total_sessoes, total_bilhetes_vendidos, receita_total)
             VALUES ($1, $2, CURRENT_DATE, 1, $3, $4)`,
            [gerarId(), result.rows[0].id_filme, total_bilhetes, receita]
          );
        }
      } catch (histError) {
        console.error("Aviso: falha ao atualizar histórico de exibição:", histError.message);
      }
    }

    registrarLog({
      id_funcionario: req.usuario?.id_funcionario,
      accao: `SESSAO_${estadoNormalizado.toUpperCase()}`,
      tabela_afectada: 'sessoes',
      registo_id: id,
      detalhes: { estado_anterior: estadoAtual, estado_novo: estadoNormalizado },
      ip_origem: req.ip,
    });

    res.status(200).json({
      sucesso: true,
      mensagem: `Estado da sessão atualizado para "${estadoNormalizado}"`,
      sessao: result.rows[0],
      estado_anterior: estadoAtual,
      estado_novo: estadoNormalizado,
    });
  } catch (error) {
    console.error("Erro ao atualizar estado da sessão:", error);
    res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao atualizar estado da sessão",
      erro: error.message,
    });
  }
});

/**
 * @swagger
 * /bilhetes/{id}/validar:
 *   patch:
 *     summary: Valida/usa um bilhete na entrada do cinema
 *     description: Marca um bilhete individual como utilizado (check-in na entrada). Apenas funcionário/administrador.
 *     tags: [Bilhetes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID do bilhete (ou número da factura da compra)
 *     responses:
 *       200:
 *         description: Bilhete validado com sucesso
 *       400:
 *         description: Bilhete já utilizado ou cancelado
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Bilhete não encontrado
 *       500:
 *         description: Erro interno do servidor
 */

router.delete("/sessoes/:id", verificarToken, autorizar("funcionario", "administrador"), async (req, res) => {
  const { id } = req.params;

  try {
    // --- VERIFICAR SE SESSÃO EXISTE ---
    const checkQuery = `
      SELECT id_sessao, estado_sessao, data_hora_inicio
      FROM sessoes 
      WHERE id_sessao = $1
    `;
    const checkResult = await conexao.query(checkQuery, [id]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        sucesso: false,
        mensagem: "Sessão não encontrada",
      });
    }

    const sessao = checkResult.rows[0];

    // Verificar se a sessão já foi concluída
    if (sessao.estado_sessao === "concluida") {
      return res.status(409).json({
        sucesso: false,
        mensagem: "Não é possível cancelar uma sessão que já foi concluída",
      });
    }

    // Verificar se já está cancelada
    if (sessao.estado_sessao === "cancelada") {
      return res.status(409).json({
        sucesso: false,
        mensagem: "Esta sessão já foi cancelada",
      });
    }

    // Verificar se a sessão já começou
    const agora = new Date();
    const inicioSessao = new Date(sessao.data_hora_inicio);
    if (agora >= inicioSessao) {
      return res.status(409).json({
        sucesso: false,
        mensagem:
          "Não é possível cancelar uma sessão que já começou ou está em andamento",
      });
    }

    // --- CANCELAR SESSÃO ---
    const updateQuery = `
      UPDATE sessoes 
      SET estado_sessao = 'cancelada',
          data_atualizacao = CURRENT_TIMESTAMP,
          data_cancelamento = CURRENT_TIMESTAMP
      WHERE id_sessao = $1
      RETURNING *
    `;

    const result = await conexao.query(updateQuery, [id]);

    // --- CANCELAR COMPRAS ASSOCIADAS ---
    const liberarLugares = `
      UPDATE lugares_ocupados 
      SET status = 'cancelado'
      WHERE id_sessao = $1
      AND status IN ('ocupado', 'pendente', 'reservado')
    `;
    await conexao.query(liberarLugares, [id]);

    const atualizarCompras = `
      UPDATE compras 
      SET estado_pagamento = 'cancelado',
          data_cancelamento = CURRENT_TIMESTAMP,
          valor_reembolsado = valor_total
      WHERE id_sessao = $1
      AND estado_pagamento != 'cancelado'
    `;
    await conexao.query(atualizarCompras, [id]);

    // --- CANCELAR BILHETES DAS COMPRAS DESTA SESSÃO ---
    const cancelarBilhetes = `
      UPDATE bilhetes
      SET estado_uso = 'cancelado'
      WHERE id_sessao = $1
      AND estado_uso != 'usado'
    `;
    await conexao.query(cancelarBilhetes, [id]);

    registrarLog({
      id_funcionario: req.usuario?.id_funcionario,
      accao: 'CANCELAR_SESSAO',
      tabela_afectada: 'sessoes',
      registo_id: id,
      ip_origem: req.ip,
    });

    res.status(200).json({
      sucesso: true,
      mensagem: "Sessão cancelada com sucesso",
      sessao: result.rows[0],
    });
  } catch (error) {
    console.error("Erro ao cancelar sessão:", error);
    res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao cancelar sessão",
      erro: error.message,
    });
  }
});

// delete.js

/**
 * @swagger
 * /salas/{id}:
 *   delete:
 *     summary: Remove uma sala
 *     description: Remove permanentemente uma sala do sistema. Verifica se não há sessões ativas associadas.
 *     tags: [Salas]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID da sala
 *         example: "550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       200:
 *         description: Sala removida com sucesso
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
 *                   example: "Sala removida com sucesso"
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
 *         description: Sala não encontrada
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
 *                   example: "Sala não encontrada"
 *       409:
 *         description: Sala possui sessões ativas
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
 *                   example: "Não é possível remover a sala pois possui sessões ativas"
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
 *                   example: "Erro ao remover sala"
 *                 erro:
 *                   type: string
 *                   example: "Database error"
 */

module.exports = router;
