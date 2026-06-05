const { Pool } = require("pg");
require("dotenv").config();

const dbConfig = {
  host: process.env.DB_HOST || process.env.SUPABASE_HOST,
  port: process.env.DB_PORT || process.env.SUPABASE_PORT || 5432,
  user: process.env.DB_USER || process.env.SUPABASE_USER,
  password: process.env.DB_PASSWORD || process.env.SUPABASE_PASSWORD,
  database: process.env.DB_DATABASE || process.env.SUPABASE_DATABASE,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 20,
};

if (!dbConfig.host || !dbConfig.user || !dbConfig.password || !dbConfig.database) {
  console.error(
    "Erro de configuração do banco de dados: verifique as variáveis de ambiente do Supabase."
  );
}

const pool = new Pool(dbConfig);

pool.connect((err, client, release) => {
  if (err) {
    console.error("Erro ao conectar com o Supabase:", err.message || err);
    return;
  }
  console.log("Conectado ao Supabase com sucesso!");
  release();
});

module.exports = pool;