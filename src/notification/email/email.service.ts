import { Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { TemplateService } from './templates/template.service';
import { EmailProvider } from './providers/email-provider.interface';
import { EmailBuilder } from './email.builder';

@Injectable()
export class NotificationEmailService {
  private readonly logger = new Logger(NotificationEmailService.name);

  constructor(
    private moduleRef: ModuleRef,
    private templateService: TemplateService,
  ) {}

  createEmail(): EmailBuilder {
    return new EmailBuilder(this);
  }

  async sendEmail(builder: EmailBuilder) {
    const providerName = builder.provider;
    let provider: EmailProvider;

    try {
      provider = this.moduleRef.get(providerName, { strict: false });
    } catch (e) {
      throw new Error(
        `Email provider '${providerName}' not found or not supported.`,
      );
    }

    const body = this.templateService.render(builder.template, builder.data);

    try {
      this.logger.log(`Sending email via ${providerName} to ${builder.to}`);
      const result = await provider.sendEmail(
        builder.to,
        builder.subject,
        body,
        builder.config,
      );
      this.logger.log(`Email sent successfully via ${providerName}`);
      return result;
    } catch (error) {
      this.logger.error(
        `Failed to send email via ${providerName}: ${error.message}`,
      );
      throw error;
    }
  }
}
