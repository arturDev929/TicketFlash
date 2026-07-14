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
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
            schemas: {
                MovieDetail: {
                    type: 'object',
                    properties: {
                        id_filme: {
                            type: 'string',
                            format: 'uuid',
                            description: 'UUID único do filme',
                            example: '0729f7e0-e31e-4c61-91cd-5809d05419eb'
                        },
                        titulo: {
                            type: 'string',
                            description: 'Título do filme',
                            example: 'O Poderoso Chefão'
                        },
                        sinopse: {
                            type: 'string',
                            description: 'Resumo da trama',
                            nullable: true,
                            example: 'A história da família Corleone...'
                        },
                        duracao_minutos: {
                            type: 'integer',
                            minimum: 0,
                            description: 'Duração em minutos',
                            example: 175
                        },
                        ano_lancamento: {
                            type: 'integer',
                            minimum: 1888,
                            description: 'Ano de lançamento',
                            example: 1972
                        },
                        classificacao_etaria: {
                            type: 'string',
                            description: 'Classificação indicativa',
                            enum: ['L', '10', '12', '14', '16', '18'],
                            example: '16',
                            nullable: true
                        },
                        nota_media: {
                            type: 'number',
                            format: 'float',
                            minimum: 0,
                            maximum: 10,
                            description: 'Média das avaliações',
                            example: 9.2,
                            nullable: true
                        },
                        cartaz_url: {
                            type: 'string',
                            format: 'uri',
                            description: 'URL do poster',
                            nullable: true,
                            example: 'https://exemplo.com/posters/godfather.jpg'
                        },
                        trailer_url: {
                            type: 'string',
                            format: 'uri',
                            description: 'URL do trailer',
                            nullable: true,
                            example: 'https://youtube.com/watch?v=godfather'
                        },
                        estado_exibicao: {
                            type: 'string',
                            description: 'Estado de exibição',
                            enum: ['breve', 'exibindo', 'em_cartaz', 'encerrado'],
                            example: 'encerrado'
                        },
                        pais_origem: {
                            type: 'string',
                            description: 'País de origem',
                            nullable: true,
                            example: 'EUA'
                        },
                        idioma_original: {
                            type: 'string',
                            description: 'Idioma original',
                            nullable: true,
                            example: 'Inglês'
                        },
                        generos: {
                            type: 'string',
                            description: 'Gêneros concatenados',
                            nullable: true,
                            example: 'Drama, Crime'
                        },
                        total_generos: {
                            type: 'integer',
                            minimum: 0,
                            description: 'Quantidade de gêneros',
                            example: 2
                        }
                    }
                },
                Error: {
                    type: 'object',
                    required: ['erro'],
                    properties: {
                        erro: {
                            type: 'string',
                            description: 'Mensagem de erro',
                            example: 'Erro ao processar requisição'
                        }
                    }
                }
            }
        }
    },
    apis: ['./routes/*.js']  // Certifique-se que o caminho está correto
};

const swaggerSpec = swaggerJsdoc(options);
module.exports = swaggerSpec;