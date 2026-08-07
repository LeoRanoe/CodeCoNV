"use client";

/**
 * One name per cached read, used by the screen that asks for it and by the offline sync
 * that fills it in advance. They have to agree exactly, otherwise the sync stores an answer
 * nobody looks for.
 */
export const offlineQueryKeys = {
  projectConfiguration: (projectId: string) => `project-configuration:${projectId}`,
  projectLocations: (projectId: string) => `project-locations:${projectId}`,
  projectDrawings: (projectId: string) => `project-drawings:${projectId}`,
  projectNotifications: (projectId: string) => `project-notifications:${projectId}`,
  projectRecentPhotos: (projectId: string) => `project-recent-photos:${projectId}`,
  internalAccess: (organizationId: string) => `internal-access:${organizationId}`,
};
