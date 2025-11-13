import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { userTokens } from 'drizzle/schema';
import { db } from 'src/db';

type UpsertParams = {
  userId: number;
  userEmail: string;
  accessToken: string;
  refreshToken: string;
};
type DeleteFilter = { userId?: number; userEmail?: string };

@Injectable()
export class UserTokensService {
  private readonly logger = new Logger(UserTokensService.name);
  async upsertToken(params: UpsertParams) {
    const { userId, userEmail, accessToken, refreshToken } = params;
    try {
      const [row] = await db
        .insert(userTokens)
        .values({ userId, userEmail, accessToken, refreshToken })
        .onConflictDoUpdate({
          target: userTokens.userId,
          set: { userEmail, accessToken, refreshToken },
        })
        .returning();

      return { success: true, message: 'UPSERT_OK', data: row };
    } catch (err) {
      this.logger.error('Failed to upsert user tokens:', err);
      throw new InternalServerErrorException({
        success: false,
        message: 'UPSERT_FAILED',
        error: String(err?.message ?? err),
      });
    }
  }

  async getUserTokens(userId: bigint) {
    try {
      const [tokens] = await db
        .select({
          accessToken: userTokens.accessToken,
          refreshToken: userTokens.refreshToken,
        })
        .from(userTokens)
        .where(eq(userTokens.userId, Number(userId)));

      if (!tokens) {
        return { success: false, message: 'No tokens found for this user' };
      }

      return {
        success: true,
        message: 'Tokens retrieved successfully',
        data: tokens,
      };
    } catch (error) {
      this.logger.error('Failed to fetch user tokens:', error);
      throw new Error('Failed to fetch user tokens');
    }
  }

  async deleteToken(filter: DeleteFilter) {
    if (!filter.userId && !filter.userEmail)
      throw new BadRequestException({
        success: false,
        message: 'BAD_REQUEST: provide userId or userEmail',
      });

    const where = filter.userId
      ? eq(userTokens.userId, filter.userId)
      : eq(userTokens.userEmail, filter.userEmail!);

    try {
      const deleted = await db.delete(userTokens).where(where).returning();
      const found = deleted.length > 0;
      return {
        success: found,
        message: found ? 'DELETE_OK' : 'NOT_FOUND',
        data: deleted,
      };
    } catch (err) {
      this.logger.error('Failed to delete user tokens:', err);
      throw new InternalServerErrorException({
        success: false,
        message: 'DELETE_FAILED',
        error: String(err?.message ?? err),
      });
    }
  }
}
