import { ApiProperty, ApiResponseProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty,IsDate, IsArray,IsObject, ValidateNested,IsOptional, IsEmail, IsNumber,IsDateString } from 'class-validator';
import { Type } from 'class-transformer';


export class CreateArticleDto {
    @ApiProperty({
        type: Number,
        example: 44002,
        required: true,
    })
    @IsNotEmpty()
    @IsNumber()
    userId: number;

    @ApiProperty({
        type: Number,
        example: 44002,
        required: true,
    })
    @IsNotEmpty()
    @IsNumber()
    articleId: number;

    @ApiProperty({
        type: Number,
        example: 44002,
        required: true,
    })
    @IsNotEmpty()
    @IsNumber()
    moduleId: number;
}

export class PatchArticleDto {
    @ApiProperty({
        type: Number,
        example: 44002,
        required: true,
    })
    @IsOptional()
    @IsNumber()
    chossen_option: number;

    @ApiProperty({
        type: String,
        example: 'fail',
        required: true,
    })
    @IsOptional()
    @IsString()
    status: string;
}
