import { Controller, Get, Post, Body, Patch, Param, Delete, HttpException, HttpStatus, Query, ParseIntPipe, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ResourcesService } from './resources.service';
import { CreateResourceDto } from './dto/create-resource.dto';
import { UpdateResourceDto } from './dto/update-resource.dto';

@ApiTags('Resources')
@Controller('resources')
export class ResourcesController {
  constructor(private readonly resourcesService: ResourcesService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a new resource',
    description: 'Adds a new resource to the system with the specified name and description'
  })
  @ApiBody({
    type: CreateResourceDto,
    description: 'Resource data to create'
  })
  @ApiResponse({
    status: 201,
    description: 'Resource created successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'number', example: 1 },
        name: { type: 'string', example: 'course' },
        description: { type: 'string', example: 'Manages course-related operations', nullable: true }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid input data or duplicate name'
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error'
  })
  @ApiBearerAuth('JWT-auth')
  async createResource(@Body() createResourceDto: CreateResourceDto) {
    try {
      const result = await this.resourcesService.createResource(createResourceDto);
      return result;
    } catch (error) {
      if (error.code === '23505') { // PostgreSQL unique constraint violation
        throw new HttpException('Resource with this name already exists', HttpStatus.BAD_REQUEST);
      }
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get()
  @ApiOperation({
    summary: 'Get all resources',
    description: 'Retrieves all resources from the system'
  })
  @ApiResponse({
    status: 200,
    description: 'Resources retrieved successfully'
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error'
  })
  @ApiBearerAuth('JWT-auth')
  async getAllResources(): Promise<any> {
    try {
      const result = await this.resourcesService.getAllResources();
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get resource by ID',
    description: 'Retrieves a specific resource by its ID'
  })
  @ApiParam({
    name: 'id',
    description: 'Resource ID',
    type: Number
  })
  @ApiResponse({
    status: 200,
    description: 'Resource retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'number', example: 1 },
        name: { type: 'string', example: 'course' },
        description: { type: 'string', example: 'Manages course-related operations', nullable: true }
      }
    }
  })
  @ApiResponse({
    status: 404,
    description: 'Resource not found'
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error'
  })
  @ApiBearerAuth('JWT-auth')
  async getResourceById(@Param('id', ParseIntPipe) id: number) {
    try {
      const result = await this.resourcesService.getResourceById(id);
      return result;
    } catch (error) {
      if (error.status === HttpStatus.NOT_FOUND) {
        throw error;
      }
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Put(':id')
  @ApiOperation({
    summary: 'Update a resource',
    description: 'Updates an existing resource with new data'
  })
  @ApiParam({
    name: 'id',
    description: 'Resource ID to update',
    type: Number
  })
  @ApiBody({
    type: CreateResourceDto,
    description: 'Updated resource data'
  })
  @ApiResponse({
    status: 200,
    description: 'Resource updated successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'number', example: 1 },
        name: { type: 'string', example: 'course' },
        description: { type: 'string', example: 'Manages course-related operations', nullable: true }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Invalid input data or duplicate name'
  })
  @ApiResponse({
    status: 404,
    description: 'Resource not found'
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error'
  })
  @ApiBearerAuth('JWT-auth')
  async updateResource(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateResourceDto: CreateResourceDto
  ) {
    try {
      const result = await this.resourcesService.updateResource(id, updateResourceDto);
      return result;
    } catch (error) {
      if (error.code === '23505') {
        throw new HttpException('Resource with this name already exists', HttpStatus.BAD_REQUEST);
      }
      if (error.status === HttpStatus.NOT_FOUND) {
        throw error;
      }
      throw new HttpException('Internal Server Error', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a resource',
    description: 'Deletes a specific resource by its ID'
  })
  @ApiResponse({
    status: 204,
    description: 'Resource deleted successfully'
  })
  @ApiResponse({
    status: 404,
    description: 'Resource not found'
  })
  @ApiResponse({
    status: 500,
    description: 'Internal server error'
  })
  @ApiBearerAuth('JWT-auth')
  async deleteResource(@Param('id', ParseIntPipe) id: number) {
    try {
      await this.resourcesService.deleteResource(id);
    } catch (error) {
      throw error;
    }
  }
}
