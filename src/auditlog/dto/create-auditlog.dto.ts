import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import { IsNumber, IsOptional } from "class-validator";

export class CreateAuditlogDto {
    // Define properties for the audit log creation DTO
    @ApiProperty({
        description: 'Admin (actor) user ID performing the assignment',
        example: 1
    })
    @Transform(({ value }) => BigInt(value))
    @IsNumber()
    actorUserId: number;

    @ApiProperty({
        description: 'Target user ID receiving the extra permission',
        required: false,
        example: 123
    })
    @Transform(({ value }) => value !== undefined ? BigInt(value) : undefined)
    @IsOptional()
    @IsNumber()
    targetUserId?: number;

    //add action property
    @ApiProperty({
        description: 'Action performed by the actor',
        example: 'created a new resource'
    })
    action: string;

    // add roleId property
    @ApiProperty({
        description: 'Role ID being assigned to the user',
        required: false,
        example: 2
    })
    @IsOptional()
    @IsNumber()
    roleId?: number;

   // add permissionId property it will take single or multiple permission ids
   @ApiProperty({
        description: 'Permission ID being assigned to the user',
        required: false,
        example: 42
    })
    @IsOptional()
    @IsNumber({}, { each: true })
    permissionIds?: number[];

    @ApiProperty({
        description: 'Optional scope ID if scoping is used',
        required: false,
        example: 3
    })
    @IsOptional()
    @IsNumber()
    scopeId?: number;

}

export class AuditResponseDto {
    // Define properties for the audit log response DTO
    @ApiProperty({ description: 'Audit log ID', example: 1 })
    id: number;

    @ApiProperty({ description: 'Actor user ID', example: 1 })
    actorUserId: number;

    @ApiProperty({ description: 'Target user ID', example: 123 })
    targetUserId: number;

    @ApiProperty({ description: 'Action performed', example: 'created a new resource' })
    action: string;

    @ApiProperty({ description: 'Role ID assigned', example: 2 })
    roleId: number;

    @ApiProperty({ description: 'Permission IDs assigned', example: [42, 43] })
    permissionIds: number[];

    @ApiProperty({ description: 'Scope ID if applicable', example: 3, required: false })
    scopeId?: number;

    @ApiProperty({ description: 'Timestamp of the audit log entry', example: '2023-10-05T14:48:00.000Z' })
    createAt: string;  
 }