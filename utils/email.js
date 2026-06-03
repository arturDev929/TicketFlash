const nodemailer = require("nodemailer");
require("dotenv").config();

const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false,
    auth: { 
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

transporter.verify((error, success) => {
    if (error) {
        console.error("Erro no email:", error);
    } else {
        console.log("Email configurado");
    }
});

const enviarEmail = async (destinatario, assunto, html) => {
    try {
        const mailOptions = {
            from: `"TicketFlash" <${process.env.EMAIL_USER}>`,
            to: destinatario,
            subject: assunto,
            html: html
        };
        await transporter.sendMail(mailOptions);
        return { sucesso: true };
    } catch (error) {
        console.error("Erro ao enviar email:", error);
        return { sucesso: false, erro: error.message };
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
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; overflow: hidden;">
                <div style="background-color: #c41e3a; padding: 20px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0;">TICKETFLASH</h1>
                </div>
                <div style="padding: 30px;">
                    <h2 style="color: #333;">Bem-vindo, ${nome}!</h2>
                    <p>Sua conta foi criada com sucesso no TicketFlash.</p>
                    <p>Agora voce pode comprar ingressos para os melhores filmes.</p>
                    <a href="${process.env.APP_URL || 'http://localhost:3000'}" style="display: inline-block; background-color: #c41e3a; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Acessar Sistema</a>
                </div>
                <div style="background-color: #f4f4f4; padding: 20px; text-align: center; color: #666; font-size: 12px;">
                    <p>TicketFlash - Sua experiencia de cinema</p>
                </div>
            </div>
        </body>
        </html>
    `;
    return await enviarEmail(email, 'Bem-vindo ao TicketFlash', html);
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
                    <h2>Olá, ${nome}!</h2>
                    <p>Seu ingresso para <strong>${filme}</strong> foi confirmado.</p>
                    <div style="background-color: #f9f9f9; padding: 15px; border-left: 4px solid #c41e3a;">
                        <p><strong>Data:</strong> ${data}</p>
                        <p><strong>Horario:</strong> ${horario}</p>
                        <p><strong>Sala:</strong> ${sala}</p>
                        <p><strong>Assentos:</strong> ${assentos.join(', ')}</p>
                        <p><strong>Total:</strong> R$ ${valorTotal.toFixed(2)}</p>
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
                    <h2>Olá, ${nome}!</h2>
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
    enviarRecuperacaoSenha
};