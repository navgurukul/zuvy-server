import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendOrgCreationEmail(to: string, orgName: string, magicLink: string) {
    const info = await this.transporter.sendMail({
      from: '"Zuvy Support" <team@zuvy.org>', // sender address
      to: to, // list of receivers
      subject: `Welcome to Zuvy - Complete ${orgName} Setup`, // Subject line
      html: `
        <h1>Welcome to Zuvy!</h1>
        <p>You have been invited to set up the organization <b>${orgName}</b>.</p>
        <p>Please click the link below to complete your profile and organization details:</p>
        <a href="${magicLink}">Complete Setup</a>
        <p>If you did not request this, please ignore this email.</p>
      `, // html body
    });

    return info;
  }

  async sendDeletePermissionEmail(
    to: string,
    orgName: string,
    deleteLink: string,
  ) {
    if (!to) return;
    const info = await this.transporter.sendMail({
      from: '"Zuvy Support" <support@zuvy.org>', // sender address
      to: to, // list of receivers
      subject: `Action Required: Confirm Deletion of ${orgName}`, // Subject line
      html: `
        <h1>Organization Deletion Request</h1>
        <p>A request has been made to delete the organization <b>${orgName}</b>.</p>
        <p>If you approve this action, please click the link below to confirm the deletion:</p>
        <a href="${deleteLink}">Confirm Deletion</a>
        <p><b>This action cannot be undone.</b></p>
        <p>If you did not request this, please ignore this email and contact support immediately.</p>
      `, // html body
    });
    return info;
  }
}
