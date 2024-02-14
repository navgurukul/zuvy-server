import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty,IsOptional,IsNumber } from 'class-validator';


export class CreateAssignmentDto {
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
    assignmentId: number;

    @ApiProperty({
        type: Number,
        example: 44002,
        required: true,
    })
    @IsNotEmpty()
    @IsNumber()
    moduleId: number;

    @ApiProperty({
        type: String,
        example: 'https:://github.com/',
        required: true,
    })
    @IsOptional()
    @IsString()
    projectUrl: string;
}

export class PatchAssignmentDto {
    @ApiProperty({
        type: String,
        example: 'https:://github.com/',
        required: true,
    })
    @IsOptional()
    @IsString()
    projectUrl: string;
}
