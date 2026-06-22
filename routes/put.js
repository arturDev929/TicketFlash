const express = require("express");
const router = express.Router();
const conexao = require("../infra/conexao");
const { verificarToken } = require("../middleware/authMiddleware");
const {gerarCodigo,gerarMapaVisual,gerarSugestoes, gerarId} = require("../utils/senha");

/**
 * @swagger
 * /lugares/{id_lugar}:
 *   put:
 *     summary: Atualiza um lugar existente
 *     tags: [Lugares]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id_lugar
 *         required: true
 *         schema:
 *           type: string
 *         description: ID do lugar
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
 *                 description: Estado permanente do lugar
 *                 example: "activo"
 *     responses:
 *       200:
 *         description: Sucesso
 *       400:
 *         description: Dados inválidos
 *       401:
 *         description: Não autorizado
 *       404:
 *         description: Não encontrado
 *       500:
 *         description: Erro no servidor
 */

router.put('/lugares/:id_lugar', async (req, res) => {
    const { id_lugar } = req.params;
    const { estado_permanente } = req.body;

    const estadosValidos = ['activo', 'inactivo', 'manutencao'];
    if (!estado_permanente) {
        return res.status(400).json({
            sucesso: false,
            mensagem: "O campo estado_permanente é obrigatório"
        });
    }

    if (!estadosValidos.includes(estado_permanente)) {
        return res.status(400).json({
            sucesso: false,
            mensagem: `Estado inválido. Use: ${estadosValidos.join(', ')}`
        });
    }

    if (!id_lugar) {
        return res.status(400).json({
            sucesso: false,
            mensagem: "ID do lugar é obrigatório"
        });
    }

    try {

        const checkQuery = "SELECT id_lugar, codigo_lugar, estado_permanente FROM lugares WHERE id_lugar = $1";
        const checkResult = await conexao.query(checkQuery, [id_lugar]);

        if (checkResult.rows.length === 0) {
            return res.status(404).json({
                sucesso: false,
                mensagem: `Lugar com ID ${id_lugar} não encontrado`
            });
        }

        const updateQuery = `
            UPDATE lugares 
            SET estado_permanente = $1 
            WHERE id_lugar = $2 
            RETURNING *
        `;

        const updateResult = await conexao.query(updateQuery, [estado_permanente, id_lugar]);

        if (updateResult.rows.length === 0) {
            return res.status(404).json({
                sucesso: false,
                mensagem: "Lugar não encontrado ou não foi possível atualizar"
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
                estado_compra: lugarAtualizado.estado_compra,
                fileira: lugarAtualizado.fileira,
                numero: lugarAtualizado.numero
            }
        });

    } catch (err) {
        console.error("Erro detalhado ao atualizar lugar:", err);
        
        if (err.code === 'ECONNREFUSED') {
            return res.status(500).json({
                sucesso: false,
                mensagem: "Erro de conexão com o banco de dados"
            });
        }

        return res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao atualizar lugar",
            erro: err.message
        });
    }
});

/**
 * @swagger
 * /estadoFilme/{id_filme}:
 *   put:
 *     summary: Atualiza o estado de exibição de um filme
 *     description: Permite alterar o status de exibição de um filme específico para disponível, indisponível ou em breve
 *     tags: [Filmes]
 *     parameters:
 *       - in: path
 *         name: id_filme
 *         required: true
 *         description: UUID do filme a ser atualizado
 *         schema:
 *           type: string
 *           format: uuid
 *           example: "123e4567-e89b-12d3-a456-426614174000"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - estado_exibicao
 *             properties:
 *               estado_exibicao:
 *                 type: string
 *                 enum: [disponivel, indisponivel, brevemente]
 *                 description: Novo estado de exibição do filme
 *                 example: "disponivel"
 *           examples:
 *             disponivel:
 *               summary: Marcar como disponível
 *               value:
 *                 estado_exibicao: "disponivel"
 *             indisponivel:
 *               summary: Marcar como indisponível
 *               value:
 *                 estado_exibicao: "indisponivel"
 *             brevemente:
 *               summary: Marcar como em breve
 *               value:
 *                 estado_exibicao: "brevemente"
 *     responses:
 *       200:
 *         description: Estado do filme atualizado com sucesso
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
 *                   example: "Estado do filme atualizado com sucesso"
 *                 filme:
 *                   type: object
 *                   properties:
 *                     id_filme:
 *                       type: string
 *                       format: uuid
 *                       example: "123e4567-e89b-12d3-a456-426614174000"
 *                     titulo:
 *                       type: string
 *                       example: "O Poderoso Chefão"
 *                     estado_exibicao:
 *                       type: string
 *                       enum: [disponivel, indisponivel, brevemente]
 *                       example: "disponivel"
 *                     destaque:
 *                       type: boolean
 *                       example: false
 *       400:
 *         description: Requisição inválida - campo obrigatório faltando, valor inválido ou UUID inválido
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
 *                   example: "O campo estado_exibicao é obrigatório"
 *             examples:
 *               campoFaltando:
 *                 summary: Campo obrigatório não informado
 *                 value:
 *                   sucesso: false
 *                   mensagem: "O campo estado_exibicao é obrigatório"
 *               valorInvalido:
 *                 summary: Valor inválido para estado_exibicao
 *                 value:
 *                   sucesso: false
 *                   mensagem: "Estado inválido. Use: disponivel, indisponivel, brevemente"
 *               uuidInvalido:
 *                 summary: UUID inválido
 *                 value:
 *                   sucesso: false
 *                   mensagem: "ID do filme inválido. Deve ser um UUID válido"
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
 *                   example: "Filme com ID 123e4567-e89b-12d3-a456-426614174000 não encontrado"
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
 *                   example: "Erro ao atualizar estado do filme"
 *                 erro:
 *                   type: string
 *                   example: "Database connection error"
 */

router.put('/estadoFilme/:id_filme', async (req, res) => {
    const { id_filme } = req.params;
    const { estado_exibicao } = req.body;

    const estadosValidos = ['disponivel', 'indisponivel', 'brevemente'];

    if (!estado_exibicao) {
        return res.status(400).json({
            sucesso: false,
            mensagem: "O campo estado_exibicao é obrigatório"
        });
    }

    if (!estadosValidos.includes(estado_exibicao)) {
        return res.status(400).json({
            sucesso: false,
            mensagem: `Estado inválido. Use: ${estadosValidos.join(', ')}`
        });
    }

    const sql = `UPDATE filmes SET estado_exibicao = $1 WHERE id_filme = $2 RETURNING *`;

    conexao.query(sql, [estado_exibicao, id_filme], (err, result) => {
        if (err) {
            console.error("Erro detalhado ao atualizar estado do filme:", err);
            return res.status(500).json({
                sucesso: false,
                mensagem: "Erro ao atualizar estado do filme",
                erro: err.message
            });
        }

        if (result.rows.length === 0) {
            return res.status(404).json({
                sucesso: false,
                mensagem: `Filme com ID ${id_filme} não encontrado`
            });
        }

        return res.status(200).json({
            sucesso: true,
            mensagem: "Estado do filme atualizado com sucesso",
            filme: result.rows[0]
        });
    });
});

/**
 * @swagger
 * /destaque/{id_filme}:
 *   put:
 *     summary: Atualiza o status de destaque de um filme
 *     description: Permite definir se um filme específico aparecerá em destaque ou não
 *     tags: [Filmes]
 *     parameters:
 *       - in: path
 *         name: id_filme
 *         required: true
 *         description: UUID do filme a ser atualizado
 *         schema:
 *           type: string
 *           format: uuid
 *           example: "123e4567-e89b-12d3-a456-426614174000"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - destaque
 *             properties:
 *               destaque:
 *                 type: boolean
 *                 description: Status de destaque do filme (true/false)
 *                 example: true
 *           examples:
 *             ativarDestaque:
 *               summary: Ativar destaque para o filme
 *               value:
 *                 destaque: true
 *             desativarDestaque:
 *               summary: Desativar destaque do filme
 *               value:
 *                 destaque: false
 *     responses:
 *       200:
 *         description: Status de destaque do filme atualizado com sucesso
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
 *                   example: "Destaque do filme atualizado com sucesso"
 *                 filme:
 *                   type: object
 *                   properties:
 *                     id_filme:
 *                       type: string
 *                       format: uuid
 *                       example: "123e4567-e89b-12d3-a456-426614174000"
 *                     titulo:
 *                       type: string
 *                       example: "O Poderoso Chefão"
 *                     estado_exibicao:
 *                       type: string
 *                       enum: [disponivel, indisponivel, brevemente]
 *                       example: "disponivel"
 *                     destaque:
 *                       type: boolean
 *                       example: true
 *       400:
 *         description: Requisição inválida - campo obrigatório faltando, valor inválido ou UUID inválido
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
 *                   example: "O campo destaque é obrigatório"
 *             examples:
 *               campoFaltando:
 *                 summary: Campo obrigatório não informado
 *                 value:
 *                   sucesso: false
 *                   mensagem: "O campo destaque é obrigatório"
 *               valorInvalido:
 *                 summary: Valor inválido para destaque
 *                 value:
 *                   sucesso: false
 *                   mensagem: "Destaque inválido. Use: true ou false (boolean)"
 *               uuidInvalido:
 *                 summary: UUID inválido
 *                 value:
 *                   sucesso: false
 *                   mensagem: "ID do filme inválido. Deve ser um UUID válido"
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
 *                   example: "Filme com ID 123e4567-e89b-12d3-a456-426614174000 não encontrado"
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
 *                   example: "Erro ao atualizar destaque do filme"
 *                 erro:
 *                   type: string
 *                   example: "Database update error"
 */

router.put('/destaque/:id_filme', async (req, res) => {
    const { id_filme } = req.params;
    const { destaque } = req.body;

    // Validação do campo destaque
    if (destaque === undefined || destaque === null) {
        return res.status(400).json({
            sucesso: false,
            mensagem: "O campo destaque é obrigatório"
        });
    }

    if (typeof destaque !== 'boolean') {
        return res.status(400).json({
            sucesso: false,
            mensagem: "Destaque inválido. Use: true ou false (boolean)"
        });
    }

    // Primeiro, verificar se o filme existe e qual é o seu estado atual
    const checkSql = `SELECT estado_exibicao FROM filmes WHERE id_filme = $1`;
    
    conexao.query(checkSql, [id_filme], (checkErr, checkResult) => {
        if (checkErr) {
            console.error("Erro ao verificar estado do filme:", checkErr);
            return res.status(500).json({
                sucesso: false,
                mensagem: "Erro ao verificar estado do filme",
                erro: checkErr.message
            });
        }

        // Verificar se o filme existe
        if (checkResult.rows.length === 0) {
            return res.status(404).json({
                sucesso: false,
                mensagem: `Filme com ID ${id_filme} não encontrado`
            });
        }

        const estadoAtual = checkResult.rows[0].estado_exibicao;

        // REGRA DE NEGÓCIO: Filme indisponível NÃO pode ser destaque
        if (estadoAtual === 'indisponivel' && destaque === true) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "Não é possível marcar um filme indisponível como destaque",
                estado_atual: estadoAtual,
                destaque_solicitado: destaque
            });
        }

        // Se estiver tudo ok, prosseguir com a atualização
        const sql = `UPDATE filmes SET destaque = $1 WHERE id_filme = $2 RETURNING *`;

        conexao.query(sql, [destaque, id_filme], (err, result) => {
            if (err) {
                console.error("Erro detalhado ao atualizar destaque do filme:", err);
                return res.status(500).json({
                    sucesso: false,
                    mensagem: "Erro ao atualizar destaque do filme",
                    erro: err.message
                });
            }

            return res.status(200).json({
                sucesso: true,
                mensagem: destaque ? "Filme marcado como destaque com sucesso" : "Destaque do filme removido com sucesso",
                filme: result.rows[0]
            });
        });
    });
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
router.put('/user/:id', async (req, res) => {
    const id = req.params.id;
    const { nome, email, telefone, tipo_utilizador, estado, cargo } = req.body;
    
    if (!nome || !email) {
        return res.status(400).json({
            erro: "Nome e email são obrigatórios"
        });
    }
    
    const queryUtilizador = `
        UPDATE utilizadores 
        SET nome_completo = $1, 
            email = $2, 
            telefone = $3,
            tipo_utilizador = $4,
            estado_conta = $5
        WHERE id_utilizador = $6 
        RETURNING *
    `;
    
    conexao.query(queryUtilizador, [nome, email, telefone, tipo_utilizador, estado, id], (err, resultUtilizador) => {
        if (err) {
            return res.status(500).json({
                erro: "Erro ao atualizar utilizador",
                detalhe: err.message
            });
        }
        
        if (resultUtilizador.rows.length === 0) {
            return res.status(404).json({
                mensagem: "Utilizador não encontrado"
            });
        }
        
        // Atualizar tabela funcionarios
        const queryFuncionario = `
            UPDATE funcionarios 
            SET cargo = $1
            WHERE id_utilizador = $2 
            RETURNING *
        `;
        
        conexao.query(queryFuncionario, [cargo, id], (err, resultFuncionario) => {
            if (err) {
                return res.status(500).json({
                    erro: "Erro ao atualizar cargo do funcionário",
                    detalhe: err.message
                });
            }
            
            // Buscar dados completos atualizados
            const queryFinal = `
                SELECT * FROM utilizadores u 
                INNER JOIN funcionarios f ON u.id_utilizador = f.id_utilizador 
                WHERE u.id_utilizador = $1
            `;
            
            conexao.query(queryFinal, [id], (err, resultFinal) => {
                if (err) {
                    return res.status(500).json({
                        erro: "Erro ao buscar dados atualizados",
                        detalhe: err.message
                    });
                }
                
                res.status(200).json({
                    mensagem: "Utilizador atualizado com sucesso",
                    utilizador: resultFinal.rows[0]
                });
            });
        });
    });
});

/**
 * @swagger
 * /genero/{id}:
 *   put:
 *     summary: Atualiza um gênero
 *     description: Atualiza os dados de um gênero existente
 *     tags: [Gêneros]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID do gênero
 *         schema:
 *           type: string
 *           format: uuid
 *           example: "550e8400-e29b-41d4-a716-446655440001"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
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
 *       200:
 *         description: Gênero atualizado com sucesso
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
 *                   example: "Gênero atualizado com sucesso"
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
 *       404:
 *         description: Gênero não encontrado
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
 *                   example: "Gênero não encontrado"
 *       409:
 *         description: Conflito - nome já existe
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
 *                   example: "Erro ao atualizar gênero"
 *                 erro:
 *                   type: string
 *                   example: "Database error"
 */
router.put('/genero/:id', async (req, res) => {
    const id = req.params.id;
    const { nome_genero, descricao } = req.body;

    // --- VALIDAÇÃO ---
    if (!nome_genero || nome_genero.trim() === '') {
        return res.status(400).json({
            sucesso: false,
            mensagem: "Nome do gênero é obrigatório"
        });
    }

    try {
        // --- VERIFICAR SE GÊNERO EXISTE ---
        const verificarExistencia = `
            SELECT id_genero FROM generos WHERE id_genero = $1
        `;
        const existe = await conexao.query(verificarExistencia, [id]);

        if (existe.rows.length === 0) {
            return res.status(404).json({
                sucesso: false,
                mensagem: "Gênero não encontrado"
            });
        }

        // --- VERIFICAR SE NOME JÁ EXISTE EM OUTRO GÊNERO ---
        const verificarNome = `
            SELECT id_genero FROM generos 
            WHERE nome_genero = $1 AND id_genero != $2
        `;
        const nomeExistente = await conexao.query(verificarNome, [nome_genero.trim(), id]);

        if (nomeExistente.rows.length > 0) {
            return res.status(409).json({
                sucesso: false,
                mensagem: `Já existe um gênero com o nome '${nome_genero.trim()}'`
            });
        }

        // --- ATUALIZAR GÊNERO ---
        const sql = `
            UPDATE generos 
            SET nome_genero = $1, 
                descricao = $2
            WHERE id_genero = $3 
            RETURNING *
        `;

        const values = [
            nome_genero.trim(),
            descricao || null,
            id
        ];

        const result = await conexao.query(sql, values);

        res.status(200).json({
            sucesso: true,
            mensagem: "Gênero atualizado com sucesso",
            genero: result.rows[0]
        });

    } catch (error) {
        console.error('Erro ao atualizar gênero:', error);
        res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao atualizar gênero",
            erro: error.message
        });
    }
});

/**
 * @swagger
 * /filme/{id}:
 *   put:
 *     summary: Atualizar um filme completo
 *     description: Atualiza todos os dados de um filme existente e seus gêneros
 *     tags: [Filmes]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID do filme
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
 *                 example: "Avatar 3 - O Caminho da Água"
 *               sinopse:
 *                 type: string
 *                 description: Sinopse do filme
 *                 example: "Uma jornada épica em Pandora com novos desafios..."
 *               duracao_minuto:
 *                 type: integer
 *                 description: Duração em minutos
 *                 example: 190
 *               ano_lancamento:
 *                 type: integer
 *                 description: Ano de lançamento
 *                 example: 2025
 *               classificacao_etaria:
 *                 type: string
 *                 enum: [L, 6, 12, 14, 16, 18]
 *                 description: Classificação indicativa
 *                 example: "12"
 *               nota_media:
 *                 type: number
 *                 format: float
 *                 description: Nota média do filme
 *                 example: 8.8
 *               cartaz_url:
 *                 type: string
 *                 description: URL do cartaz do filme
 *                 example: "https://example.com/poster-novo.jpg"
 *               trailer_url:
 *                 type: string
 *                 description: URL do trailer do filme
 *                 example: "https://youtube.com/watch?v=456"
 *               id_funcionario:
 *                 type: string
 *                 format: uuid
 *                 description: ID do funcionário que atualizou
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
 *                 example: "brevemente"
 *               destaque:
 *                 type: boolean
 *                 description: Indica se o filme está em destaque
 *                 example: false
 *               id_genero:
 *                 type: array
 *                 description: Lista de IDs dos gêneros
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 example: ["550e8400-e29b-41d4-a716-446655440001", "550e8400-e29b-41d4-a716-446655440003"]
 *     responses:
 *       200:
 *         description: Filme atualizado com sucesso
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
 *                   example: "Filme atualizado com 2 gênero(s) com sucesso"
 *                 filme:
 *                   type: object
 *                   properties:
 *                     id_filme:
 *                       type: string
 *                       format: uuid
 *                       example: "550e8400-e29b-41d4-a716-446655440000"
 *                     titulo:
 *                       type: string
 *                       example: "Avatar 3 - O Caminho da Água"
 *                     sinopse:
 *                       type: string
 *                       example: "Uma jornada épica em Pandora com novos desafios..."
 *                     duracao_minuto:
 *                       type: integer
 *                       example: 190
 *                     ano_lancamento:
 *                       type: integer
 *                       example: 2025
 *                     classificacao_etaria:
 *                       type: string
 *                       example: "12"
 *                     nota_media:
 *                       type: number
 *                       example: 8.8
 *                     cartaz_url:
 *                       type: string
 *                       example: "https://example.com/poster-novo.jpg"
 *                     trailer_url:
 *                       type: string
 *                       example: "https://youtube.com/watch?v=456"
 *                     pais_origem:
 *                       type: string
 *                       example: "EUA"
 *                     idioma_original:
 *                       type: string
 *                       example: "Inglês"
 *                     estado_exibicao:
 *                       type: string
 *                       example: "brevemente"
 *                     destaque:
 *                       type: boolean
 *                       example: false
 *                     cadastrado_por:
 *                       type: string
 *                       format: uuid
 *                       example: "550e8400-e29b-41d4-a716-446655440000"
 *                     data_cadastro:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-15T10:30:00Z"
 *                     data_atualizacao:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-01-20T15:45:00Z"
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
 *                 generos_removidos:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id_genero:
 *                         type: string
 *                         format: uuid
 *                         example: "550e8400-e29b-41d4-a716-446655440002"
 *                       nome_genero:
 *                         type: string
 *                         example: "Aventura"
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
 *         description: Filme já existe com outro título/ano
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
 *                   example: "Já existe um filme com o título 'Avatar 3' e ano '2025'"
 *       500:
 *         description: Erro interno do servidor
 */
router.put('/filme/:id', async (req, res) => {
    const id_filme = req.params.id;
    const data_atualizacao = new Date();
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
    const CLASSIFICACOES_VALIDAS = ['L', '6', '12', '14', '16', '18'];
    let classificacaoFinal = classificacao_etaria || 'L';
    classificacaoFinal = String(classificacaoFinal).trim();

    if (!CLASSIFICACOES_VALIDAS.includes(classificacaoFinal)) {
        return res.status(400).json({
            sucesso: false,
            mensagem: `Classificação etária inválida. Valores permitidos: ${CLASSIFICACOES_VALIDAS.join(', ')}`,
            valor_enviado: classificacao_etaria
        });
    }

    try {
        await conexao.query('BEGIN');

        // --- VERIFICAR SE FILME EXISTE ---
        const verificarFilmeExistente = `
            SELECT id_filme FROM filmes WHERE id_filme = $1
        `;
        const filmeExistente = await conexao.query(verificarFilmeExistente, [id_filme]);

        if (filmeExistente.rows.length === 0) {
            await conexao.query('ROLLBACK');
            return res.status(404).json({
                sucesso: false,
                mensagem: "Filme não encontrado"
            });
        }

        // --- VERIFICAR SE FUNCIONÁRIO EXISTE ---
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

        // --- VERIFICAR SE JÁ EXISTE OUTRO FILME COM MESMO TÍTULO E ANO ---
        const verificarDuplicado = `
            SELECT id_filme FROM filmes 
            WHERE titulo = $1 AND ano_lancamento = $2 AND id_filme != $3
        `;
        const duplicado = await conexao.query(verificarDuplicado, [titulo.trim(), ano_lancamento, id_filme]);

        if (duplicado.rows.length > 0) {
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

        // --- ATUALIZAR FILME ---
        const sql = `
            UPDATE filmes 
            SET 
                titulo = $1,
                sinopse = $2,
                duracao_minutos = $3,
                ano_lancamento = $4,
                classificacao_etaria = $5,
                nota_media = $6,
                cartaz_url = $7,
                trailer_url = $8,
                cadastrado_por = $9,
                pais_origem = $10,
                idioma_original = $11,
                estado_exibicao = $12,
                destaque = $13
            WHERE id_filme = $14
            RETURNING *
        `;

        const values = [
            titulo.trim(),
            sinopse || null,
            duracao_minuto,
            ano_lancamento,
            classificacaoFinal,
            nota_media || 0,
            cartaz_url || null,
            trailer_url || null,
            id_funcionario,
            pais_origem || null,
            idioma_original || null,
            estado_exibicao || 'disponivel',
            destaque || false,
            id_filme
        ];

        const result = await conexao.query(sql, values);

        // --- BUSCAR GÊNEROS ATUAIS DO FILME ---
        const buscarGenerosAtuais = `
            SELECT g.id_genero, g.nome_genero 
            FROM generos g
            INNER JOIN filmes_generos fg ON g.id_genero = fg.id_genero
            WHERE fg.id_filme = $1
        `;
        const generosAtuais = await conexao.query(buscarGenerosAtuais, [id_filme]);
        const idsGenerosAtuais = generosAtuais.rows.map(g => g.id_genero);

        // --- VERIFICAR GÊNEROS A REMOVER ---
        const idsGenerosNovos = generosValidos.map(g => g.id_genero);
        const idsParaRemover = idsGenerosAtuais.filter(id => !idsGenerosNovos.includes(id));

        // --- REMOVER GÊNEROS QUE NÃO ESTÃO MAIS NA LISTA ---
        const generosRemovidos = [];
        for (const id of idsParaRemover) {
            const generoRemovido = generosAtuais.rows.find(g => g.id_genero === id);
            const sqlRemover = `
                DELETE FROM filmes_generos 
                WHERE id_filme = $1 AND id_genero = $2
                RETURNING *
            `;
            await conexao.query(sqlRemover, [id_filme, id]);
            if (generoRemovido) {
                generosRemovidos.push(generoRemovido);
            }
        }

        // --- ADICIONAR NOVOS GÊNEROS ---
        const generosAdicionados = [];
        for (const genero of generosValidos) {
            if (!idsGenerosAtuais.includes(genero.id_genero)) {
                const sqlGenero = `
                    INSERT INTO filmes_generos (id_filme, id_genero)
                    VALUES ($1, $2)
                    RETURNING *
                `;
                await conexao.query(sqlGenero, [id_filme, genero.id_genero]);
                generosAdicionados.push(genero);
            }
        }

        await conexao.query('COMMIT');

        // --- BUSCAR GÊNEROS FINAIS DO FILME ---
        const buscarGenerosFinais = `
            SELECT g.id_genero, g.nome_genero 
            FROM generos g
            INNER JOIN filmes_generos fg ON g.id_genero = fg.id_genero
            WHERE fg.id_filme = $1
            ORDER BY g.nome_genero
        `;
        const generosFinais = await conexao.query(buscarGenerosFinais, [id_filme]);

        // --- MONTAR MENSAGEM ---
        let mensagem = "Filme atualizado com sucesso";
        if (generosAdicionados.length > 0 && generosRemovidos.length > 0) {
            mensagem = `Filme atualizado com ${generosAdicionados.length} gênero(s) adicionado(s) e ${generosRemovidos.length} gênero(s) removido(s)`;
        } else if (generosAdicionados.length > 0) {
            mensagem = `Filme atualizado com ${generosAdicionados.length} gênero(s) adicionado(s)`;
        } else if (generosRemovidos.length > 0) {
            mensagem = `Filme atualizado com ${generosRemovidos.length} gênero(s) removido(s)`;
        }

        res.status(200).json({
            sucesso: true,
            mensagem: mensagem,
            filme: result.rows[0],
            generos_adicionados: generosAdicionados,
            generos_removidos: generosRemovidos,
            generos_nao_encontrados: generosInvalidos,
            todos_generos_filme: generosFinais.rows,
            total_generos: generosFinais.rows.length
        });

    } catch (error) {
        await conexao.query('ROLLBACK');
        
        console.error('Erro ao atualizar filme:', error);
        res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao atualizar filme",
            erro: error.message,
            detalhe: error.detail || null
        });
    }
});

/**
 * @swagger
 * /salas/{id}:
 *   put:
 *     summary: Atualizar uma sala e seus lugares
 *     description: Atualiza os dados da sala e gerencia automaticamente os lugares. Suporta capacidade diferente de coluna x fila.
 *     tags: [Salas]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID da sala
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
 *               nome_sala:
 *                 type: string
 *                 description: Nome da sala
 *                 example: "Sala Pequena Atualizada"
 *               capacidade_total:
 *                 type: integer
 *                 description: Capacidade total da sala
 *                 example: 12
 *               tipo_sala:
 *                 type: string
 *                 enum: [NORMAL, VIP, 3D, IMAX]
 *                 description: Tipo da sala
 *                 example: VIP
 *               estado_sala:
 *                 type: string
 *                 enum: [ATIVA, INATIVA, MANUTENCAO, operacional]
 *                 description: Estado da sala
 *                 example: ATIVA
 *               coluna:
 *                 type: integer
 *                 description: Numero de colunas por fila
 *                 example: 4
 *               fila:
 *                 type: integer
 *                 description: Numero de filas
 *                 example: 3
 *     responses:
 *       200:
 *         description: Sala atualizada com sucesso
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
 *                   example: "Sala atualizada com 12 lugares com sucesso"
 *                 sala:
 *                   type: object
 *                   properties:
 *                     id_sala:
 *                       type: string
 *                       example: "550e8400-e29b-41d4-a716-446655440000"
 *                     nome_sala:
 *                       type: string
 *                       example: "Sala Pequena Atualizada"
 *                     capacidade_total:
 *                       type: integer
 *                       example: 12
 *                     tipo_sala:
 *                       type: string
 *                       example: "VIP"
 *                     estado_sala:
 *                       type: string
 *                       example: "ATIVA"
 *                     coluna:
 *                       type: integer
 *                       example: 4
 *                     fila:
 *                       type: integer
 *                       example: 3
 *                 lugares_afetados:
 *                   type: object
 *                   properties:
 *                     adicionados:
 *                       type: integer
 *                       example: 1
 *                     removidos:
 *                       type: integer
 *                       example: 0
 *                     mantidos:
 *                       type: integer
 *                       example: 11
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
 *                       example: 12
 *                     lugares_vazios:
 *                       type: integer
 *                       example: 0
 *                     capacidade_solicitada:
 *                       type: integer
 *                       example: 12
 *                     porcentagem_ocupacao:
 *                       type: string
 *                       example: "100%"
 *                 mapa_visual:
 *                   type: string
 *                   example: "+---+---+---+---+\n| A | A1 | A2 | A3 | A4 |\n+---+---+---+---+\n| B | B1 | B2 | B3 | B4 |\n+---+---+---+---+\n| C | C1 | C2 | C3 | C4 |\n+---+---+---+---+"
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
 *       404:
 *         description: Sala nao encontrada
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
 *                   example: "Sala nao encontrada"
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
 *                   example: "Erro ao atualizar sala"
 *                 erro:
 *                   type: string
 */
router.put('/salas/:id', async (req, res) => {
    const id_sala = req.params.id;
    const {
        nome_sala,
        capacidade_total,
        tipo_sala,
        estado_sala,
        coluna,
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
                mensagem: "Sala não encontrada"
            });
        }

        // --- VERIFICAR SE JÁ EXISTE OUTRA SALA COM MESMO NOME E TIPO ---
        const verificarDuplicado = `
            SELECT id_sala FROM salas 
            WHERE nome_sala = $1 AND tipo_sala = $2 AND id_sala != $3
        `;
        const duplicado = await conexao.query(verificarDuplicado, [nome_sala.trim(), tipo_sala, id_sala]);

        if (duplicado.rows.length > 0) {
            return res.status(409).json({
                sucesso: false,
                mensagem: `Já existe uma sala com o nome "${nome_sala}" e tipo "${tipo_sala}"`,
                sala_existente: {
                    id_sala: duplicado.rows[0].id_sala
                }
            });
        }

        // --- INICIAR TRANSAÇÃO ---
        await conexao.query('BEGIN');

        // --- BUSCAR LUGARES ATUAIS ---
        const buscarLugaresAtuais = `
            SELECT id_lugar, codigo_lugar, fileira, numero, estado_permanente
            FROM lugares 
            WHERE id_sala = $1
        `;
        const lugaresAtuais = await conexao.query(buscarLugaresAtuais, [id_sala]);

        // --- GERAR NOVOS CÓDIGOS DE LUGARES ---
        const fileiras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
        const novosCodigos = new Set();
        let lugaresParaManter = 0;
        let lugaresParaRemover = 0;
        let lugaresParaAdicionar = 0;

        // Criar mapa dos lugares existentes por código
        const mapaCodigosExistentes = {};
        lugaresAtuais.rows.forEach(lugar => {
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

        for (let f = 0; f < totalFilas && lugaresInseridos < capacidade_total; f++) {
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
                        ativo: true
                    });
                    lugaresGerados.push({
                        id_lugar: lugarExistente.id_lugar,
                        codigo_lugar: lugarExistente.codigo_lugar,
                        fileira: lugarExistente.fileira,
                        numero: lugarExistente.numero,
                        estado_permanente: lugarExistente.estado_permanente,
                        ativo: true
                    });
                    linhaTemAtivos = true;
                    lugaresInseridos++;
                } else {
                    // Criar novo lugar
                    const id_lugar = gerarId();
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
                        codigo: lugarResult.rows[0].codigo,
                        ativo: true
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
                        estado_permanente: null
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
                    estado_permanente: null
                });
            }

            lugaresOrganizados.push({
                fila: letraFileira,
                lugares: linha,
                total_ativos: 0,
                total_vazios: lugaresPorFila
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
            id_sala
        ]);

        // --- COMMIT DA TRANSAÇÃO ---
        await conexao.query('COMMIT');

        // --- GERAR MAPA VISUAL ---
        const mapaVisual = gerarMapaVisual(lugaresOrganizados, lugaresPorFila);

        // --- CALCULAR ESTATÍSTICAS ---
        const lugaresVazios = totalPosicoes - lugaresInseridos;
        const porcentagemOcupacao = Math.round((lugaresInseridos / totalPosicoes) * 100);

        res.status(200).json({
            sucesso: true,
            mensagem: `Sala atualizada com ${lugaresInseridos} lugares com sucesso`,
            sala: salaAtualizada.rows[0],
            lugares_afetados: {
                adicionados: lugaresParaAdicionar,
                removidos: lugaresParaRemover,
                mantidos: lugaresParaManter
            },
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
            mapa_visual: mapaVisual
        });

    } catch (err) {
        // --- ROLLBACK EM CASO DE ERRO ---
        await conexao.query('ROLLBACK');
        
        console.error('Erro ao atualizar sala:', err);
        res.status(500).json({
            sucesso: false,
            mensagem: "Erro ao atualizar sala",
            erro: err.message
        });
    }
});


module.exports = router;