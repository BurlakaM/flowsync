import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { ProjectDetails } from '../types';
import { projectsKeys } from './projects-keys';

export const getProject = (id: number) =>
  apiClient.get<ProjectDetails>(`/projects/${id}`);

export const useProject = (id: number) =>
  useQuery({
    queryKey: projectsKeys.detail(id),
    queryFn: () => getProject(id),
    // A malformed id in the URL is answered on the page itself, without a request.
    enabled: Number.isInteger(id) && id > 0,
  });
