const fs = require("fs");
const path = require("path");
const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");

/**
 * Verifica se o schema da aplicação já existe na base de dados ligada
 * (procura pela tabela "utilizadores") e, se não existir, cria tudo
 * automaticamente a partir de database/schema.sql.
 *
 * Importante: no Supabase, cada projeto já vem com uma base de dados
 * chamada "postgres" criada por padrão — o que normalmente falta num
 * projeto novo não é "a base de dados" em si, mas sim as TABELAS
 * (o schema). É isso que esta função cria.
 */
async function garantirSchema(pool) {
  const client = await pool.connect();
  try {
    const verificacao = await client.query(
      `SELECT to_regclass('public.utilizadores') AS existe`
    );

    if (verificacao.rows[0].existe) {
      console.log("✅ Schema já existe — nenhuma criação necessária.");
      return;
    }

    console.log(
      "⚠️  Tabela 'utilizadores' não encontrada. A criar o schema automaticamente..."
    );

    const schemaPath = path.join(__dirname, "..", "database", "schema.sql");
    const schemaSql = fs.readFileSync(schemaPath, "utf-8");

    // node-pg executa múltiplos comandos separados por ';' numa única
    // chamada quando não há parâmetros ($1, $2, ...) — usa o "simple query
    // protocol", suficiente para um script de DDL como este.
    await client.query(schemaSql);

    console.log("✅ Schema criado com sucesso a partir de database/schema.sql.");
  } catch (error) {
    console.error("❌ Erro ao verificar/criar o schema da base de dados:", error.message);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * POST /register agora exige um "administrador" já autenticado — o que é
 * ótimo para segurança, mas cria um problema de "ovo e galinha" numa base
 * de dados nova: não existe nenhum administrador para criar o primeiro.
 *
 * Se as variáveis ADMIN_BOOTSTRAP_EMAIL / ADMIN_BOOTSTRAP_PASSWORD estiverem
 * definidas no .env e ainda não existir NENHUM administrador na base de
 * dados, esta função cria esse primeiro administrador automaticamente.
 *
 * Depois de confirmar que consegue entrar, recomenda-se remover essas
 * variáveis do .env (ou trocar a password pelo próprio painel).
 */
async function garantirAdminInicial(pool) {
  const email = process.env.ADMIN_BOOTSTRAP_EMAIL;
  const senha = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  const nome = process.env.ADMIN_BOOTSTRAP_NOME || "Administrador";

  if (!email || !senha) {
    console.log(
      "ℹ️  ADMIN_BOOTSTRAP_EMAIL/ADMIN_BOOTSTRAP_PASSWORD não definidos — a saltar criação de admin inicial."
    );
    return;
  }

  const client = await pool.connect();
  try {
    const existente = await client.query(
      `SELECT id_utilizador FROM utilizadores WHERE tipo_utilizador = 'administrador' LIMIT 1`
    );

    if (existente.rows.length > 0) {
      console.log("✅ Já existe um administrador — a saltar criação automática.");
      return;
    }

    const jaTemEsseEmail = await client.query(
      `SELECT id_utilizador FROM utilizadores WHERE email = $1`,
      [email]
    );
    if (jaTemEsseEmail.rows.length > 0) {
      console.log(
        `⚠️  Já existe um utilizador com o email ${email}, mas nenhum administrador. Verifique manualmente.`
      );
      return;
    }

    const id_utilizador = uuidv4();
    const id_funcionario = uuidv4();
    const senhaHash = await bcrypt.hash(senha, 10);

    await client.query("BEGIN");
    await client.query(
      `INSERT INTO utilizadores
         (id_utilizador, nome_completo, email, senha_hash, tipo_utilizador, estado_conta, data_cadastro)
       VALUES ($1, $2, $3, $4, 'administrador', 'ativo', CURRENT_TIMESTAMP)`,
      [id_utilizador, nome, email, senhaHash]
    );
    await client.query(
      `INSERT INTO funcionarios (id_funcionario, id_utilizador, cargo, numero_funcionario)
       VALUES ($1, $2, $3, $4)`,
      [id_funcionario, id_utilizador, "Administrador", "ADMIN-0001"]
    );
    await client.query("COMMIT");

    console.log(`✅ Administrador inicial criado com sucesso: ${email}`);
    console.log(
      "   Recomenda-se remover ADMIN_BOOTSTRAP_EMAIL/ADMIN_BOOTSTRAP_PASSWORD do .env depois do primeiro login."
    );
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Erro ao criar administrador inicial:", error.message);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { garantirSchema, garantirAdminInicial };
