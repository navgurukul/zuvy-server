import { Injectable, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { google } from 'googleapis';
import { DriveDto } from './dto/drive.dto';
import { DriveLinks } from '../../../drizzle/schema';
import { db } from '../../db/index';
import { eq, sql } from 'drizzle-orm';
import { S3 } from 'aws-sdk';

@Injectable()
export class ListFilesService implements OnModuleInit {
  private readonly drive: any;
  private readonly driveFolderId = process.env.DRIVE_FOLDER_ID
  private readonly apiKey = process.env.DRIVE_API_KEY;
  private readonly s3 = new S3(); 

  DriveLinks: any;
  fileRepository: any;

  constructor() {
    this.drive = google.drive({ version: 'v3', auth: this.apiKey });
  }

  async onModuleInit() {
    await this.listFiles();
  }

  @Cron("0 */30 * * * *")
  async listFiles() {
    try {
      const files = await this.getFilesInFolder(this.driveFolderId);
      console.log('Files in Google Drive folder:', files);
      await this.updateDatabase(files);
    } catch (error) {
      console.log('Error listing files:', error);
    }
  }
  
  private async getFilesInFolder(folderId: string) {
    const response = await this.drive.files.list({
      q: `'${folderId}' in parents`,
      fields: 'files(id, name)',
    });

    return response.data.files;
  }

  private async updateDatabase(driveFiles: any[]) {
    try {
      for (const driveFile of driveFiles) {
        const fileExistsInDatabase = await db
          .select()
          .from(DriveLinks)
          .where(sql`${DriveLinks.fileid} = ${driveFile.id}`);
          
        if (fileExistsInDatabase.length == 0) {
          const s3UploadResponse = await this.uploadToS3(driveFile.name, driveFile.id);
          const createdLinks = await db.insert(DriveLinks).values({
            name: driveFile.name,
            fileid: driveFile.id,
            s3Link: s3UploadResponse.Location,
          });
          console.log(`File added to database: ${driveFile.name}`);
        }
      }
    } catch (error) {
      console.log('Error updating database with files:', error);
    }
  }
  
  private async uploadToS3(fileName: string, fileId: string) {
        const uploadParams = {
      Bucket: '',
            Key: "",
            Body: '',
      ContentType: 'application/octet-stream',
    };

    return this.s3.upload(uploadParams).promise();
}
}
