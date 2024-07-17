import { ApiProperty, ApiResponseProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty,IsDate, IsArray,IsObject, ValidateNested,IsOptional, IsEmail, IsNumber,IsDateString } from 'class-validator';
import { Type } from 'class-transformer';


export class UpdateProjectDto {
    @ApiProperty({
        type: String,
        example: 'hhtps://github.com',
        required: true,
    })
    @IsNotEmpty()
    @IsString()
    projectLink: string;
}
