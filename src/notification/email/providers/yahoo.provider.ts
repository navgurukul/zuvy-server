import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { EmailProvider } from './email-provider.interface';

@Injectable()
export class YahooProvider implements EmailProvider {
  async sendEmail(
    to: string,
    subject: string,
    body: string,
    config?: any,
  ): Promise<any> {
    const transporter = nodemailer.createTransport({
      service: 'yahoo',
      auth: {
        user: config?.user || process.env.YAHOO_USER,
        pass: config?.pass || process.env.YAHOO_PASS,
      },
    });

    const info = await transporter.sendMail({
      from: config?.from || process.env.YAHOO_USER,
      to,
      subject,
      html: body,
    });

    return info;
  }
}
