const express = require("express");
const router = express.Router();
const conexao = require("../infra/conexao");

const { verificarToken, autorizar } = require("../middleware/authMiddleware");
const { v4: uuidv4 } = require("uuid");
const QRCode = require('qrcode');

router.get('/compras/estatisticas', verificarToken, autorizar('funcionario', 'administrador'), async (req, res) => {
    const { periodo = 'todos', data_referencia } = req.query;
    
    // Data de referência: hoje se não for informada
    const dataRef = data_referencia ? new Date(data_referencia) : new Date();
    const ano = dataRef.getFullYear();
    const mes = String(dataRef.getMonth() + 1).padStart(2, '0');
    const dia = String(dataRef.getDate()).padStart(2, '0');
    const dataStr = `${ano}-${mes}-${dia}`;

    try {
        // --- 1. QUERY BASE ---
        let whereClause = '';
        let params = [];

        switch (periodo) {
            case 'dia':
                whereClause = `WHERE DATE(c.data_compra) = $1`;
                params = [dataStr];
                break;
            case 'semana':
                whereClause = `WHERE DATE(c.data_compra) >= DATE($1) - INTERVAL '6 days' AND DATE(c.data_compra) <= DATE($1)`;
                params = [dataStr];
                break;
            case 'mes':
                whereClause = `WHERE EXTRACT(YEAR FROM c.data_compra) = $1 AND EXTRACT(MONTH FROM c.data_compra) = $2`;
                params = [ano, mes];
                break;
            case 'ano':
                whereClause = `WHERE EXTRACT(YEAR FROM c.data_compra) = $1`;
                params = [ano];
                break;
            case 'todos':
            default:
                whereClause = '';
                params = [];
                break;
        }

        // --- 2. ESTATÍSTICAS GERAIS ---
        const estatisticasQuery = `
            SELECT 
                COUNT(*) as total_compras,
                COALESCE(SUM(valor_total), 0) as valor_total,
                COALESCE(AVG(valor_total), 0) as media_por_compra,
                MIN(data_compra) as primeira_compra,
                MAX(data_compra) as ultima_compra
            FROM compras c
            ${whereClause}
        `;

        const estatisticasResult = await conexao.query(estatisticasQuery, params);

        // --- 3. TOTAL GERAL (sem filtros) ---
        const totalGeralQuery = `
            SELECT 
                COUNT(*) as total_compras,
                COALESCE(SUM(valor_total), 0) as valor_total
            FROM compras
        `;
        const totalGeralResult = await conexao.query(totalGeralQuery);

        // --- 4. POR FORMA DE PAGAMENTO ---
        const porFormaPagamentoQuery = `
            SELECT 
                forma_pagamento,
                COUNT(*) as total,
                COALESCE(SUM(valor_total), 0) as valor_total
            FROM compras c
            ${whereClause}
            GROUP BY forma_pagamento
            ORDER BY total DESC
        `;
        const porFormaPagamentoResult = await conexao.query(porFormaPagamentoQuery, params);

        // --- 5. POR ESTADO DE PAGAMENTO ---
        const porEstadoQuery = `
            SELECT 
                estado_pagamento,
                COUNT(*) as total,
                COALESCE(SUM(valor_total), 0) as valor_total
            FROM compras c
            ${whereClause}
            GROUP BY estado_pagamento
            ORDER BY total DESC
        `;
        const porEstadoResult = await conexao.query(porEstadoQuery, params);

        // --- 6. ÚLTIMAS COMPRAS (10) ---
        const ultimasComprasQuery = `
            SELECT 
                id_compra,
                id_cliente,
                data_compra,
                valor_total,
                forma_pagamento,
                estado_pagamento,
                numero_factura
            FROM compras c
            ${whereClause}
            ORDER BY data_compra DESC
            LIMIT 10
        `;
        const ultimasComprasResult = await conexao.query(ultimasComprasQuery, params);

        // --- 7. COMPRAS POR DIA (últimos 30 dias) ---
        const porDiaQuery = `
            SELECT 
                DATE(data_compra) as data,
                COUNT(*) as total_compras,
                COALESCE(SUM(valor_total), 0) as valor_total
            FROM compras c
            WHERE data_compra >= CURRENT_DATE - INTERVAL '30 days'
            GROUP BY DATE(data_compra)
            ORDER BY data DESC
        `;
        const porDiaResult = await conexao.query(porDiaQuery);

        // --- 8. COMPRAS POR MÊS (últimos 12 meses) ---
        const porMesQuery = `
            SELECT 
                TO_CHAR(data_compra, 'YYYY-MM') as mes,
                COUNT(*) as total_compras,
                COALESCE(SUM(valor_total), 0) as valor_total
            FROM compras c
            WHERE data_compra >= CURRENT_DATE - INTERVAL '12 months'
            GROUP BY TO_CHAR(data_compra, 'YYYY-MM')
            ORDER BY mes DESC
        `;
        const porMesResult = await conexao.query(porMesQuery);

        // --- 9. RESPOSTA ---
        const estatisticas = estatisticasResult.rows[0] || {
            total_compras: 0,
            valor_total: 0,
            media_por_compra: 0
        };

        // Montar mensagem descritiva
        let mensagemPeriodo = '';
        switch (periodo) {
            case 'dia':
                mensagemPeriodo = `Dia ${dataStr}`;
                break;
            case 'semana':
                const dataInicio = new Date(dataRef);
                dataInicio.setDate(dataInicio.getDate() - 6);
                const dataFim = dataRef;
                mensagemPeriodo = `Semana de ${dataInicio.toISOString().split('T')[0]} a ${dataFim.toISOString().split('T')[0]}`;
                break;
            case 'mes':
                mensagemPeriodo = `Mês ${mes}/${ano}`;
                break;
            case 'ano':
                mensagemPeriodo = `Ano ${ano}`;
                break;
            case 'todos':
            default:
                mensagemPeriodo = 'Todos os períodos';
                break;
        }

        res.status(200).json({
            sucesso: true,
            mensagem: `Estatísticas de compras - ${mensagemPeriodo}`,
            total_geral: {
                compras: parseInt(totalGeralResult.rows[0]?.total_compras || 0),
                valor_total: parseFloat(totalGeralResult.rows[0]?.valor_total || 0)
            },
            periodo: {
                tipo: periodo,
                data_referencia: dataStr,
                total_compras: parseInt(estatisticas.total_compras || 0),
                valor_total: parseFloat(estatisticas.valor_total || 0),
                media_por_compra: parseFloat(estatisticas.media_por_compra || 0),
                primeira_compra: estatisticas.primeira_compra,
                ultima_compra: estatisticas.ultima_compra
            },
            por_forma_pagamento: porFormaPagamentoResult.rows.map(row => ({
                forma_pagamento: row.forma_pagamento,
                total: parseInt(row.total),
                valor_total: parseFloat(row.valor_total),
                percentual: estatisticas.total_compras > 0 
                    ? Math.round((row.total / estatisticas.total_compras) * 100) 
                    : 0
            })),
            por_estado: porEstadoResult.rows.map(row => ({
                estado_pagamento: row.estado_pagamento,
                total: parseInt(row.total),
                valor_total: parseFloat(row.valor_total),
                percentual: estatisticas.total_compras > 0 
                    ? Math.round((row.total / estatisticas.total_compras) * 100) 
                    : 0
            })),
            ultimas_compras: ultimasComprasResult.rows.map(row => ({
                id_compra: row.id_compra,
                id_cliente: row.id_cliente,
                data_compra: row.data_compra,
                valor_total: parseFloat(row.valor_total),
                forma_pagamento: row.forma_pagamento,
                estado_pagamento: row.estado_pagamento,
                numero_factura: row.numero_factura
            })),
            tendencia: {
                por_dia: porDiaResult.rows.map(row => ({
                    data: row.data,
                    total_compras: parseInt(row.total_compras),
                    valor_total: parseFloat(row.valor_total)
                })),
                por_mes: porMesResult.rows.map(row => ({
                    mes: row.mes,
                    total_compras: parseInt(row.total_compras),
                    valor_total: parseFloat(row.valor_total)
                }))
            }
        });

    } catch (error) {
        console.error('Erro ao buscar estatísticas:', error);
        res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao buscar estatísticas",
            erro: error.message
        });
    }
});

/**
 * @swagger
 * /client/{id}:
 *   get:
 *     summary: Buscar cliente por ID
 *     description: Retorna os dados de um cliente específico pelo ID
 *     tags: [Clientes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID do cliente (UUID)
 *         schema:
 *           type: string
 *           format: uuid
 *           example: "550e8400-e29b-41d4-a716-446655440000"
 *     responses:
 *       200:
 *         description: Cliente encontrado com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sucesso:
 *                   type: boolean
 *                   example: true
 *                 cliente:
 *                   type: object
 *                   properties:
 *                     id_utilizador:
 *                       type: string
 *                       format: uuid
 *                       example: "550e8400-e29b-41d4-a716-446655440000"
 *                     nome_completo:
 *                       type: string
 *                       example: "João Silva"
 *                     email:
 *                       type: string
 *                       format: email
 *                       example: "joao.silva@email.com"
 *                     telefone:
 *                       type: string
 *                       example: "+351 912345678"
 *                     tipo_utilizador:
 *                       type: string
 *                       example: "cliente"
 *                     estado_conta:
 *                       type: string
 *                       example: "ativo"
 *                     data_cadastro:
 *                       type: string
 *                       format: date-time
 *                       example: "2026-06-22T10:30:00.000Z"
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
 *       404:
 *         description: Cliente não encontrado
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
 *                   example: "Cliente não encontrado"
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
 *                   example: "Erro ao buscar cliente"
 *                 erro:
 *                   type: string
 *                   example: "Database error"
 */

router.get('/compras', verificarToken, autorizar('funcionario', 'administrador'), async (req, res) => {
    try {
        const sql = `
            SELECT 
                c.numero_factura AS codigo,
                c.data_compra,
                u.nome_completo,
                s.estado_sessao,
                COUNT(lo.id_lugar) AS total_lugares,
                STRING_AGG(l.codigo_lugar, ', ' ORDER BY l.codigo_lugar) AS lugares,
                c.valor_total
            FROM compras c 
            INNER JOIN utilizadores u ON c.id_cliente = u.id_utilizador 
            INNER JOIN lugares_ocupados lo ON lo.id_compra = c.id_compra
            INNER JOIN sessoes s ON s.id_sessao = c.id_sessao
            INNER JOIN lugares l ON l.id_lugar = lo.id_lugar
            GROUP BY 
                c.numero_factura, 
                c.data_compra, 
                u.nome_completo, 
                s.estado_sessao,
                c.valor_total
            ORDER BY c.data_compra DESC
        `;

        const result = await conexao.query(sql);

        res.status(200).json({
            sucesso: true,
            total: result.rows.length,
            compras: result.rows
        });

    } catch (error) {
        console.error('Erro ao buscar compras:', error);
        res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao buscar compras",
            erro: error.message
        });
    }
});


// get.js

router.get('/cliente/:id/compras', verificarToken, async (req, res) => {
    const id_cliente = req.params.id;

    const solicitante = req.usuario;
    const podeVerQualquerPerfil = solicitante && (solicitante.tipo === 'funcionario' || solicitante.tipo === 'administrador');
    if (!podeVerQualquerPerfil && solicitante?.id !== id_cliente) {
        return res.status(403).json({
            sucesso: false,
            mensagem: 'Acesso negado'
        });
    }

    try {
        // --- VERIFICAR SE CLIENTE EXISTE ---
        const verificarCliente = `
            SELECT id_utilizador, nome_completo, email 
            FROM utilizadores 
            WHERE id_utilizador = $1
        `;
        const clienteResult = await conexao.query(verificarCliente, [id_cliente]);

        if (clienteResult.rows.length === 0) {
            return res.status(404).json({
                sucesso: false,
                mensagem: "Cliente não encontrado"
            });
        }

        const cliente = clienteResult.rows[0];

        // --- BUSCAR COMPRAS DO CLIENTE ---
        const sql = `
            SELECT 
                c.id_compra,
                c.numero_factura AS codigo,
                c.data_compra,
                f.titulo AS filme,
                sl.nome_sala AS sala,
                s.data_hora_inicio AS data_hora_sessao,
                s.estado_sessao,
                json_agg(
                    json_build_object(
                        'codigo_lugar', l.codigo_lugar,
                        'fileira', l.fileira,
                        'numero', l.numero
                    ) ORDER BY l.codigo_lugar
                ) AS lugares,
                COUNT(lo.id_lugar) AS total_lugares,
                c.valor_total,
                c.forma_pagamento,
                c.estado_pagamento,
                c.qr_code
            FROM compras c 
            INNER JOIN utilizadores u ON c.id_cliente = u.id_utilizador 
            INNER JOIN lugares_ocupados lo ON lo.id_compra = c.id_compra
            INNER JOIN sessoes s ON s.id_sessao = c.id_sessao
            INNER JOIN salas sl ON sl.id_sala = s.id_sala
            INNER JOIN lugares l ON l.id_lugar = lo.id_lugar
            INNER JOIN filmes f ON f.id_filme = s.id_filme
            WHERE u.id_utilizador = $1
            GROUP BY 
                c.id_compra,
                c.numero_factura, 
                c.data_compra, 
                f.titulo,
                sl.nome_sala,
                s.data_hora_inicio,
                s.estado_sessao,
                c.valor_total,
                c.forma_pagamento,
                c.estado_pagamento,
                c.qr_code
            ORDER BY c.data_compra DESC
        `;

        const result = await conexao.query(sql, [id_cliente]);

        res.status(200).json({
            sucesso: true,
            cliente: {
                id_cliente: cliente.id_utilizador,
                nome_completo: cliente.nome_completo,
                email: cliente.email
            },
            total_compras: result.rows.length,
            compras: result.rows
        });

    } catch (error) {
        console.error('Erro ao buscar compras do cliente:', error);
        res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao buscar compras do cliente",
            erro: error.message
        });
    }
});

// get.js - VERSÃO CORRIGIDA
/**
 * @swagger
 * /salas:
 *   get:
 *     summary: Lista todas as salas
 *     description: Retorna uma lista de todas as salas cadastradas
 *     tags: [Salas]
 *     responses:
 *       200:
 *         description: Lista de salas retornada com sucesso
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sucesso:
 *                   type: boolean
 *                   example: true
 *                 total:
 *                   type: integer
 *                   example: 5
 *                 salas:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id_sala:
 *                         type: string
 *                         format: uuid
 *                       nome_sala:
 *                         type: string
 *                       capacidade_total:
 *                         type: integer
 *                       tipo_sala:
 *                         type: string
 *                       estado_sala:
 *                         type: string
 *                       coluna:
 *                         type: integer
 *                       fila:
 *                         type: integer
 *       500:
 *         description: Erro interno do servidor
 */

router.get('/bilhetes/:id', verificarToken, autorizar('funcionario', 'administrador'), async (req, res) => {
    const { id } = req.params;
    try {
        const query = `
            SELECT
                b.id_bilhete, b.preco_pago, b.tipo_bilhete, b.estado_uso, b.data_uso,
                c.id_compra, c.numero_factura, c.id_cliente,
                u.nome_completo AS cliente_nome,
                s.id_sessao, s.data_hora_inicio, s.data_hora_fim,
                f.titulo AS filme_titulo,
                STRING_AGG(l.codigo_lugar, ', ' ORDER BY l.codigo_lugar) AS lugares
            FROM bilhetes b
            JOIN compras c ON c.id_compra = b.id_compra
            JOIN utilizadores u ON u.id_utilizador = c.id_cliente
            JOIN sessoes s ON s.id_sessao = b.id_sessao
            JOIN filmes f ON f.id_filme = s.id_filme
            LEFT JOIN bilhetes_lugares bl ON bl.id_bilhete = b.id_bilhete
            LEFT JOIN lugares l ON l.id_lugar = bl.id_lugar
            WHERE b.id_bilhete = $1 OR c.numero_factura = $1 OR c.id_compra = $1
            GROUP BY b.id_bilhete, c.id_compra, c.numero_factura, c.id_cliente,
                     u.nome_completo, s.id_sessao, s.data_hora_inicio, s.data_hora_fim, f.titulo
        `;
        const result = await conexao.query(query, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                sucesso: false,
                mensagem: "Nenhum bilhete encontrado"
            });
        }

        res.status(200).json({
            sucesso: true,
            total: result.rows.length,
            bilhetes: result.rows
        });
    } catch (error) {
        console.error('Erro ao buscar bilhetes:', error);
        res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao buscar bilhetes",
            erro: error.message
        });
    }
});

/**
 * @swagger
 * /logs:
 *   get:
 *     summary: Lista o histórico de ações dos funcionários (auditoria)
 *     description: Consulta a tabela logs_funcionarios, com o nome de quem fez a ação. Apenas funcionário/administrador.
 *     tags: [Logs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limite
 *         schema:
 *           type: integer
 *         description: Número máximo de registos a devolver (padrão 100, máximo 500)
 *     responses:
 *       200:
 *         description: Lista de logs
 *       401:
 *         description: Não autenticado
 *       403:
 *         description: Sem permissão
 *       500:
 *         description: Erro interno do servidor
 */

router.post('/compras', verificarToken, async (req, res) => {
    let {
        id_cliente,
        forma_pagamento,
        sessao_id,
        lugares
    } = req.body;

    // ✅ Um cliente só pode comprar em seu próprio nome.
    // Apenas funcionário/administrador podem registar uma compra para outro cliente (ex.: balcão).
    if (req.usuario.tipo === 'cliente') {
        id_cliente = req.usuario.id;
    }

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
            AND estado_permanente = 'ativo'
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
            AND l.estado_permanente = 'ativo'
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

        // 6. Gerar número de factura no formato FACT-YYYYMMDD-TIMESTAMP
        const dataAtual = new Date();
        const ano = dataAtual.getFullYear();
        const mes = String(dataAtual.getMonth() + 1).padStart(2, '0');
        const dia = String(dataAtual.getDate()).padStart(2, '0');
        const timestamp = Date.now(); // Timestamp em milissegundos
        const numeroFactura = `FACT-${ano}${mes}${dia}-${timestamp}`;

        // 7. Gerar QR Code com o número da factura
        // O QR Code vai armazenar apenas o número da factura
        // Quando escaneado, vai mostrar: "FACT-20260620-1742073511437"
        let qrCodeBase64 = '';
        try {
            // Gerar QR Code como imagem PNG em Base64
            const qrCodeBuffer = await QRCode.toBuffer(numeroFactura, {
                type: 'png',
                width: 300,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            });
            qrCodeBase64 = qrCodeBuffer.toString('base64');
        } catch (qrError) {
            console.error('Erro ao gerar QR Code:', qrError);
            // Fallback: armazenar o número da factura em texto simples
            qrCodeBase64 = Buffer.from(numeroFactura).toString('base64');
        }

        // Formato final: data:image/png;base64,{codigo}
        const qrCode = `data:image/png;base64,${qrCodeBase64}`;

        // 8. Inserir compra
        const insertCompraQuery = `
            INSERT INTO compras (
                id_compra,
                id_cliente,
                id_sessao,
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
            sessao_id,
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

        // 9b. Inserir um bilhete individual por lugar comprado
        const insertBilheteQuery = `
            INSERT INTO bilhetes (
                id_bilhete,
                id_compra,
                id_sessao,
                preco_pago,
                tipo_bilhete,
                estado_uso
            ) VALUES ($1, $2, $3, $4, $5, 'nao_usado')
            RETURNING *
        `;
        const insertBilheteLugarQuery = `
            INSERT INTO bilhetes_lugares (id_bilhete, id_lugar)
            VALUES ($1, $2)
        `;

        const bilhetesInseridos = [];

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

            const id_bilhete = uuidv4();
            const tipoBilhete = lugar.tipo_bilhete || 'normal';
            const bilheteResult = await conexao.query(insertBilheteQuery, [
                id_bilhete,
                id_compra,
                sessao_id,
                preco,
                tipoBilhete
            ]);
            await conexao.query(insertBilheteLugarQuery, [id_bilhete, lugar.id_lugar]);
            bilhetesInseridos.push(bilheteResult.rows[0]);
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
                bilhetes: bilhetesInseridos,
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

router.put("/ingressos/:id/cancelar", verificarToken, async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({
      sucesso: false,
      mensagem: "ID da compra ou número da factura é obrigatório",
    });
  }

  try {
    // --- BUSCAR COMPRA ---
    const compraQuery = `
            SELECT c.id_compra, 
                   c.numero_factura, 
                   c.estado_pagamento, 
                   c.valor_total,
                   c.id_sessao,
                   s.data_hora_inicio,
                   s.estado_sessao
            FROM compras c
            INNER JOIN sessoes s ON s.id_sessao = c.id_sessao
            WHERE c.numero_factura = $1 OR c.id_compra = $1
        `;
    const compraResult = await conexao.query(compraQuery, [id]);

    if (compraResult.rows.length === 0) {
      return res.status(404).json({
        sucesso: false,
        mensagem: "Ingresso não encontrado",
      });
    }

    const compra = compraResult.rows[0];

    // ✅ Só o cliente dono da compra ou um funcionário/administrador pode cancelar
    const solicitante = req.usuario;
    const ehStaff = solicitante && (solicitante.tipo === "funcionario" || solicitante.tipo === "administrador");
    if (!ehStaff) {
      const donoQuery = await conexao.query(
        "SELECT id_cliente FROM compras WHERE id_compra = $1",
        [compra.id_compra]
      );
      if (donoQuery.rows[0]?.id_cliente !== solicitante?.id) {
        return res.status(403).json({ sucesso: false, mensagem: "Acesso negado" });
      }
    }

    // Verificar se já foi cancelado
    if (compra.estado_pagamento === "cancelado") {
      return res.status(409).json({
        sucesso: false,
        mensagem: "Este ingresso já foi cancelado",
      });
    }

    // Verificar se a sessão já passou
    const agora = new Date();
    const inicioSessao = new Date(compra.data_hora_inicio);
    if (agora >= inicioSessao) {
      return res.status(409).json({
        sucesso: false,
        mensagem: "Não é possível cancelar ingressos para sessões já iniciadas",
      });
    }

    // Verificar se a sessão foi cancelada
    if (compra.estado_sessao === "cancelada") {
      return res.status(409).json({
        sucesso: false,
        mensagem:
          "Esta sessão foi cancelada. O reembolso será processado automaticamente.",
      });
    }

    // --- CANCELAR COMPRA ---
    const updateCompraQuery = `
            UPDATE compras 
            SET estado_pagamento = 'cancelado',
                data_cancelamento = CURRENT_TIMESTAMP,
                valor_reembolsado = valor_total
            WHERE id_compra = $1
            RETURNING *
        `;
    const compraAtualizada = await conexao.query(updateCompraQuery, [
      compra.id_compra,
    ]);

    // --- LIBERAR LUGARES ---
    // ✅ codigo_lugar pertence à tabela lugares, não a lugares_ocupados: usar JOIN via UPDATE...FROM
    const liberarLugaresQuery = `
            UPDATE lugares_ocupados lo
            SET status = 'cancelado'
            FROM lugares l
            WHERE lo.id_lugar = l.id_lugar
            AND lo.id_compra = $1
            RETURNING lo.id_lugar, l.codigo_lugar
        `;
    const lugaresLiberados = await conexao.query(liberarLugaresQuery, [
      compra.id_compra,
    ]);

    // --- CANCELAR BILHETES DA COMPRA ---
    await conexao.query(
      `UPDATE bilhetes SET estado_uso = 'cancelado' WHERE id_compra = $1 AND estado_uso != 'usado'`,
      [compra.id_compra]
    );

    res.status(200).json({
      sucesso: true,
      mensagem: "Ingresso cancelado com sucesso",
      compra: compraAtualizada.rows[0],
      lugares_liberados: lugaresLiberados.rows,
      reembolso: {
        valor: compra.valor_total,
        data: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Erro ao cancelar ingresso:", error);
    res.status(500).json({
      sucesso: false,
      mensagem: "Erro ao cancelar ingresso",
      erro: error.message,
    });
  }
});

// put.js - Adicionar no final do arquivo, antes de module.exports

// put.js - Rota PUT /sessoes/:id

/**
 * @swagger
 * /sessoes/{id}:
 *   put:
 *     summary: Atualiza uma sessão existente
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id_filme:
 *                 type: string
 *                 format: uuid
 *               id_sala:
 *                 type: string
 *                 format: uuid
 *               data_hora_inicio:
 *                 type: string
 *                 format: date-time
 *               data_hora_fim:
 *                 type: string
 *                 format: date-time
 *               tipo_sessao:
 *                 type: string
 *               preco:
 *                 type: number
 *               estado_sessao:
 *                 type: string
 *               observacoes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Sessão atualizada com sucesso
 *       400:
 *         description: Dados inválidos
 *       404:
 *         description: Sessão não encontrada
 */

router.patch(
  "/bilhetes/:id/validar",
  verificarToken,
  autorizar("funcionario", "administrador"),
  async (req, res) => {
    const { id } = req.params;

    try {
      // Aceita tanto o id_bilhete como o número da factura da compra a que pertence
      const buscarQuery = `
        SELECT b.id_bilhete, b.estado_uso, b.id_sessao, s.data_hora_inicio
        FROM bilhetes b
        JOIN compras c ON c.id_compra = b.id_compra
        JOIN sessoes s ON s.id_sessao = b.id_sessao
        WHERE b.id_bilhete = $1 OR c.numero_factura = $1
      `;
      const bilheteResult = await conexao.query(buscarQuery, [id]);

      if (bilheteResult.rows.length === 0) {
        return res.status(404).json({
          sucesso: false,
          mensagem: "Bilhete não encontrado",
        });
      }

      const bilhete = bilheteResult.rows[0];

      if (bilhete.estado_uso === "usado") {
        return res.status(409).json({
          sucesso: false,
          mensagem: "Este bilhete já foi utilizado",
        });
      }

      if (bilhete.estado_uso === "cancelado") {
        return res.status(409).json({
          sucesso: false,
          mensagem: "Este bilhete foi cancelado e não pode ser utilizado",
        });
      }

      const updateResult = await conexao.query(
        `UPDATE bilhetes
         SET estado_uso = 'usado', data_uso = CURRENT_TIMESTAMP
         WHERE id_bilhete = $1
         RETURNING *`,
        [bilhete.id_bilhete]
      );

      res.status(200).json({
        sucesso: true,
        mensagem: "Bilhete validado com sucesso",
        bilhete: updateResult.rows[0],
      });
    } catch (error) {
      console.error("Erro ao validar bilhete:", error);
      res.status(500).json({
        sucesso: false,
        mensagem: "Erro ao validar bilhete",
        erro: error.message,
      });
    }
  }
);

module.exports = router;
