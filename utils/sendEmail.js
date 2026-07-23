import dotenv from "dotenv";
dotenv.config();

import { Resend } from "resend";

console.log("RESEND_API_KEY =", process.env.RESEND_API_KEY);

const resend = new Resend(process.env.RESEND_API_KEY);

const sendEmail = async (to, subject, html) => {
  try {
    const { error } = await resend.emails.send({
      from: "Hooks Food <noreply@getcoredispatch.cloud>",
      to,
      subject,
      html,
    });

    if (error) {
      console.error("Resend Error:", error);
      throw new Error(error.message);
    }

    console.log(`Email sent successfully to ${to}`);
  } catch (error) {
    console.error("Email Error:", error);
    throw error;
  }
};

export default sendEmail;