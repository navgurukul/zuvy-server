import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { EmailProvider } from './email-provider.interface';

@Injectable()
export class GmailProvider implements EmailProvider {
  async sendEmail(
    to: string,
    subject: string,
    body: string,
    config?: any,
  ): Promise<any> {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: config?.user || process.env.GMAIL_USER,
        pass: config?.pass || process.env.GMAIL_PASS, // App Password
      },
    });

    const info = await transporter.sendMail({
      from: config?.from || process.env.GMAIL_USER,
      to,
      subject,
      html: body,
    });

    return info;
  }
}
