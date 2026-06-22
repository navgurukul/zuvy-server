import { Injectable } from '@nestjs/common';

@Injectable()
export class TemplateService {
  /**
   * Replaces placeholders in the format {{key}} with values from the data object.
   * @param template The template string (e.g., "Hello {{name}}")
   * @param data The data object (e.g., { name: "John" })
   * @returns The rendered string
   */
  render(template: string, data: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] !== undefined ? data[key] : match;
    });
  }
}
