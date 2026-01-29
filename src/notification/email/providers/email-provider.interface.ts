export interface EmailProvider {
  sendEmail(
    to: string,
    subject: string,
    body: string,
    config?: any,
  ): Promise<any>;
}
