const jwt = require('jsonwebtoken');
require('dotenv').config();

const verificarToken = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            sucesso: false,
            mensagem: 'Token nao fornecido'
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.usuario = decoded;
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                sucesso: false,
                mensagem: 'Token invalido'
            });
        } else if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                sucesso: false,
                mensagem: 'Token expirado'
            });
        }
        
        return res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao verificar token'
        });
    }
};

const autorizar = (...tiposPermitidos) => {
    return (req, res, next) => {
        if (!req.usuario) {
            return res.status(401).json({
                sucesso: false,
                mensagem: 'Usuario nao autenticado'
            });
        }
        
        if (!tiposPermitidos.includes(req.usuario.tipo)) {
            return res.status(403).json({
                sucesso: false,
                mensagem: 'Acesso negado'
            });
        }
        
        next();
    };
};

module.exports = { verificarToken, autorizar };