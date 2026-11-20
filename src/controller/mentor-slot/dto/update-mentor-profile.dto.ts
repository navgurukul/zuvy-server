import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString } from 'class-validator';

// Every field is optional: the service applies only the fields that are
// present (a PATCH can send a subset). Each one needs a class-validator
// decorator because the mentor controllers run ValidationPipe with
// `whitelist: true`, which strips any property that has none.
export class UpdateMentorProfileDto {
  @ApiProperty({
    example:
      'Frontend Engineer obsessed with pixel-perfect interfaces and accessible design. Building fast, delightful web experiences that users actually enjoy navigating.',
  })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiProperty({
    type: [String],
    example: [
      'Kotlin',
      'Jetpack Compose',
      'Firebase',
      'Offline-First Architecture',
    ],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  expertise?: string[];

  @ApiProperty({
    type: [String],
    required: false,
    example: ['react', 'node-js', 'system-design'],
    description:
      'Skills from the fixed list (GET /mentors/skills), by slug or name. Unknown ones are refused. Sets expertise to their names. Use this instead of expertise.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @ApiProperty({
    example:
      'At Paytm, I established the SRE practice for the payments infrastructure team, introducing SLOs that reduced customer-impacting incidents by 70% in one year. Built a centralized alerting system that consolidated 800+ noisy alerts into 40 actionable ones.',
    description: 'Detailed past experience of the mentor (plain text)',
  })
  @IsOptional()
  @IsString()
  pastExperiences?: string;

  @ApiProperty({
    example: 'Full Stack Developer',
  })
  @IsOptional()
  @IsString()
  title?: string;
}
