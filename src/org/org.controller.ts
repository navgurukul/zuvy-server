import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { OrgService } from './org.service';
import { CreateOrgDto } from './dto/create-org.dto';
import { UpdateOrgDto } from './dto/update-org.dto';
import { OrgQueryDto } from './dto/org-query.dto';
import {
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('org')
@Controller('org')
export class OrgController {
  constructor(private readonly orgService: OrgService) {}

  @Post('/create')
  @ApiOperation({ summary: 'Create a new organization' })
  @ApiBody({ type: CreateOrgDto, description: 'Create a new organization' })
  @ApiResponse({
    status: 201,
    description: 'The organization has been successfully created.',
  })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Not Found.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  @ApiBearerAuth('JWT-auth')
  async create(@Body() createOrgDto: CreateOrgDto) {
    return await this.orgService.create(createOrgDto);
  }

  @Get('/getAllOrgs')
  @ApiOperation({ summary: 'Get all organizations with pagination and search' })
  @ApiResponse({
    status: 200,
    description: 'All organizations have been successfully retrieved.',
  })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiBearerAuth('JWT-auth')
  findAll(@Query() query: OrgQueryDto) {
    return this.orgService.findAll(query);
  }

  @Get('/getOrgById/:id')
  @ApiOperation({ summary: 'Get an organization by ID' })
  @ApiResponse({
    status: 200,
    description: 'The organization has been successfully retrieved.',
  })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Not Found.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  @ApiBearerAuth('JWT-auth')
  findOne(@Param('id') id: string) {
    return this.orgService.findOne(+id);
  }

  @Patch('/updateOrgById/:id')
  @ApiOperation({ summary: 'Update an organization by ID' })
  @ApiBody({ type: UpdateOrgDto, description: 'Update an organization by ID' })
  @ApiResponse({
    status: 200,
    description: 'The organization has been successfully updated.',
  })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Not Found.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  @ApiBearerAuth('JWT-auth')
  update(@Param('id') id: string, @Body() updateOrgDto: UpdateOrgDto) {
    return this.orgService.update(+id, updateOrgDto);
  }

  @Delete('/deleteOrgById/:id')
  @ApiOperation({
    summary: 'Request deletion of an organization by ID (Triggers Email)',
  })
  @ApiResponse({
    status: 200,
    description: 'Deletion confirmation email sent.',
  })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  @ApiResponse({ status: 404, description: 'Not Found.' })
  @ApiResponse({ status: 500, description: 'Internal Server Error.' })
  @ApiBearerAuth('JWT-auth')
  remove(@Param('id') id: string) {
    return this.orgService.initiateDelete(+id);
  }

  @Post('/delete/confirm')
  @ApiOperation({ summary: 'Confirm deletion using token' })
  @ApiBody({
    schema: { type: 'object', properties: { token: { type: 'string' } } },
  })
  @ApiResponse({
    status: 200,
    description: 'Organization deleted successfully.',
  })
  @ApiResponse({ status: 400, description: 'Invalid token.' })
  async confirmDelete(@Body('token') token: string) {
    return await this.orgService.confirmDelete(token);
  }

  @Patch('/complete-setup/:id')
  @ApiOperation({
    summary: 'Complete organization setup (POC only, verifies org)',
  })
  @ApiBody({ type: UpdateOrgDto })
  @ApiResponse({ status: 200, description: 'Organization setup completed.' })
  @ApiResponse({
    status: 400,
    description: 'Already verified or invalid data.',
  })
  async completeSetup(
    @Param('id') id: string,
    @Body() updateOrgDto: UpdateOrgDto,
  ) {
    return await this.orgService.completeSetup(+id, updateOrgDto);
  }
}
