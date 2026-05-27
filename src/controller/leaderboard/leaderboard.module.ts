import { Module } from '@nestjs/common';
import { LeaderboardController } from './leaderboard.controller';
import { LeaderboardService } from './leaderboard.service';

/**
 * Leaderboard Module
 *
 * Encapsulates leaderboard functionality including:
 * - Assessment point calculation
 * - Bootcamp-based leaderboard management
 * - Learner ranking and position tracking
 */
@Module({
  controllers: [LeaderboardController],
  providers: [LeaderboardService],
  exports: [LeaderboardService], // Export service for use in other modules
})
export class LeaderboardModule {}
