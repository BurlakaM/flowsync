import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Page } from '@/types/api';
import type { Project, ProjectListParams } from '../types';
import { projectsKeys } from './projects-keys';

export const getProjects = (params: ProjectListParams) =>
  apiClient.get<Page<Project>>('/projects', { params });

export const useProjects = (params: ProjectListParams) =>
  useQuery({
    queryKey: projectsKeys.list(params),
    queryFn: () => getProjects(params),
    // Keep the current page on screen while the next one loads.
    placeholderData: keepPreviousData,
  });
