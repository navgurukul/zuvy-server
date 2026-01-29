import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { EmailProvider } from './email-provider.interface';

@Injectable()
export class SmtpProvider implements EmailProvider {
  async sendEmail(
    to: string,
    subject: string,
    body: string,
    config?: any,
  ): Promise<any> {
    const transporter = nodemailer.createTransport({
      host: config?.host || process.env.SMTP_HOST,
      port: Number(config?.port || process.env.SMTP_PORT),
      secure: false, // true for 465, false for other ports
      auth: {
        user: config?.user || process.env.SMTP_USER,
        pass: config?.pass || process.env.SMTP_PASS,
      },
    });

    const info = await transporter.sendMail({
      from: config?.from || '"Zuvy Support" <team@zuvy.org>', // Default sender
      to,
      subject,
      html: body,
    });

    return info;
  }
}
