/* eslint-disable prettier/prettier */
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import * as mammoth from 'mammoth';
import pdfParse from 'pdf-parse';
import { inflateSync } from 'zlib';
import { eq, sql } from 'drizzle-orm';
import { db } from '../../db/index';
import { zuvyLearnersCompleteProfile } from '../../../drizzle/schema';
import { ResumeResponseDto } from './dto/learner.dto';

const PREDEFINED_SKILLS = [
  // Languages
  'JavaScript',
  'TypeScript',
  'Python',
  'Java',
  'C++',
  'C#',
  'Go',
  'Rust',
  'PHP',
  'Ruby',
  'Swift',
  'Kotlin',
  'Dart',
  'Scala',
  'Perl',
  'MATLAB',
  // Frontend
  'React',
  'Angular',
  'Vue',
  'Svelte',
  'Next.js',
  'Nuxt.js',
  'HTML',
  'CSS',
  'SASS',
  'SCSS',
  'Less',
  'Tailwind',
  'Bootstrap',
  'jQuery',
  'Redux',
  'Material UI',
  // Backend
  'Node.js',
  'NestJS',
  'Express',
  'Django',
  'Flask',
  'FastAPI',
  'Spring',
  'Spring Boot',
  'Laravel',
  'Rails',
  'ASP.NET',
  // Databases
  'SQL',
  'PostgreSQL',
  'MySQL',
  'MongoDB',
  'Redis',
  'SQLite',
  'Oracle',
  'DynamoDB',
  'Cassandra',
  'Elasticsearch',
  // DevOps / Cloud
  'Docker',
  'Kubernetes',
  'AWS',
  'Azure',
  'GCP',
  'Terraform',
  'Jenkins',
  'CI/CD',
  'Nginx',
  'Apache',
  // Tools
  'Git',
  'GitHub',
  'GitLab',
  'Bitbucket',
  'JIRA',
  'Confluence',
  'Figma',
  'Sketch',
  'Adobe XD',
  // Mobile
  'React Native',
  'Flutter',
  'Android',
  'iOS',
  'Xamarin',
  // Data / ML
  'TensorFlow',
  'PyTorch',
  'Pandas',
  'NumPy',
  'Scikit-learn',
  'Tableau',
  'Power BI',
  // APIs
  'REST',
  'GraphQL',
  'gRPC',
  // Other
  'Linux',
  'Unix',
  'Webpack',
  'Babel',
  'Firebase',
  'RabbitMQ',
  'Kafka',
  'Selenium',
  'Cypress',
  'MS Word',
  'MS Excel',
  'MS Office',
  'MS PowerPoint',
  'Tally',
  'SAP',
  'AutoCAD',
];

const EDUCATION_KEYWORDS = [
  'B.Tech',
  'M.Tech',
  'MBA',
  'BSc',
  'MSc',
  'B.E',
  'M.E',
  'BCA',
  'MCA',
  'PhD',
  'Diploma',
  'Bachelor',
  'Master',
  'B.A',
  'M.A',
  'B.Com',
  'M.Com',
  'B.Sc',
  'M.Sc',
  'B.B.A',
  'PGDM',
  'LLB',
  'LLM',
  'B.Arch',
  'M.Arch',
  'B.Pharm',
  'M.Pharm',
  'B.Des',
  'M.Des',
  'BE',
  'ME',
  'BTech',
  'MTech',
  'Associate',
  'Intermediate',
  'High School',
  'HSC',
  'SSC',
  'CBSE',
  'ICSE',
  'GED',
  'BA',
  'MA',
  'BCom',
  'MCom',
  'Inter',
  '10th',
  '12th',
  '10+2',
  'Software Programming Course',
  'Software Engineering',
];

const PREDEFINED_ROLES = [
  'Software Development Engineer (SDE)',
  'Software Engineer',
  'Full Stack Developer',
  'Frontend Developer',
  'Backend Developer',
  'Web Developer',
  'Mobile App Developer',
  'Android Developer',
  'iOS Developer',
  'DevOps Engineer',
  'Cloud Engineer',
  'Data Analyst',
  'Data Scientist',
  'Machine Learning Engineer',
  'QA Engineer',
  'Automation Test Engineer',
  'UI UX Designer',
  'Product Manager',
  'Business Analyst',
  'Cybersecurity Analyst',
];

const COMMON_LOCATIONS = new Set([
  'udaipur',
  'jaipur',
  'delhi',
  'mumbai',
  'pune',
  'bengaluru',
  'bangalore',
  'hyderabad',
  'chennai',
  'kolkata',
  'ahmedabad',
  'lucknow',
  'noida',
  'gurgaon',
  'gurugram',
  'chandigarh',
  'indore',
  'bhopal',
  'patna',
  'kochi',
  'coimbatore',
  'surat',
  'nagpur',
  'varanasi',
  'kanpur',
  'jodhpur',
  'kota',
  'nashik',
  'rajkot',
  'ranchi',
  'guwahati',
  'mysore',
  'mangalore',
  'bhubaneswar',
  'raipur',
  'dehradun',
  'agra',
  'meerut',
  'ludhiana',
  'amritsar',
  'jammu',
  'thiruvananthapuram',
  'vizag',
  'faridabad',
  'ghaziabad',
  'rajasthan',
  'maharashtra',
  'karnataka',
  'new york',
  'san francisco',
  'los angeles',
  'chicago',
  'seattle',
  'boston',
  'austin',
  'denver',
  'london',
  'toronto',
  'berlin',
  'paris',
  'singapore',
  'dubai',
  'sydney',
  'melbourne',
]);

const PDF_INTERNAL_WORDS = new Set([
  'pdf',
  'obj',
  'endobj',
  'stream',
  'endstream',
  'xref',
  'trailer',
  'startxref',
  'catalog',
  'filter',
  'flatedecode',
  'length',
]);

type ExtractedProject = {
  title: string;
  description?: string;
  techStack?: string[];
};

@Injectable()
export class LearnerResumeService {
  // Largest font text detected by pdfjs — typically the person's name
  private pdfJsLargestFontText = '';
  private s3: S3Client;
  private bucket: string;
  private region: string = 'ap-south-1';

  constructor(private config: ConfigService) {
    this.bucket = this.config.get('S3_BUCKET_NAME');
    this.s3 = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.config.get('S3_ACCESS_KEY_ID'),
        secretAccessKey: this.config.get('S3_SECRET_KEY_ACCESS'),
      },
    });
  }

  async parseResume(
    file: Express.Multer.File,
  ): Promise<{ success: boolean; data: ResumeResponseDto }> {
    this.pdfJsLargestFontText = '';
    const resumeText = this.cleanExtractedText(
      await this.extractResumeText(file),
    );
    // Join broken URLs across lines before extraction
    const textForUrls = this.joinBrokenUrls(resumeText);

    let data: ResumeResponseDto = {
      name: this.extractName(resumeText),
      email: this.extractEmail(textForUrls),
      phone: this.extractPhone(resumeText),
      linkedin: this.extractLinkedin(textForUrls),
      github: this.extractGithub(textForUrls),
      skills: this.extractSkills(resumeText),
      education: this.extractEducation(resumeText),
      roles: this.extractRoles(resumeText),
      locations: this.extractLocations(resumeText),
      projects: this.extractProjects(resumeText),
    };

    if (this.isLowConfidenceExtraction(data)) {
      data = {
        name: '',
        email: '',
        phone: '',
        linkedin: '',
        github: '',
        skills: [],
        education: [],
        roles: [],
        locations: [],
        projects: [],
      };
    }

    return {
      success: true,
      data,
    };
  }

  private async extractResumeText(file: Express.Multer.File): Promise<string> {
    if (file.mimetype === 'application/pdf') {
      // 1. Try pdfjs-dist (Mozilla PDF.js) — handles most modern PDFs
      try {
        const pdfjsText = await this.extractTextWithPdfJs(file.buffer);
        if (this.isUsableResumeText(pdfjsText)) {
          return pdfjsText;
        }
      } catch {
        // pdfjs-dist failed, continue to next method
      }

      // 2. Try pdf-parse
      try {
        const parsedPdf = await pdfParse(file.buffer);
        const parsedText = this.normalizeText(parsedPdf.text || '');

        if (this.isUsableResumeText(parsedText)) {
          return parsedText;
        }
      } catch {
        // pdf-parse failed, continue to next method
      }

      // 3. Manual stream extraction fallback
      try {
        const fallbackText = this.extractPdfTextFromStreams(file.buffer);
        if (this.isUsableResumeText(fallbackText)) {
          return fallbackText;
        }
      } catch {
        // stream extraction failed
      }

      return '';
    }

    if (
      file.mimetype ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      try {
        const parsedDocx = await mammoth.extractRawText({
          buffer: file.buffer,
        });
        return this.normalizeText(parsedDocx.value || '');
      } catch {
        throw new BadRequestException(
          'Unable to parse DOCX resume. Please upload a valid DOCX file.',
        );
      }
    }

    throw new BadRequestException('Only PDF or DOCX resume files are allowed');
  }

  private normalizeText(text: string): string {
    return text
      .replace(/\r/g, '\n')
      .replace(/\n{2,}/g, '\n')
      .trim();
  }

  private async extractTextWithPdfJs(buffer: Buffer): Promise<string> {
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const data = new Uint8Array(buffer);
    const doc = await pdfjsLib.getDocument({ data, useSystemFonts: true })
      .promise;

    const pageTexts: string[] = [];
    const annotationUrls: string[] = [];

    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();

      // Extract link annotations (GitHub, LinkedIn URLs stored as hyperlinks)
      try {
        const annotations = await page.getAnnotations();
        for (const annot of annotations) {
          if (annot.subtype === 'Link' && annot.url) {
            annotationUrls.push(annot.url);
          }
        }
      } catch {
        // annotation extraction failed, continue
      }

      // Collect text items with position info
      const items: { str: string; x: number; y: number; fontSize: number }[] =
        [];
      for (const item of content.items) {
        if (!('str' in item)) continue;
        const transform = (item as any).transform;
        items.push({
          str: item.str,
          x: transform?.[4] ?? 0,
          y: transform?.[5] ?? 0,
          fontSize: Math.abs(transform?.[0] ?? 12),
        });
      }

      // Sort by Y descending (PDF Y=0 is bottom), then X ascending
      items.sort((a, b) => b.y - a.y || a.x - b.x);

      // Detect largest-font text (usually the person's name)
      if (items.length > 0) {
        const maxFs = Math.max(...items.map((it) => it.fontSize));
        if (maxFs > 14 && !this.pdfJsLargestFontText) {
          const largestItems = items
            .filter((it) => Math.abs(it.fontSize - maxFs) < 1 && it.str.trim())
            .sort((a, b) => a.x - b.x);
          const candidate = largestItems
            .map((it) => it.str.trim())
            .join(' ')
            .trim();
          if (
            candidate.length >= 3 &&
            candidate.length <= 50 &&
            /^[A-Za-z][A-Za-z'\-\s]+$/.test(candidate)
          ) {
            this.pdfJsLargestFontText = candidate;
          }
        }
      }

      // Group into lines by Y proximity
      const lines: string[] = [];
      let currentLine: typeof items = [];
      let lastY: number | null = null;

      for (const item of items) {
        if (lastY !== null && Math.abs(item.y - lastY) > 3) {
          if (currentLine.length > 0) {
            lines.push(currentLine.map((it) => it.str).join(' '));
          }
          currentLine = [];
        }
        currentLine.push(item);
        lastY = item.y;
      }
      if (currentLine.length > 0) {
        lines.push(currentLine.map((it) => it.str).join(' '));
      }

      pageTexts.push(lines.join('\n'));
    }

    // Append annotation URLs so LinkedIn/GitHub extractors can find them
    if (annotationUrls.length > 0) {
      pageTexts.push(annotationUrls.join('\n'));
    }

    return this.normalizeText(pageTexts.join('\n'));
  }

  private extractPdfTextFromStreams(buffer: Buffer): string {
    const rawPdf = buffer.toString('latin1');
    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    const extractedChunks: string[] = [];

    let match: RegExpExecArray | null;
    while ((match = streamRegex.exec(rawPdf)) !== null) {
      const streamData = Buffer.from(match[1], 'latin1');

      const decodedStreamCandidates: string[] = [];

      try {
        decodedStreamCandidates.push(
          inflateSync(streamData).toString('latin1'),
        );
      } catch {
        decodedStreamCandidates.push(streamData.toString('latin1'));
      }

      for (const candidate of decodedStreamCandidates) {
        const chunks = this.extractTextFragments(candidate);
        if (chunks.length > 0) {
          extractedChunks.push(...chunks);
        }
      }
    }

    return this.normalizeText(extractedChunks.join(' '));
  }

  private extractTextFragments(content: string): string[] {
    const fragments: string[] = [];
    const textInParens = /\(([^()]*)\)\s*Tj/g;
    const arrayText = /\[(.*?)\]\s*TJ/g;

    let parenMatch: RegExpExecArray | null;
    while ((parenMatch = textInParens.exec(content)) !== null) {
      fragments.push(this.decodePdfEscapedString(parenMatch[1]));
    }

    let arrayMatch: RegExpExecArray | null;
    while ((arrayMatch = arrayText.exec(content)) !== null) {
      const inner = arrayMatch[1];
      const innerTextRegex = /\(([^()]*)\)/g;
      let innerMatch: RegExpExecArray | null;

      while ((innerMatch = innerTextRegex.exec(inner)) !== null) {
        fragments.push(this.decodePdfEscapedString(innerMatch[1]));
      }
    }

    return fragments
      .map((fragment) => fragment.replace(/\s+/g, ' ').trim())
      .filter((fragment) => fragment.length > 0);
  }

  private decodePdfEscapedString(value: string): string {
    return value
      .replace(/\\([0-7]{3})/g, (_match, octal) =>
        String.fromCharCode(parseInt(octal, 8)),
      )
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\\\/g, '\\');
  }

  private extractName(text: string): string {
    // Priority 1: Use largest-font text from pdfjs (most reliable for PDF resumes)
    if (this.pdfJsLargestFontText) {
      const candidate = this.toTitleCase(this.pdfJsLargestFontText);
      if (
        this.isLikelyPersonName(candidate) &&
        !this.isPlaceholderName(candidate)
      ) {
        return this.filterLocationFromName(candidate);
      }
    }

    // Priority 2: Scan first few lines
    const topBlock = text.slice(0, 1200);
    const lines = topBlock
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 8);

    for (const line of lines) {
      const cleanedLine = line.replace(/\s+/g, ' ').trim();

      if (cleanedLine.length < 3 || this.isPlaceholderName(cleanedLine)) {
        continue;
      }

      // If line is short enough, try exact match
      if (cleanedLine.length <= 45) {
        const lineNameMatch = cleanedLine.match(
          /^([A-Za-z][A-Za-z'\-]{1,20}(?:\s+[A-Za-z][A-Za-z'\-]{1,20}){1,3})$/,
        );

        if (lineNameMatch) {
          const candidate = this.toTitleCase(lineNameMatch[1]);
          if (this.isLikelyPersonName(candidate)) {
            return this.filterLocationFromName(candidate);
          }
        }
      }

      // If line is long (merged columns), try extracting name from the beginning
      if (cleanedLine.length > 45) {
        const beginMatch = cleanedLine.match(
          /^([A-Za-z][A-Za-z'\-]{1,20}(?:\s+[A-Za-z][A-Za-z'\-]{1,20}){1,2})/,
        );
        if (beginMatch) {
          const candidate = this.toTitleCase(beginMatch[1]);
          if (this.isLikelyPersonName(candidate)) {
            return this.filterLocationFromName(candidate);
          }
        }
      }
    }
    const normalized = this.normalizeForPatternMatching(topBlock);
    const nameMatch = normalized.match(
      /\b([A-Za-z][A-Za-z'\-]{1,20}\s+[A-Za-z][A-Za-z'\-]{1,20}(?:\s+[A-Za-z][A-Za-z'\-]{1,20})?)\b/,
    );
    if (nameMatch?.[1]) {
      const candidate = this.toTitleCase(nameMatch[1]);
      if (
        this.isLikelyPersonName(candidate) &&
        !this.isPlaceholderName(candidate)
      ) {
        return this.filterLocationFromName(candidate);
      }
    }

    const email = this.extractEmail(text);
    const prelude = email
      ? text.slice(0, Math.max(0, text.indexOf(email)))
      : text.slice(0, 180);

    const words = (prelude.match(/[A-Za-z]+/g) || []).filter(
      (word) =>
        !['email', 'linkedin', 'github', 'portfolio'].includes(
          word.toLowerCase(),
        ),
    );

    if (words.length >= 2) {
      return words.slice(0, 2).join(' ');
    }

    const firstLine = text
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.length > 0);

    if (firstLine && firstLine.length > 80) {
      const clippedName = (firstLine.match(/[A-Za-z]+/g) || [])
        .slice(0, 2)
        .join(' ');
      return clippedName || firstLine;
    }

    return firstLine || '';
  }

  private isPlaceholderName(value: string): boolean {
    const normalized = value.trim().toLowerCase();
    return [
      'student example',
      'your name',
      'first last',
      'full name',
      'resume template',
      'curriculum vitae',
    ].includes(normalized);
  }

  private isLikelyPersonName(value: string): boolean {
    const words = value
      .split(/\s+/)
      .map((word) => word.trim())
      .filter(Boolean);

    if (words.length < 2 || words.length > 4) {
      return false;
    }

    const blockedWords = new Set([
      'resume',
      'developer',
      'engineer',
      'education',
      'skills',
      'experience',
      'portfolio',
      'contact',
      'summary',
      'objective',
      'student',
      'example',
      // Section / label words that appear in resumes
      'technologies',
      'front-end',
      'frontend',
      'back-end',
      'backend',
      'database',
      'databases',
      'tools',
      'languages',
      'soft',
      'programming',
      'technical',
      'professional',
      'management',
      'coordinator',
      'projects',
      'certifications',
      'achievements',
      'references',
      'interests',
      'hobbies',
      'publications',
      'core',
      'key',
      'volunteer',
      'work',
      'personal',
      'details',
      'information',
      'profile',
      // Social labels (not person names)
      'github',
      'linkedin',
      'twitter',
      'website',
      // Common non-name words
      'working',
      'with',
      'using',
      'building',
      'creating',
      'learning',
      'developing',
      'designing',
      'managing',
      'testing',
      'deploying',
      'overview',
      'introduction',
      'about',
      'llms',
      'llm',
      'apis',
      'ai',
      'ml',
      'data',
      'science',
      'analytics',
      'system',
      'systems',
      'application',
      'applications',
      'services',
      'solutions',
      'internship',
      // PDF internal keywords
      'pdf',
      'obj',
      'endobj',
      'stream',
      'endstream',
      'xref',
      'trailer',
      'catalog',
      'filter',
      'flatedecode',
      'length',
      'startxref',
    ]);

    return words.every((word) => {
      const lower = word.toLowerCase();
      return (
        !blockedWords.has(lower) && /^[A-Za-z][A-Za-z'\-]{1,20}$/.test(word)
      );
    });
  }

  private filterLocationFromName(name: string): string {
    const words = name.split(/\s+/);
    if (words.length <= 2) return name;

    // Remove trailing words that are known locations
    const filtered = [...words];
    while (
      filtered.length > 2 &&
      COMMON_LOCATIONS.has(filtered[filtered.length - 1].toLowerCase())
    ) {
      filtered.pop();
    }

    return filtered.join(' ');
  }

  private toTitleCase(value: string): string {
    return value
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  private extractEmail(text: string): string {
    const emailRegex =
      /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}(?![A-Z0-9._%+-])/i;
    const compactText = this.normalizeContactText(text);
    return (
      compactText.match(emailRegex)?.[0] || text.match(emailRegex)?.[0] || ''
    );
  }

  private extractPhone(text: string): string {
    const phoneCandidates =
      text.match(/(?:\+?\d[\d\s()-]{8,}\d)/g)?.map((item) => item.trim()) || [];

    for (const candidate of phoneCandidates) {
      if (candidate.includes('.')) {
        continue;
      }

      const digitsOnly = candidate.replace(/\D/g, '');

      if (/^20\d{12}$/.test(digitsOnly)) {
        continue;
      }

      const hasSeparator = /[\s()-]/.test(candidate);
      // Allow up to 13 digits without separator (e.g., +917088373643 = 12 digits)
      if (!hasSeparator && digitsOnly.length > 13) {
        continue;
      }

      // Reject sequences that look like PDF object IDs or random number strings
      // Valid phones should have grouping patterns (e.g., +91 98765 43210)
      const groups = candidate
        .trim()
        .split(/[\s()-]+/)
        .filter(Boolean);
      if (
        groups.length > 3 &&
        groups.every((g) => g.replace(/\D/g, '').length <= 4)
      ) {
        continue;
      }

      if (digitsOnly.length >= 10 && digitsOnly.length <= 15) {
        return candidate.replace(/\s+/g, ' ').trim();
      }
    }

    return '';
  }

  private extractLinkedin(text: string): string {
    const compactText = this.normalizeContactText(text);
    const linkedinRegex =
      /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([A-Za-z0-9\-_]+)/i;
    const username = compactText.match(linkedinRegex)?.[1] || '';

    if (!username) return '';
    return `https://www.linkedin.com/in/${username}`;
  }

  private extractGithub(text: string): string {
    const compactText = this.normalizeContactText(text);
    const githubRegex =
      /(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9\-]+)/i;
    const username = compactText.match(githubRegex)?.[1] || '';

    if (!username) return '';
    return `https://github.com/${username}`;
  }

  private extractSkills(text: string): string[] {
    // 1. Match against predefined skills list
    const matchedSkills = PREDEFINED_SKILLS.filter((skill) => {
      if (skill === 'C++') {
        return /(?:^|\W)c\+\+(?:$|\W)/i.test(text);
      }

      if (skill === 'C#') {
        return /(?:^|\W)c#(?:$|\W)/i.test(text);
      }

      const escapedSkill = skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const skillRegex = new RegExp(`\\b${escapedSkill}\\b`, 'i');
      return skillRegex.test(text);
    });

    // 2. Extract skills from dedicated "Skills" section
    const sectionSkills = this.extractSkillsFromSection(text);

    // 3. Combine and deduplicate
    const allSkills = Array.from(new Set(matchedSkills.concat(sectionSkills)));

    if (allSkills.includes('GitHub')) {
      return allSkills.filter((skill) => skill !== 'Git');
    }

    return allSkills;
  }

  private extractSkillsFromSection(text: string): string[] {
    const sectionPattern =
      /(?:^|\n)\s*(?:technical\s+|core\s+|key\s+|professional\s+)?skills?\s*[:\-|\n]/i;
    const sectionMatch = sectionPattern.exec(text);
    if (!sectionMatch) return [];

    const startIdx = sectionMatch.index + sectionMatch[0].length;
    const restText = text.slice(startIdx);

    // Find next major section header
    const nextSectionPattern =
      /\n\s*(?:education|experience|work\s*experience|employment|projects?|certifications?|achievements?|awards?|publications?|languages?|hobbies|interests|references?|objective|summary|profile|about\s*me|volunteering|volunteer)\s*[:\-|\n]/i;
    const nextMatch = nextSectionPattern.exec(restText);
    const sectionText = nextMatch
      ? restText.slice(0, nextMatch.index)
      : restText.slice(0, 600);

    const items: string[] = [];
    const lines = sectionText
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    for (const line of lines) {
      // Remove bullet markers
      const cleanLine = line
        .replace(
          /^[\u2022\-*\u25E6\u25AA\u25BA\u27A4\u27A2\u2713\u2714\u2192]\s*/,
          '',
        )
        .trim();
      if (!cleanLine) continue;

      // Skip lines that are URLs
      if (/^https?:\/\//i.test(cleanLine)) continue;
      // Skip lines that look like sentences (contain common sentence words)
      if (
        /\b(the|this|that|with|from|into|have|has|was|were|been|being|does|did|will|would|could|should|shall|may|might|can|for|but|not|you|all|can|her|his|our|they|are|its)\b/i.test(
          cleanLine,
        )
      )
        continue;

      // Split by commas, pipes, semicolons
      const parts = cleanLine
        .split(/[,|;]+/)
        .map((p) => p.replace(/[.]+$/, '').trim())
        .filter((p) => p.length >= 1 && p.length <= 40);

      for (const part of parts) {
        const wordCount = part.split(/\s+/).length;
        // Only accept 1-3 word items as skills
        if (wordCount > 3) continue;
        // Skip common filler words
        if (/^(and|or|the|with|in|on|for|of|to|a|an|etc|basic)$/i.test(part))
          continue;
        // Skip URLs
        if (/https?:\/\//i.test(part)) continue;
        items.push(part);
      }
    }

    return Array.from(new Set(items));
  }

  private extractEducation(text: string): string[] {
    // 1. Match against predefined education keywords
    const matchedEducation = EDUCATION_KEYWORDS.filter((keyword) => {
      const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      // Short keywords (2 chars like ME, BE, BA, MA) must match case-sensitively
      // to avoid false positives with common words ("me", "be", "ma")
      if (keyword.length <= 2 && /^[A-Z]+$/.test(keyword)) {
        const degreeRegex = new RegExp(
          `(?<![A-Za-z])${escapedKeyword}(?![A-Za-z])`,
        );
        return degreeRegex.test(text);
      }
      const degreeRegex = new RegExp(
        `(?<![A-Za-z])${escapedKeyword}(?![A-Za-z])`,
        'i',
      );
      return degreeRegex.test(text);
    });

    // 2. Extract from dedicated "Education" section
    const sectionEducation = this.extractEducationFromSection(text);

    return Array.from(new Set(matchedEducation.concat(sectionEducation)));
  }

  private extractEducationFromSection(text: string): string[] {
    const sectionPattern = /(?:^|\n)\s*education\s*[:\-|\n]/i;
    const sectionMatch = sectionPattern.exec(text);
    if (!sectionMatch) return [];

    const startIdx = sectionMatch.index + sectionMatch[0].length;
    const restText = text.slice(startIdx);

    const nextSectionPattern =
      /\n\s*(?:skills?|experience|work\s*experience|employment|projects?|certifications?|achievements?|awards?|publications?|languages?|hobbies|interests|references?|objective|summary|profile|about\s*me|volunteering|volunteer)\s*[:\-|\n]/i;
    const nextMatch = nextSectionPattern.exec(restText);
    const sectionText = nextMatch
      ? restText.slice(0, nextMatch.index)
      : restText.slice(0, 1500);

    const items: string[] = [];

    // Match degree patterns like "B.Tech in Computer Science", "Bachelor of Arts", "BA", "12th"
    const degreePatterns = [
      /\b(B\.?Tech|M\.?Tech|B\.?E|M\.?E|B\.?Sc|M\.?Sc|B\.?A|M\.?A|B\.?Com|M\.?Com|BCA|MCA|MBA|PhD|Diploma|Bachelor(?:'?s)?|Master(?:'?s)?|Associate(?:'?s)?|BA|MA|BCom|MCom|BE|ME|BTech|MTech)\b(?:\s+(?:of|in)\s+[\w\s&]+)?/gi,
      /\b(High School|Intermediate|HSC|SSC|CBSE|ICSE|GED|10th|12th|10\+2|Inter)\b/gi,
      /\b(Software\s+Programming\s+Course|Software\s+Engineering|Software\s+Development\s+Diploma|Web\s+Development)\b/gi,
    ];

    for (const pattern of degreePatterns) {
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(sectionText)) !== null) {
        const extracted = match[0].trim();
        if (extracted.length <= 80) {
          items.push(extracted);
        }
      }
    }

    return Array.from(new Set(items));
  }

  private extractProjects(text: string): ExtractedProject[] {
    const sectionPattern =
      /(?:^|\n)\s*(?:projects?|personal\s+projects?|academic\s+projects?)\s*[:\-|\n]/i;
    const sectionMatch = sectionPattern.exec(text);
    if (!sectionMatch) return [];

    const startIdx = sectionMatch.index + sectionMatch[0].length;
    const restText = text.slice(startIdx);

    const nextSectionPattern =
      /\n\s*(?:education|experience|work\s*experience|employment|skills?|certifications?|achievements?|awards?|publications?|languages?|hobbies|interests|references?|objective|summary|profile|about\s*me|volunteering|volunteer)\s*[:\-|\n]/i;
    const nextMatch = nextSectionPattern.exec(restText);
    const sectionText = nextMatch
      ? restText.slice(0, nextMatch.index)
      : restText.slice(0, 1800);

    const lines = sectionText
      .split('\n')
      .map((line) =>
        line
          .trim()
          .replace(
            /^[\u2022\-*\u25E6\u25AA\u25BA\u27A4\u27A2\u2713\u2714\u2192\d.)\s]+/,
            '',
          )
          .trim(),
      )
      .filter(Boolean);

    const projects: ExtractedProject[] = [];
    let currentProject: ExtractedProject | null = null;

    for (const line of lines) {
      if (/^https?:\/\//i.test(line)) {
        continue;
      }

      const isHeadingNoise =
        /^(projects?|project\s+details?|description|responsibilities?|achievements?|technologies|tech\s*stack|role)$/i.test(
          line,
        );
      if (isHeadingNoise) {
        continue;
      }

      const words = line.split(/\s+/).filter(Boolean);
      const hasInlineSeparator = /\s[:\-|]\s/.test(line);
      const looksLikeTitle =
        words.length >= 2 &&
        words.length <= 12 &&
        !/[.!?]$/.test(line) &&
        !/^built\s|^developed\s|^implemented\s|^designed\s|^created\s/i.test(
          line,
        );

      if (hasInlineSeparator || looksLikeTitle) {
        if (currentProject?.title) {
          projects.push(currentProject);
        }

        const split = line.split(/\s[:\-|]\s(.+)/);
        const title = (split[0] || '').trim();
        const inlineDescription = (split[1] || '').trim();

        if (!title || title.length > 120) {
          currentProject = null;
          continue;
        }

        currentProject = {
          title,
          description: inlineDescription || undefined,
        };

        const techStack = this.extractSkills(`${title} ${inlineDescription}`);
        if (techStack.length > 0) {
          currentProject.techStack = techStack.slice(0, 8);
        }
        continue;
      }

      if (currentProject) {
        const mergedDescription = [currentProject.description, line]
          .filter(Boolean)
          .join(' ')
          .trim()
          .slice(0, 255);

        currentProject.description = mergedDescription;

        const techStack = this.extractSkills(
          `${currentProject.title} ${currentProject.description || ''}`,
        );
        if (techStack.length > 0) {
          currentProject.techStack = techStack.slice(0, 8);
        }
      }
    }

    if (currentProject?.title) {
      projects.push(currentProject);
    }

    const deduped = new Map<string, ExtractedProject>();
    for (const project of projects) {
      const key = project.title.toLowerCase().trim();
      if (!deduped.has(key)) {
        deduped.set(key, project);
      }
    }

    return Array.from(deduped.values()).slice(0, 10);
  }

  private extractRoles(text: string): string[] {
    const matchedRoles = PREDEFINED_ROLES.filter((role) => {
      const escapedRole = role.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const roleRegex = new RegExp(
        `(?<![A-Za-z])${escapedRole}(?![A-Za-z])`,
        'i',
      );
      return roleRegex.test(text);
    });

    const sectionRoles = this.extractRolesFromSection(text);

    return Array.from(new Set([...matchedRoles, ...sectionRoles])).slice(0, 10);
  }

  private extractRolesFromSection(text: string): string[] {
    const sectionPattern =
      /(?:^|\n)\s*(?:target\s+)?roles?|position\s+applied\s+for|job\s+role\s*[:\-|\n]/i;
    const sectionMatch = sectionPattern.exec(text);
    if (!sectionMatch) return [];

    const startIdx = sectionMatch.index + sectionMatch[0].length;
    const restText = text.slice(startIdx);

    const nextSectionPattern =
      /\n\s*(?:education|experience|work\s*experience|employment|projects?|skills?|certifications?|achievements?|awards?|publications?|languages?|hobbies|interests|references?|objective|summary|profile|about\s*me|volunteering|volunteer)\s*[:\-|\n]/i;
    const nextMatch = nextSectionPattern.exec(restText);
    const sectionText = nextMatch
      ? restText.slice(0, nextMatch.index)
      : restText.slice(0, 600);

    const items = sectionText
      .split(/[\n,;|]+/)
      .map((item) =>
        item
          .trim()
          .replace(
            /^[\u2022\-*\u25E6\u25AA\u25BA\u27A4\u27A2\u2713\u2714\u2192\d.)\s]+/,
            '',
          ),
      )
      .map((item) => item.replace(/\s+/g, ' ').trim())
      .filter((item) => item.length >= 3 && item.length <= 80)
      .filter((item) =>
        /(engineer|developer|analyst|designer|manager|tester|architect|scientist)/i.test(
          item,
        ),
      );

    return Array.from(new Set(items.map((item) => this.toTitleCase(item))));
  }

  private extractLocations(text: string): string[] {
    const normalizedText = text.toLowerCase();
    const locations = new Set<string>();

    for (const location of COMMON_LOCATIONS) {
      const escapedLocation = location.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const locationRegex = new RegExp(
        `(?<![a-z])${escapedLocation}(?![a-z])`,
        'i',
      );
      if (locationRegex.test(normalizedText)) {
        locations.add(this.toTitleCase(location));
      }
    }

    if (/\b(remote|work\s*from\s*home|wfh)\b/i.test(text)) {
      locations.add('Work From Home');
    }

    return Array.from(locations).slice(0, 10);
  }

  private normalizeContactText(text: string): string {
    return text
      .replace(/\s*@\s*/g, '@')
      .replace(/\s*\.\s*/g, '.')
      .replace(/\s*\/\s*/g, '/')
      .replace(/\s*:\s*/g, ':')
      .replace(/\s*\|\s*/g, '|')
      .replace(/\s+/g, ' ')
      .replace(/[^\x20-\x7E]/g, '')
      .trim();
  }

  private joinBrokenUrls(text: string): string {
    const lines = text.split('\n');
    const result: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const urlTail = /(?:linkedin\.com\/in|github\.com)\/[A-Za-z0-9\-_]*$/i;
      if (urlTail.test(line.trim()) && i + 1 < lines.length) {
        const next = lines[i + 1].trim();
        if (/^[A-Za-z0-9\-_]/.test(next) && !/:/.test(next.slice(0, 10))) {
          // Only take the URL continuation part (alphanumeric, hyphens, underscores)
          // Stop at first space or non-URL character to avoid merging email/other text
          const urlContinuation = next.match(/^[A-Za-z0-9\-_]+/);
          if (urlContinuation) {
            result.push(line.trimEnd() + urlContinuation[0]);
            // Keep the remainder of the next line (e.g., email) as a separate line
            const remainder = next.slice(urlContinuation[0].length).trim();
            if (remainder) {
              result.push(remainder);
            }
            i++;
            continue;
          }
        }
      }
      result.push(line);
    }
    return result.join('\n');
  }

  private normalizeForPatternMatching(text: string): string {
    return text
      .replace(/([A-Za-z])\s+([a-z])/g, '$1$2')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private extractTextFromRawPdf(buffer: Buffer): string {
    const raw = buffer.toString('latin1');

    // Keep only printable segments to avoid binary noise from image/object streams.
    const printable = raw
      .replace(/[^\x20-\x7E\r\n]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return this.normalizeText(printable);
  }

  private cleanExtractedText(text: string): string {
    let cleaned = this.normalizeText(text.replace(/[^\x20-\x7E\r\n]+/g, ' '));
    // Fix single-char spacing from PDF extraction (e.g., "C S S" → "CSS", "H T M L" → "HTML")
    cleaned = cleaned.replace(
      /(?<![a-zA-Z])([A-Za-z] ){2,}[A-Za-z](?![a-zA-Z])/g,
      (match) => match.replace(/ /g, ''),
    );
    return cleaned;
  }

  private isUsableResumeText(text: string): boolean {
    if (!text || text.length < 80) {
      return false;
    }

    const alphaChars = (text.match(/[A-Za-z]/g) || []).length;
    const alphaRatio = alphaChars / text.length;

    if (alphaChars < 40 || alphaRatio < 0.25) {
      return false;
    }

    // Reject text dominated by PDF internal keywords
    const pdfKeywordHits = (
      text.match(
        /\b(obj|endobj|stream|endstream|xref|trailer|startxref|catalog|FlateDecode)\b/gi,
      ) || []
    ).length;
    if (pdfKeywordHits > 5) {
      return false;
    }

    const likelyResumeMarkers =
      /@|linkedin\.com|github\.com|education|experience|skills|objective/i;

    return likelyResumeMarkers.test(text);
  }

  private isLowConfidenceExtraction(data: ResumeResponseDto): boolean {
    const hasStrongSignal = Boolean(
      data.email || data.linkedin || data.github || data.phone,
    );

    if (hasStrongSignal) {
      return false;
    }

    const hasWeakSignal = data.skills.length >= 2 || data.education.length >= 1;

    return !hasWeakSignal;
  }

  private async ensureCompleteProfileResumeColumnsReady(): Promise<void> {
    await db.execute(
      sql.raw(`
        ALTER TABLE IF EXISTS main.zuvy_learners_complete_profile
        ADD COLUMN IF NOT EXISTS resume_url VARCHAR(1024);

        ALTER TABLE IF EXISTS main.zuvy_learners_complete_profile
        ADD COLUMN IF NOT EXISTS original_filename VARCHAR(255);

        ALTER TABLE IF EXISTS main.zuvy_learners_complete_profile
        ADD COLUMN IF NOT EXISTS projects JSONB DEFAULT '[]'::jsonb;
      `),
    );
  }

  async uploadResumeAndSave(
    file: Express.Multer.File,
    userId: number,
    extractedProjects: ExtractedProject[] = [],
  ): Promise<{ resumeUrl: string }> {
    await this.ensureCompleteProfileResumeColumnsReady();
    const resumeUrl = await this.uploadResumeToS3(file);
    await this.saveResumeUrl(
      userId,
      resumeUrl,
      file.originalname,
      extractedProjects,
    );
    return { resumeUrl };
  }

  private async uploadResumeToS3(file: Express.Multer.File): Promise<string> {
    try {
      const key = `learner_resumes/${Date.now()}_${file.originalname}`;
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );
      return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
    } catch (err) {
      throw new InternalServerErrorException('Error uploading resume to S3');
    }
  }

  private async saveResumeUrl(
    userId: number,
    resumeUrl: string,
    originalFilename: string,
    extractedProjects: ExtractedProject[],
  ): Promise<void> {
    const existing = await db
      .select()
      .from(zuvyLearnersCompleteProfile)
      .where(eq(zuvyLearnersCompleteProfile.userId, userId))
      .limit(1);

    if (existing.length > 0) {
      const updatePayload: any = {
        resumeUrl,
        originalFilename,
        updatedAt: new Date().toISOString(),
      };

      if (extractedProjects.length > 0) {
        updatePayload.projects = extractedProjects;
      }

      await db
        .update(zuvyLearnersCompleteProfile)
        .set(updatePayload)
        .where(eq(zuvyLearnersCompleteProfile.userId, userId));
    } else {
      await db.insert(zuvyLearnersCompleteProfile).values({
        userId,
        resumeUrl,
        originalFilename,
        projects: extractedProjects,
      });
    }
  }

  async getResumeByUserId(
    userId: number,
  ): Promise<{ resumeUrl: string; originalFilename: string }> {
    await this.ensureCompleteProfileResumeColumnsReady();
    const result = await db
      .select()
      .from(zuvyLearnersCompleteProfile)
      .where(eq(zuvyLearnersCompleteProfile.userId, userId))
      .limit(1);

    if (result.length === 0 || !result[0].resumeUrl) {
      throw new NotFoundException('No resume found for this learner');
    }

    return {
      resumeUrl: result[0].resumeUrl,
      originalFilename: result[0].originalFilename,
    };
  }

  async getParsedResumeFromS3(userId: number): Promise<{
    resumeUrl: string;
    originalFilename: string;
    data: ResumeResponseDto;
  }> {
    const { resumeUrl, originalFilename } =
      await this.getResumeByUserId(userId);

    const key = this.extractS3KeyFromUrl(resumeUrl);
    const response = await this.s3.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );

    const chunks: Buffer[] = [];
    for await (const chunk of response.Body as any) {
      chunks.push(Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);

    const mimetype = originalFilename?.toLowerCase().endsWith('.docx')
      ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      : 'application/pdf';

    const fakeFile = {
      buffer,
      mimetype,
      originalname: originalFilename || 'resume',
    } as Express.Multer.File;

    const parseResult = await this.parseResume(fakeFile);

    return {
      resumeUrl,
      originalFilename,
      ...parseResult,
    };
  }

  private extractS3KeyFromUrl(url: string): string {
    const bucketPrefix = `https://${this.bucket}.s3.${this.region}.amazonaws.com/`;
    if (url.startsWith(bucketPrefix)) {
      return decodeURIComponent(url.slice(bucketPrefix.length));
    }
    throw new BadRequestException('Invalid S3 resume URL');
  }
}
