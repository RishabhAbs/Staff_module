const nodemailer = require('nodemailer');

/**
 * Send an email notification
 * @param {Object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Subject line
 * @param {string} options.html - HTML body
 * @param {string} [options.text] - Plain text fallback
 */
async function sendEmail({ to, subject, html, text }) {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.log('--- EMAIL SIMULATION (SMTP not configured) ---');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body (Text): ${text || 'HTML Content provided'}`);
    console.log('--------------------------------------------');
    return { simulated: true, message: 'Email logged (SMTP not configured)' };
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port: parseInt(port, 10),
      secure: parseInt(port, 10) === 465, // true for 465, false for other ports
      auth: {
        user,
        pass,
      },
    });

    const mailOptions = {
      from: `"ABS Staff Portal" <${user}>`,
      to,
      subject,
      text: text || 'Please view this in an HTML-compatible email client.',
      html,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    throw error;
  }
}

module.exports = { sendEmail };
