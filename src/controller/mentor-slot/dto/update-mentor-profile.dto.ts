import { ApiProperty } from '@nestjs/swagger';

export class UpdateMentorProfileDto {
  @ApiProperty()
  bio: string;

  @ApiProperty({ type: [String] })
  expertise: string[];

  @ApiProperty({ type: 'array' })
  pastExperiences: any[];

  @ApiProperty()
  title: string;
}
