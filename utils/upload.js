const multer = require("multer");
const path = require("path");
const fs = require("fs");

// --- DIRETÓRIOS DE UPLOAD ---
const UPLOAD_DIRS = {
    FILMES_CARTAZ: path.join(__dirname, "../uploads/filmes/cartazes"),
    FILMES_TRAILER: path.join(__dirname, "../uploads/filmes/trailers"),
    CLIENTES: path.join(__dirname, "../uploads/clientes")
};

// --- FUNÇÃO PARA CRIAR PASTAS ---
const criarPastaSeNaoExistir = (pasta) => {
    if (!fs.existsSync(pasta)) {
        fs.mkdirSync(pasta, { recursive: true });
    }
};

// Criar todas as pastas necessárias
Object.values(UPLOAD_DIRS).forEach(pasta => criarPastaSeNaoExistir(pasta));

// ============================================================
// CONFIGURAÇÃO PARA FILMES
// ============================================================

const storageFilmes = multer.diskStorage({
    destination: (req, file, cb) => {
        let pasta = UPLOAD_DIRS.FILMES_CARTAZ;
        
        if (file.fieldname === "trailer") {
            pasta = UPLOAD_DIRS.FILMES_TRAILER;
        }
        
        criarPastaSeNaoExistir(pasta);
        cb(null, pasta);
    },
    filename: (req, file, cb) => {
        const extensao = path.extname(file.originalname);
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 10000);
        
        let prefixo = "cartaz";
        if (file.fieldname === "trailer") {
            prefixo = "trailer";
        }
        
        const nome = `${prefixo}_${timestamp}_${random}${extensao}`;
        cb(null, nome);
    }
});

const fileFilterFilmes = (req, file, cb) => {
    if (file.fieldname === "cartaz") {
        const allowedImages = ["image/jpeg", "image/png", "image/jpg", "image/webp"];
        if (allowedImages.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Formato inválido para cartaz. Use JPEG, PNG, JPG ou WEBP"), false);
        }
    } 
    else if (file.fieldname === "trailer") {
        const allowedVideos = ["video/mp4", "video/mpeg", "video/quicktime", "video/x-msvideo"];
        if (allowedVideos.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error("Formato inválido para trailer. Use MP4, MPEG, MOV ou AVI"), false);
        }
    }
    else {
        cb(null, true);
    }
};

const uploadFilmes = multer({
    storage: storageFilmes,
    limits: { 
        fileSize: 100 * 1024 * 1024, // 100MB
        files: 2
    },
    fileFilter: fileFilterFilmes
});

const uploadMidiaFilme = uploadFilmes.fields([
    { name: 'cartaz', maxCount: 1 },
    { name: 'trailer', maxCount: 1 }
]);

// ============================================================
// CONFIGURAÇÃO PARA CLIENTES
// ============================================================

const storageCliente = multer.diskStorage({
    destination: (req, file, cb) => {
        const pasta = UPLOAD_DIRS.CLIENTES;
        criarPastaSeNaoExistir(pasta);
        cb(null, pasta);
    },
    filename: (req, file, cb) => {
        const extensao = path.extname(file.originalname);
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 10000);
        const nome = `cliente_${timestamp}_${random}${extensao}`;
        cb(null, nome);
    }
});

const fileFilterCliente = (req, file, cb) => {
    const allowedImages = ["image/jpeg", "image/png", "image/jpg", "image/webp"];
    if (allowedImages.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error("Formato inválido. Use JPEG, PNG, JPG ou WEBP"), false);
    }
};

const uploadCliente = multer({
    storage: storageCliente,
    limits: { 
        fileSize: 5 * 1024 * 1024 // 5MB
    },
    fileFilter: fileFilterCliente
});

const uploadClientImg = uploadCliente.single('foto');

// ============================================================
// FUNÇÕES PARA DELETAR ARQUIVOS
// ============================================================

// Deletar cartaz do filme
const deletarCartazFilme = (nomeArquivo) => {
    if (nomeArquivo) {
        const caminho = path.join(UPLOAD_DIRS.FILMES_CARTAZ, nomeArquivo);
        if (fs.existsSync(caminho)) {
            fs.unlinkSync(caminho);
            console.log(`Cartaz deletado: ${nomeArquivo}`);
            return true;
        }
    }
    return false;
};

// Deletar trailer do filme
const deletarTrailerFilme = (nomeArquivo) => {
    if (nomeArquivo) {
        const caminho = path.join(UPLOAD_DIRS.FILMES_TRAILER, nomeArquivo);
        if (fs.existsSync(caminho)) {
            fs.unlinkSync(caminho);
            console.log(`Trailer deletado: ${nomeArquivo}`);
            return true;
        }
    }
    return false;
};

// Deletar mídias do filme (cartaz e trailer)
const deletarMidiasFilme = (cartazUrl, trailerUrl) => {
    if (cartazUrl) {
        const nomeCartaz = path.basename(cartazUrl);
        deletarCartazFilme(nomeCartaz);
    }
    
    if (trailerUrl) {
        const nomeTrailer = path.basename(trailerUrl);
        deletarTrailerFilme(nomeTrailer);
    }
};

// Deletar foto do cliente
const deletarFotoCliente = (fotoUrl) => {
    if (fotoUrl) {
        const nomeArquivo = path.basename(fotoUrl);
        const caminho = path.join(UPLOAD_DIRS.CLIENTES, nomeArquivo);
        if (fs.existsSync(caminho)) {
            fs.unlinkSync(caminho);
            console.log(`Foto do cliente deletada: ${nomeArquivo}`);
            return true;
        }
    }
    return false;
};

// ============================================================
// EXPORTAR MÓDULOS
// ============================================================

module.exports = {
    // Uploads
    uploadMidiaFilme,
    uploadClientImg,
    
    // Deletar arquivos
    deletarCartazFilme,
    deletarTrailerFilme,
    deletarMidiasFilme,
    deletarFotoCliente,
    
    // Diretórios
    UPLOAD_DIRS,
    
    // Criar pastas (caso precise usar separadamente)
    criarPastaSeNaoExistir
};