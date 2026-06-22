import { ApiProperty } from '@nestjs/swagger';

export class UpdateMentorProfileDto {
  @ApiProperty({
    example:
      'Frontend Engineer obsessed with pixel-perfect interfaces and accessible design. Building fast, delightful web experiences that users actually enjoy navigating.',
  })
  bio: string;

  @ApiProperty({
    type: [String],
    example: [
      'Kotlin',
      'Jetpack Compose',
      'Firebase',
      'Offline-First Architecture',
    ],
  })
  expertise: string[];

  @ApiProperty({
    example:
      'At Paytm, I established the SRE practice for the payments infrastructure team, introducing SLOs that reduced customer-impacting incidents by 70% in one year. Built a centralized alerting system that consolidated 800+ noisy alerts into 40 actionable ones.',
    description: 'Detailed past experience of the mentor (plain text)',
  })
  pastExperiences: string;

  @ApiProperty({
    example: 'Full Stack Developer',
  })
  title: string;
}
