import nodemailer from "nodemailer";

const sendEmail = async (to, subject, html) => {
  try {
    const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,

  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },

  family: 4,
});

    const mailOptions = {
  from: `"HOOKS FOOD Courier" <${process.env.EMAIL_USER}>`,
  to,
  subject,

  text: `
Your HOOKS FOOD verification code is:

${html.replace(/<[^>]*>/g, "")}

If you did not request this code, please ignore this email.
  `,

  html,
};

    await transporter.sendMail(mailOptions);

    console.log(`Email sent to ${to}`);
  } catch (error) {
    console.error("Email Error:", error.message);
  }
};

export default sendEmail;