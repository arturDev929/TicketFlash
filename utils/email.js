const nodemailer = require("nodemailer");
require("dotenv").config();

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: { 
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    },
    tls: {
        rejectUnauthorized: false
    }
});

transporter.verify((error, success) => {
    if (error) {
        console.error("Erro na configuracao do email:", error);
    } else {
        console.log("Email configurado com sucesso!");
        
    }
});

const enviarEmail = async (destinatario, assunto, html) => {
    try {
        console.log(`Tentando enviar email para: ${destinatario}`);
        console.log(`Assunto: ${assunto}`);
        
        const mailOptions = {
            from: `"TicketFlash" <${process.env.EMAIL_USER}>`,
            to: destinatario,
            subject: assunto,
            html: html
        };
        
        const info = await transporter.sendMail(mailOptions);
        console.log("Email enviado com sucesso!");
        console.log("ID da mensagem:", info.messageId);
        return { sucesso: true, messageId: info.messageId };
    } catch (error) {
        console.error("Erro detalhado ao enviar email:", error);
        console.error("Mensagem de erro:", error.message);
        if (error.code) console.error("Codigo do erro:", error.code);
        return { sucesso: false, erro: error.message, code: error.code };
    }
};

const enviarBoasVindas = async (email, nome) => {
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Bem-vindo ao TicketFlash</title>
        </head>
        <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <div style="background-color: rgb(254,154,0); padding: 20px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0;">TICKETFLASH</h1>
                </div>
                <div style="padding: 30px;">
                    <h2 style="color: #333;">Bem-vindo, ${nome}!</h2>
                    <p>Sua conta foi criada com sucesso no TicketFlash.</p>
                    <p>Agora voce pode comprar ingressos para os melhores filmes.</p>
                    <a href="${process.env.APP_URL || 'http://localhost:3000'}" style="display: inline-block; background-color: #c41e3a; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Acessar Sistema</a>
                </div>
                <div style="background-color: #f4f4f4; padding: 20px; text-align: center; color: #666; font-size: 12px;">
                    <p>TicketFlash - Sua experiencia em cinema</p>
                </div>
            </div>
        </body>
        </html>
    `;
    return await enviarEmail(email, 'Bem-vindo ao TicketFlash', html);
};

const enviarSenhaAcesso = async (email, nome, senha) => {
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Sua Senha de Acesso - TicketFlash</title>
            <style>
                .senha-box {
                    background-color: #f0f0f0;
                    border: 2px dashed #c41e3a;
                    border-radius: 8px;
                    padding: 20px;
                    text-align: center;
                    margin: 20px 0;
                }
                .senha {
                    font-size: 28px;
                    font-weight: bold;
                    color: #c41e3a;
                    letter-spacing: 2px;
                    font-family: monospace;
                    background-color: #fff;
                    padding: 10px;
                    border-radius: 4px;
                    display: inline-block;
                }
                .aviso {
                    color: #666;
                    font-size: 12px;
                    margin-top: 15px;
                }
                .info {
                    background-color: #f9f9f9;
                    padding: 15px;
                    border-radius: 4px;
                    margin: 15px 0;
                }
            </style>
        </head>
        <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                <div style="background-color: #c41e3a; padding: 20px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0;">TICKETFLASH</h1>
                    <p style="color: #ffffff; margin: 5px 0 0;">Sua conta foi criada!</p>
                </div>
                <div style="padding: 30px;">
                    <h2 style="color: #333;">Ola, ${nome}!</h2>
                    <p>Bem-vindo ao <strong>TicketFlash</strong>! Sua conta foi criada com sucesso.</p>
                    
                    <div class="senha-box">
                        <p style="margin: 0 0 10px;"><strong>Sua senha de acesso:</strong></p>
                        <div class="senha">${senha}</div>
                        <p class="aviso">
                            Recomendamos alterar esta senha apos o primeiro acesso.<br>
                            Guarde esta senha em local seguro.
                        </p>
                    </div>
                    
                    <div class="info">
                        <p><strong>Seus dados de acesso:</strong></p>
                        <p><strong>Email:</strong> ${email}</p>
                        <p><strong>Senha:</strong> ${senha}</p>
                    </div>
                    
                    <a href="${process.env.APP_URL || 'http://localhost:3000'}" style="display: inline-block; background-color: #c41e3a; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 10px;">Acessar Minha Conta</a>
                    
                    <div style="margin-top: 20px; padding: 15px; background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
                        <p style="margin: 0; color: #856404;">
                            <strong>Dica importante:</strong> Nunca compartilhe sua senha com ninguem. 
                            O TicketFlash nunca solicitara sua senha por email ou telefone.
                        </p>
                    </div>
                </div>
                <div style="background-color: #f4f4f4; padding: 20px; text-align: center; color: #666; font-size: 12px;">
                    <p>Este e um email automatico, por favor nao responda.</p>
                    <p> 2024 TicketFlash - Sua experiencia em cinema</p>
                </div>
            </div>
        </body>
        </html>
    `;
    return await enviarEmail(email, 'Sua senha de acesso - TicketFlash', html);
};

const enviarBilhete = async (email, nome, filme, data, horario, sala, assentos, codigoPedido, valorTotal) => {
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Seu Ingresso - TicketFlash</title>
        </head>
        <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden;">
                <div style="background-color: #c41e3a; padding: 20px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0;">INGRESSO CONFIRMADO</h1>
                </div>
                <div style="padding: 30px;">
                    <h2>Ola, ${nome}!</h2>
                    <p>Seu ingresso para <strong>${filme}</strong> foi confirmado.</p>
                    <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #c41e3a;">
                        <p><strong>Data:</strong> ${data}</p>
                        <p><strong>Horario:</strong> ${horario}</p>
                        <p><strong>Sala:</strong> ${sala}</p>
                        <p><strong>Assentos:</strong> ${assentos.join(', ')}</p>
                        <p><strong>Total:</strong> KZ ${valorTotal.toFixed(2)}</p>
                        <p><strong>Codigo:</strong> ${codigoPedido}</p>
                    </div>
                    <p>Apresente este email na entrada do cinema.</p>
                </div>
                <div style="background-color: #f4f4f4; padding: 20px; text-align: center; color: #666; font-size: 12px;">
                    <p>TicketFlash - Seu ingresso digital</p>
                </div>
            </div>
        </body>
        </html>
    `;
    return await enviarEmail(email, `Seu ingresso para ${filme}`, html);
};

const enviarRecuperacaoSenha = async (email, nome, token) => {
    const linkRecuperacao = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${token}`;
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Recuperacao de Senha</title>
        </head>
        <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden;">
                <div style="background-color: #c41e3a; padding: 20px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0;">RECUPERACAO DE SENHA</h1>
                </div>
                <div style="padding: 30px;">
                    <h2>Ola, ${nome}!</h2>
                    <p>Recebemos uma solicitacao para redefinir sua senha.</p>
                    <a href="${linkRecuperacao}" style="display: inline-block; background-color: #c41e3a; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Redefinir Senha</a>
                    <p>Este link e valido por 1 hora.</p>
                </div>
            </div>
        </body>
        </html>
    `;
    return await enviarEmail(email, 'Recuperacao de Senha - TicketFlash', html);
};

module.exports = {
    enviarEmail,
    enviarBoasVindas,
    enviarBilhete,
    enviarRecuperacaoSenha,
    enviarSenhaAcesso
};