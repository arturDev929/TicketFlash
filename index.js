const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const os = require('os');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./config/swagger');

const loginRouter = require('./routes/login');
const authRouter = require('./routes/auth.routes');
const filmesRouter = require('./routes/filmes.routes');
const generosRouter = require('./routes/generos.routes');
const salasRouter = require('./routes/salas.routes');
const sessoesRouter = require('./routes/sessoes.routes');
const comprasRouter = require('./routes/compras.routes');
const usuariosRouter = require('./routes/usuarios.routes');
const logsRouter = require('./routes/logs.routes');
const pool = require('./infra/conexao');
const { garantirSchema, garantirAdminInicial } = require('./infra/bootstrap');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;
const FRONT_URL = process.env.FRONT_URL || 'http://localhost:3000';

function getLocalIP() {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                return net.address;
            }
        }
    }
    return 'localhost';
}

const LOCAL_IP = getLocalIP();

const allowedOrigins = [
    FRONT_URL,
    `http://${LOCAL_IP}:3000`,
    `https://ticketflash.onrender.com`,
    `http://localhost:${PORT}`,
    `http://${LOCAL_IP}:${PORT}`,
    /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}:\d+$/,
    /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+$/
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);

        const isAllowed = allowedOrigins.some(allowed => {
            if (allowed instanceof RegExp) {
                return allowed.test(origin);
            }
            return allowed === origin;
        });

        if (isAllowed) {
            callback(null, true);
        } else {
            console.log('Origem não permitida pelo CORS:', origin);
            callback(new Error('Não permitido pelo CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs));
app.use('/login', loginRouter);
app.use('/', authRouter);
app.use('/', filmesRouter);
app.use('/', generosRouter);
app.use('/', salasRouter);
app.use('/', sessoesRouter);
app.use('/', comprasRouter);
app.use('/', usuariosRouter);
app.use('/', logsRouter);

async function iniciar() {
    try {
        await garantirSchema(pool);
        await garantirAdminInicial(pool);
    } catch (error) {
        console.error(
            "❌ Não foi possível garantir o schema da base de dados. O servidor não vai arrancar."
        );
        process.exit(1);
    }

    app.listen(PORT, () => {
        console.log(`Servidor: http://localhost:${PORT}`);
        console.log(`Docs: http://localhost:${PORT}/api-docs`);
        console.log(`Rede: http://${LOCAL_IP}:${PORT}`);
    });
}

iniciar();