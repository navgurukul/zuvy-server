import { SetMetadata } from '@nestjs/common';

export const TRACK_ACTION_KEY = 'track_action';

export interface TrackActionMetadata {
  action?: string; // Optional - will be auto-generated from HTTP method and route
  resourceType?: string; // Optional - will be auto-generated from route path
  permissionName?: string; // Optional - will be auto-generated from action and resource
  getResourceName?: (result: any) => string; // Function to extract resource name from result
  getBootcampId?: (result: any, params: any) => number | null; // Function to extract bootcamp ID from result or params
  getTargetUser?: (result: any) => {
    status: string;
    name?: string;
    email?: string;
  } | null; // Function to extract target user info
  getCustomDescription?: (
    actorName: string,
    result: any,
    params: any,
    body?: any,
  ) => string | null; // Custom description with bootcamp/module details and request body
}

/**
 * Decorator to automatically track actions in tracking logs
 * Now fully dynamic - extracts action, resourceType, and permissionName from route and HTTP method
 *
 * @example
 * @TrackAction({
 *   getResourceName: (result) => result.bootcamp.name,
 * })
 * async createBootcamp(bootcampData) { ... }
 */
export const TrackAction = (metadata?: TrackActionMetadata) =>
  SetMetadata(TRACK_ACTION_KEY, metadata || {});
