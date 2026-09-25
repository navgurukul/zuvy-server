import {
  IsArray,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class SearchVectorsDto {
  @IsString()
  collectionName: string;

  @IsArray()
  @IsNumber({}, { each: true })
  queryVector: number[];

  @IsOptional()
  @Min(1)
  limit?: number;

  @IsOptional()
  @IsObject()
  filter?: Record<string, string | number | boolean | null>;
}
