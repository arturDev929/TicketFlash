const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const os = require('os');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerSpecs = require('./config/swagger');

const loginRouter = require('./routes/login');
const postsRouter = require('./routes/post');
const getRouter = require('./routes/get');
const putRouter = require('./routes/put');
const generos = require('./routes/generos.routes');
const authroutes = require('./routes/auth.routes');
const comprasRouter = require('./routes/compras.routes');
const filmesRouter = require('./routes/filmes.routes');
const logsRouter = require('./routes/logs.routes');
const salasRouter = require('./routes/salas.routes');
const sessoesRouter = require('./routes/sessoes.routes');
const usuariosRouter = require('./routes/usuarios.routes');

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

// 🔥 LISTA DE ORIGENS PERMITIDAS - SIMPLIFICADA
const allowedOrigins = [
    'http://localhost:3000',
    'http://localhost:5000',
    `http://${LOCAL_IP}:3000`,
    `http://${LOCAL_IP}:5000`,
    'https://ticketflash.onrender.com',
    'https://tickt-flash-3gd8.vercel.app',  // URL do seu frontend
    'https://tickt-flash-3gd8.vercel.app/', // Com barra no final
    'https://tickt-flash.vercel.app',
    'https://tickt-flash.vercel.app/',
    '/^https:\/\/.*\.vercel\.app$/',           // Qualquer subdomínio no Vercel
    '/^http:\/\/192\.168\.\d{1,3}\.\d{1,3}:\d+$/',
    '/^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d+$/',
    'http://localhost:5173',
    'http://localhost:5173/',
    'https://ticket-flash-front-henna.vercel.app/',
    'https://ticket-flash-front-henna.vercel.app',
];

// 🔥 CONFIGURAÇÃO CORS CORRETA (apenas uma vez)
app.use(cors({
    origin: function (origin, callback) {
        // Permite requisições sem origin (ex: Postman, Insomnia)
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
            console.log('❌ Origem bloqueada pelo CORS:', origin);
            console.log('🔍 Origens permitidas:', allowedOrigins);
            callback(new Error('Não permitido pelo CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'], // ✅ Adicionar PATCH
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

// ❌ REMOVA ESTA LINHA - ela sobrescreve a configuração acima!
// app.use(cors());  // <-- COMENTE OU REMOVA ESTA LINHA

app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs));
app.use('/login', loginRouter);
app.use('/', postsRouter);
app.use('/', getRouter);
app.use('/', putRouter);
app.use('/', generos);
app.use('/', authroutes);
app.use('/', comprasRouter);
app.use('/', filmesRouter);
app.use('/', logsRouter);
app.use('/', salasRouter);
app.use('/', sessoesRouter);
app.use('/', usuariosRouter);

app.listen(PORT, () => {
    console.log(`✅ Servidor: http://localhost:${PORT}`);
    console.log(`📚 Docs: http://localhost:${PORT}/api-docs`);
    console.log(`🌐 Rede: http://${LOCAL_IP}:${PORT}`);
});