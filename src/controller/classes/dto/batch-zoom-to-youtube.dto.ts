import { IsArray, IsString } from 'class-validator';

export class BatchZoomToYoutubeDto {
  @IsArray()
  meetingIds: string[];

  @IsString()
  title: string;

  @IsString()
  description: string;
}
