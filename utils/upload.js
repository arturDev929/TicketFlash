const multer = require("multer");
const path = require("path");
const fs = require("fs");

const UPLOAD_DIRS = {
    FILMES_CARTAZ: path.join(__dirname, "../uploads/filmes/cartazes"),
    FILMES_TRAILER: path.join(__dirname, "../uploads/filmes/trailers")
};

const criarPastaSeNaoExistir = (pasta) => {
    if (!fs.existsSync(pasta)) {
        fs.mkdirSync(pasta, { recursive: true });
    }
};

const storage = multer.diskStorage({
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


const fileFilter = (req, file, cb) => {
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
    storage: storage,
    limits: { 
        fileSize: 100 * 1024 * 1024, 
        files: 2
    },
    fileFilter: fileFilter
});


const uploadMidiaFilme = uploadFilmes.fields([
    { name: 'cartaz', maxCount: 1 },
    { name: 'trailer', maxCount: 1 }
]);


const deletarCartazFilme = (nomeArquivo) => {
    if (nomeArquivo) {
        const caminho = path.join(UPLOAD_DIRS.FILMES_CARTAZ, nomeArquivo);
        if (fs.existsSync(caminho)) {
            fs.unlinkSync(caminho);
            console.log(`Cartaz deletado: ${nomeArquivo}`);
        }
    }
};

const deletarTrailerFilme = (nomeArquivo) => {
    if (nomeArquivo) {
        const caminho = path.join(UPLOAD_DIRS.FILMES_TRAILER, nomeArquivo);
        if (fs.existsSync(caminho)) {
            fs.unlinkSync(caminho);
            console.log(`Trailer deletado: ${nomeArquivo}`);
        }
    }
};


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


module.exports = {
    uploadMidiaFilme,
    deletarCartazFilme,
    deletarTrailerFilme,
    deletarMidiasFilme,
    UPLOAD_DIRS
};