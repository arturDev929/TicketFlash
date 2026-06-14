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
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));


app.use(cors());
app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs));
app.use('/login', loginRouter);
app.use('/', postsRouter);
app.use('/', getRouter);
app.use('/', putRouter);

app.listen(PORT, () => {
    console.log(`Servidor: http://localhost:${PORT}`);
    console.log(`Docs: http://localhost:${PORT}/api-docs`);
    console.log(`Rede: http://${LOCAL_IP}:${PORT}`);
});