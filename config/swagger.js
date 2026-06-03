const swaggerJsdoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'TicketFlash API',
            version: '1.0.0',
            description: 'API do sistema de compra de bilhetes de cinema',
        },
        servers: [
            {
                url: 'http://localhost:5000',
                description: 'Servidor Local'
            }
        ]
    },
    apis: ['./routes/*.js']
};

module.exports = swaggerJsdoc(options);