// server/utils/sendEmail.js
import nodemailer from 'nodemailer';

const sendEmail = async (options) => {
    // Use environment variables for credentials
    // For standard Gmail: service: 'gmail', auth: { user: ..., pass: 'app-password' }
    // For other SMTP: host, port, etc.

    const transporter = nodemailer.createTransport({
        service: process.env.EMAIL_SERVICE || 'gmail',
        auth: {
            user: process.env.EMAIL_USERNAME,
            pass: process.env.EMAIL_PASSWORD
        }
    });

    const mailOptions = {
        from: process.env.EMAIL_FROM || 'Metaverse App <noreply@metaverse.com>',
        to: options.to,
        subject: options.subject,
        html: options.html
    };

    await transporter.sendMail(mailOptions);
};

export default sendEmail;
