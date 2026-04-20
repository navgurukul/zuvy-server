import { ApiProperty } from '@nestjs/swagger';

export class UpdateMentorProfileDto {
  @ApiProperty()
  bio: string;

  @ApiProperty({ type: [String] })
  expertise: string[];

  @ApiProperty({
    type: [Object],
    example: [
      {
        company: 'Google',
        role: 'Software Engineer',
        duration: '2 years',
      },
    ],
  })
  pastExperiences: any[];

  @ApiProperty()
  title: string;

  @ApiProperty()
  bootcampId: number;
}
