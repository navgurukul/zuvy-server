import { SetMetadata } from '@nestjs/common';

export const TRACK_ACTION_KEY = 'track_action';

export interface TrackActionMetadata {
  action?: string;
  resourceType?: string;
  displayType?: string;
  permissionName?: string;
  getResourceName?: (result: any, params?: any) => string;
  getBootcampId?: (result: any, params: any) => number | null;
  getTrackingContext?: (
    result: any,
    params?: any,
  ) => {
    chapterId?: number | null;
    moduleId?: number | null;
    bootcampId?: number | null;
    moduleName?: string | null;
  } | null;
  getTargetUser?: (result: any) => {
    status: string;
    name?: string;
    email?: string;
  } | null;
}

/**
 * Decorator to automatically track actions in tracking logs
 *
 * @example
 * @TrackAction({
 *   getResourceName: (result) => result.bootcamp.name,
 * })
 * async createBootcamp(bootcampData) { ... }
 */
export const TrackAction = (metadata?: TrackActionMetadata) =>
  SetMetadata(TRACK_ACTION_KEY, metadata || {});
