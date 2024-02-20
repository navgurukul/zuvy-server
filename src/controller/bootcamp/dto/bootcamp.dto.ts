import { ApiProperty, ApiResponseProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, ValidateNested, IsNumber, IsEmail } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateBootcampDto {
  @ApiProperty({
    type: String,
    example: 'bootcamp name',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  name: string;
}


export class EditBootcampDto{
  @ApiProperty({
    type: String,
    example: 'The bootcamp cover image',
    required: true,
  })
  @IsNotEmpty()
  coverImage: string;

  @ApiProperty({
    type: String,
    example: 'The bootcamp name',
    required: true,
  })
  @IsNotEmpty({message: 'name is required'})
  @IsString()
  name: string;

  @ApiProperty({
    type: String,
    example: 'The bootcamp topic',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  bootcampTopic: string;

  @ApiProperty({
    type: String,
    example: '3 months',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  duration: string;

  @ApiProperty({
    type: String, 
    example: '2023-03-01T00:00:00Z',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  startTime: string;

  @ApiProperty({
    type: String,
    example: 'The bootcamp language',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  language: string;

}

export class PatchBootcampDto{
  @ApiProperty({
    type: String,
    example: 'https://example.com/image.jpg',
  })
  @IsOptional()
  coverImage: string;

  @ApiProperty({
    type: String,
    example: 'The bootcamp name',
  })
  @IsString()
  @IsOptional()
  name: string;

  @ApiProperty({
    type: String,
    example: 'The bootcamp topic',
  })
  @IsOptional()
  @IsString()
  bootcampTopic: string;

  @ApiProperty({
    type: String,
    example: '3 months',
    required: true,
  })
  @IsString()
  @IsOptional()
  duration: string;

  @ApiProperty({
    type: String, 
    example: '2023-03-01T00:00:00Z',
    required: true,
  })
  @IsString()
  @IsOptional()
  startTime: string;

  @ApiProperty({
    type: String,
    example: 'english',
  })
  @IsOptional()
  @IsString()
  language: string;
}
class studentEmail {
  @ApiProperty({
    type: String,
    example: 'example@gmail.com',
    required: true,
  })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({
    type: String,
    example: 'example',
    required: true,
  })
  @IsNotEmpty()
  @IsString()
  name: string;
}
export class studentDataDto {
  @ApiProperty({
    type: [studentEmail],
    required: true,
  })
  @IsNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => studentEmail)
  students: studentEmail[];
}