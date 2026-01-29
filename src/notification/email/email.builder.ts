import { NotificationEmailService } from './email.service';

/**
 * Builder class for constructing email requests.
 * Allows for fluent configuration of email details before sending.
 */
export class EmailBuilder {
  private _to: string;
  private _subject: string;
  private _template: string;
  private _data: Record<string, any> = {};
  private _provider: string = 'gmail'; // Default provider
  private _config: any = {};

  constructor(private readonly emailService: NotificationEmailService) {}

  /**
   * Sets the recipient email address.
   * @param to The email address of the recipient.
   */
  setTo(to: string): EmailBuilder {
    this._to = to;
    return this;
  }

  /**
   * Sets the subject line of the email.
   * @param subject The subject text.
   */
  setSubject(subject: string): EmailBuilder {
    this._subject = subject;
    return this;
  }

  /**
   * Sets the email template content (HTML).
   * @param template The HTML template string.
   */
  setTemplate(template: string): EmailBuilder {
    this._template = template;
    return this;
  }

  /**
   * Sets the data to be used for template rendering.
   * @param data Key-value pairs for dynamic content.
   */
  setData(data: Record<string, any>): EmailBuilder {
    this._data = data;
    return this;
  }

  /**
   * Sets the email provider to use.
   * @param provider The provider name (e.g., 'gmail', 'ses', 'smtp').
   */
  setProvider(provider: string): EmailBuilder {
    this._provider = provider.toLowerCase();
    return this;
  }

  /**
   * Sets additional configuration for the provider (e.g., specific options, credentials).
   * @param config The configuration object.
   */
  setConfig(config: any): EmailBuilder {
    this._config = config;
    return this;
  }

  // Getters
  get to(): string {
    return this._to;
  }

  get subject(): string {
    return this._subject;
  }

  get template(): string {
    return this._template;
  }

  get data(): Record<string, any> {
    return this._data;
  }

  get provider(): string {
    return this._provider;
  }

  get config(): any {
    return this._config;
  }

  /**
   * Triggers the email sending process via the NotificationEmailService.
   * @returns The result of the send operation.
   */
  async send(): Promise<any> {
    return this.emailService.sendEmail(this);
  }
}
