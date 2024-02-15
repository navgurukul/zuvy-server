import { Controller, Get, Post, Put,Patch,  Delete, Body, Param, ValidationPipe, UsePipes, Optional, Query, BadRequestException} from '@nestjs/common';
import { ContentService } from './content.service';
import { ApiTags, ApiBody, ApiOperation, ApiCookieAuth, ApiQuery} from '@nestjs/swagger';


@Controller('Content')
@ApiTags('Content')
@ApiCookieAuth()
@UsePipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
}))
// @UseGuards(AuthGuard('cookie'))
export class ContentController {
    constructor(private contentService:ContentService) { }

    @Get('/modules/:bootcamp_id/:user_id')
    @ApiOperation({ summary: "Get the modules by user_id, bootcamp_id"})
    async getModules(@Param('bootcamp_id') bootcamp_id: number, @Param('user_id') user_id : number): Promise<object> {
        const [err, res] = await this.contentService.getModules(bootcamp_id, user_id);
        if(err){
            throw new BadRequestException(err);
        } 
        return res;
    }

    @Get('/chapter/:module_id')
    @ApiOperation({ summary: "Get the chapter by module_id"})
    async getChapter(@Param('module_id') module_id: number): Promise<object> {
        const [err, res] = await this.contentService.getChapter(module_id);
        if(err){
            throw new BadRequestException(err);
        } 
        return res;
    }
}

