const jwt = require('jsonwebtoken');
require('dotenv').config();

const gerarToken = (usuario, tipo) => {
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET nao configurado');
    }

    const payload = {
        id: usuario.id,
        nome: usuario.nome,
        tipo: tipo
    };
    
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "24h" });
};

const verificarToken = (token) => {
    try {
        if (!process.env.JWT_SECRET) {
            throw new Error('JWT_SECRET nao configurado');
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return { valido: true, dados: decoded };
    } catch (error) {
        return { valido: false, erro: error.message };
    }
};

module.exports = { gerarToken, verificarToken };