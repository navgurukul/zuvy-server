import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { EmailProvider } from './email-provider.interface';

@Injectable()
export class OutlookProvider implements EmailProvider {
  async sendEmail(
    to: string,
    subject: string,
    body: string,
    config?: any,
  ): Promise<any> {
    const transporter = nodemailer.createTransport({
      host: 'smtp-mail.outlook.com',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: config?.user || process.env.OUTLOOK_USER,
        pass: config?.pass || process.env.OUTLOOK_PASS,
      },
      tls: {
        ciphers: 'SSLv3',
      },
    });

    const info = await transporter.sendMail({
      from: config?.from || process.env.OUTLOOK_USER,
      to,
      subject,
      html: body,
    });

    return info;
  }
}
