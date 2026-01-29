import { Module } from '@nestjs/common';
import { NotificationEmailService } from './email/email.service';
import { GmailProvider } from './email/providers/gmail.provider';
import { OutlookProvider } from './email/providers/outlook.provider';
import { YahooProvider } from './email/providers/yahoo.provider';
import { SmtpProvider } from './email/providers/smtp.provider';
import { SesProvider } from './email/providers/ses.provider';
import { TemplateService } from './email/templates/template.service';

@Module({
  providers: [
    NotificationEmailService,
    TemplateService,
    { provide: 'gmail', useClass: GmailProvider },
    { provide: 'outlook', useClass: OutlookProvider },
    { provide: 'yahoo', useClass: YahooProvider },
    { provide: 'smtp', useClass: SmtpProvider },
    { provide: 'ses', useClass: SesProvider },
  ],
  exports: [NotificationEmailService],
})
export class NotificationModule {}
