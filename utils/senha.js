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

function gerarSugestoes(capacidade, colunaAtual, filaAtual) {
    const sugestoes = [];
    
    // Sugestão 1: Aumentar filas
    const novasFilas = Math.ceil(capacidade / colunaAtual);
    if (novasFilas * colunaAtual >= capacidade) {
        sugestoes.push({
            descricao: `Aumentar filas para ${novasFilas}`,
            filas: novasFilas,
            colunas: colunaAtual,
            total: novasFilas * colunaAtual,
            lugares_vazios: (novasFilas * colunaAtual) - capacidade
        });
    }
    
    // Sugestão 2: Aumentar colunas
    const novasColunas = Math.ceil(capacidade / filaAtual);
    if (filaAtual * novasColunas >= capacidade) {
        sugestoes.push({
            descricao: `Aumentar colunas para ${novasColunas}`,
            filas: filaAtual,
            colunas: novasColunas,
            total: filaAtual * novasColunas,
            lugares_vazios: (filaAtual * novasColunas) - capacidade
        });
    }
    
    // Sugestão 3: Distribuição uniforme
    for (let f = 1; f <= Math.sqrt(capacidade); f++) {
        if (capacidade % f === 0) {
            const c = capacidade / f;
            if (f <= 26 && c <= 26) {
                sugestoes.push({
                    descricao: `Distribuição uniforme ${f}×${c}`,
                    filas: f,
                    colunas: c,
                    total: capacidade,
                    lugares_vazios: 0,
                    recomendado: true
                });
            }
        }
    }
    
    // Sugestão 4: Aproximação
    for (let f = 1; f <= Math.sqrt(capacidade + 10); f++) {
        const total = f * Math.ceil(capacidade / f);
        if (total >= capacidade && total <= capacidade + 10) {
            const c = Math.ceil(capacidade / f);
            if (f <= 26 && c <= 26) {
                sugestoes.push({
                    descricao: `Aproximação ${f}×${c} = ${total}`,
                    filas: f,
                    colunas: c,
                    total: total,
                    lugares_vazios: total - capacidade
                });
            }
        }
    }
    
    // Ordenar: recomendados primeiro, depois menos lugares vazios
    sugestoes.sort((a, b) => {
        if (a.recomendado && !b.recomendado) return -1;
        if (!a.recomendado && b.recomendado) return 1;
        return a.lugares_vazios - b.lugares_vazios;
    });
    
    return sugestoes.slice(0, 5);
}

function gerarMapaVisual(lugaresOrganizados, colunas) {
    if (!lugaresOrganizados || lugaresOrganizados.length === 0) {
        return '';
    }
    
    let mapa = '';
    const linhaSeparadora = '+---'.repeat(colunas) + '+';
    
    lugaresOrganizados.forEach(fila => {
        mapa += linhaSeparadora + '\n';
        mapa += `| ${fila.fila} `;
        
        fila.lugares.forEach(lugar => {
            if (lugar.ativo) {
                const codigo = lugar.codigo_lugar || '';
                mapa += `| ${codigo.padEnd(2)}`;
            } else {
                mapa += `| ·· `;
            }
        });
        mapa += '|\n';
    });
    mapa += linhaSeparadora;
    
    return mapa;
}

function gerarMapaVisualAssentos(assentosOrganizados, colunas) {
    if (!assentosOrganizados || assentosOrganizados.length === 0 || colunas === 0) {
        return '';
    }
    
    let mapa = '';
    const linhaSeparadora = '+---'.repeat(colunas) + '+';
    
    assentosOrganizados.forEach(fila => {
        mapa += linhaSeparadora + '\n';
        mapa += `| ${fila.fila} `;
        
        // Ordenar assentos por número
        const assentosOrdenados = [...fila.assentos].sort((a, b) => a.numero - b.numero);
        
        assentosOrdenados.forEach(assento => {
            if (assento.ativo && !assento.vazio) {
                const codigo = assento.codigo_lugar || '';
                mapa += `| ${codigo.padEnd(2)}`;
            } else if (assento.vazio) {
                mapa += `| ·· `;
            } else {
                mapa += `| ✗ `;
            }
        });
        mapa += '|\n';
    });
    mapa += linhaSeparadora;
    
    return mapa;
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
    gerarSenhaParaEmail,
    gerarSugestoes,
    gerarMapaVisual,
    gerarMapaVisualAssentos
};