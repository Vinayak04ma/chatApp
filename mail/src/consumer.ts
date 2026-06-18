import amqp from "amqplib";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

export const startSendOtpConsumer = async () => {
  try {
    const connection = await amqp.connect(
      process.env.RABBITMQ_URL || {
        protocol: "amqp",
        hostname: process.env.Rabbitmq_Host,
        port: 5672,
        username: process.env.Rabbitmq_Username,
        password: process.env.Rabbitmq_Password,
      }
    );

    const channel = await connection.createChannel();
    const queueName = "send-otp";
    await channel.assertQueue(queueName, { durable: true });
    console.log("✅ Mail Service consumer started, listening for otp emails");

    const useResend = !!process.env.RESEND_API_KEY;
    const useBrevo = !!process.env.BREVO_API_KEY;
    const useExternalApi = useResend || useBrevo;
    let transporter: any;

    if (!useExternalApi) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === "true", // true for 465, false for 587 (STARTTLS)
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
        pool: true,
        maxConnections: 1,
        maxMessages: 3,
        debug: false,
      });

      try {
        await transporter.verify();
        console.log("✅ SMTP connection verified successfully");
      } catch (verifyError:any) {
        console.error("❌ SMTP verification failed:", verifyError && verifyError.message ? verifyError.message : verifyError);
        console.error("🔧 Please check your Gmail credentials and ensure you're using an App Password (and that it's for the same account).");
        return;
      }
    } else {
      console.log(`✅ Mail Service using ${useBrevo ? "Brevo" : "Resend"} HTTP API for sending emails`);
    }

    channel.consume(queueName, async (msg) => {
      if (!msg) return;
      try {
        const { to, subject, body } = JSON.parse(msg.content.toString());

        if (useBrevo) {
          const res = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
              "accept": "application/json",
              "api-key": process.env.BREVO_API_KEY || "",
              "content-type": "application/json",
            },
            body: JSON.stringify({
              sender: { name: "Chatify", email: process.env.SMTP_USER || "vinayakmaheshwari57@gmail.com" },
              to: [{ email: to }],
              subject,
              htmlContent: `<div><h3>Your OTP</h3><p>${body}</p></div>`,
            }),
          });

          if (!res.ok) {
            const errData = await res.json();
            throw new Error(JSON.stringify(errData));
          }

          const resData = (await res.json()) as any;
          console.log(`✅ OTP mail sent via Brevo to ${to}. MessageId: ${resData.messageId}`);
        } else if (useResend) {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: "onboarding@resend.dev",
              to,
              subject,
              html: `<div><h3>Your OTP</h3><p>${body}</p></div>`,
            }),
          });

          if (!res.ok) {
            const errData = await res.json();
            throw new Error(JSON.stringify(errData));
          }

          const resData = (await res.json()) as any;
          console.log(`✅ OTP mail sent via Resend to ${to}. ID: ${resData.id}`);
        } else {
          const mailOptions = {
            from: process.env.SMTP_USER,
            to,
            subject,
            text: body,
            html: `<div><h3>Your OTP</h3><p>${body}</p></div>`,
          };

          const result = await transporter.sendMail(mailOptions);
          console.log(`✅ OTP mail sent to ${to}. MessageId: ${result.messageId}`);
        }
        channel.ack(msg);
      } catch (err:any) {
        console.error("❌ Failed to send OTP:", err && err.message ? err.message : err);
      }
    }, { noAck: false });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      await channel.close();
      await connection.close();
      if (transporter) transporter.close();
      process.exit(0);
    });

  } catch (error) {
    console.error("❌ Failed to start rabbitmq consumer:", error);
  }
};
