const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const SALT_ROUNDS = 10;

async function criptografarSenha(senha) {
    if (!senha) throw new Error('Senha nao fornecida');
    if (senha.length < 6) throw new Error('Senha deve ter no minimo 6 caracteres');
    const hash = await bcrypt.hash(senha, SALT_ROUNDS);
    return hash;
}

async function compararSenhas(senha, hash) {
    if (!senha || !hash) throw new Error('Senha ou hash nao fornecidos');
    const comparacao = await bcrypt.compare(senha, hash);
    return comparacao;
}

function gerarSenhaParaEmail() {
    const numeros = '0123456789';
    
    let senha = '';
    senha += numeros[Math.floor(Math.random() * numeros.length)];
    
    const todos = numeros;
    for (let i = senha.length; i < 8; i++) {
        senha += todos[Math.floor(Math.random() * todos.length)];
    }
    
    return senha.split('').sort(() => Math.random() - 0.5).join('');
}

function gerarSenhaForte(tamanho = 12) {
    const numeros = '0123456789';
    const todos = numeros;
    
    let senha = '';
    senha += numeros[Math.floor(Math.random() * numeros.length)];
    
    for (let i = senha.length; i < tamanho; i++) {
        senha += todos[Math.floor(Math.random() * todos.length)];
    }
    
    return senha.split('').sort(() => Math.random() - 0.5).join('');
}

function criptografarSenhaSync(senha) {
    if (!senha) throw new Error('Senha nao fornecida');
    if (senha.length < 6) throw new Error('Senha deve ter no minimo 6 caracteres');
    const hash = bcrypt.hashSync(senha, SALT_ROUNDS);
    return hash;
}

function compararSenhasSync(senha, hash) {
    if (!senha || !hash) throw new Error('Senha ou hash nao fornecidos');
    return bcrypt.compareSync(senha, hash);
}

function gerarId() {
    return uuidv4();
}

function gerarCodigo() {
    const caracteres = '0123456789';
    let codigo = '';
    for (let i = 0; i < 8; i++) {
        codigo += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    }
    return codigo;
}

function gerarSenhaTemporaria() {
    const caracteres = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let senha = '';
    for (let i = 0; i < 8; i++) {
        senha += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    }
    return senha;
}

function validarForcaSenha(senha) {
    const regex = {
        tamanho: senha.length >= 8,
        maiuscula: /[A-Z]/.test(senha),
        minuscula: /[a-z]/.test(senha),
        numero: /[0-9]/.test(senha),
        especial: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(senha)
    };
    
    const forca = Object.values(regex).filter(Boolean).length;
    
    return {
        valida: forca >= 4,
        forca: forca === 5 ? 'Forte' : forca === 4 ? 'Media' : 'Fraca',
        requisitos: regex
    };
}

module.exports = {
    criptografarSenha,
    compararSenhas,
    gerarSenhaForte,
    criptografarSenhaSync,
    compararSenhasSync,
    gerarId,
    gerarCodigo,
    gerarSenhaTemporaria,
    validarForcaSenha,
    gerarSenhaParaEmail
};