import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Project } from '../types';
import { projectsKeys } from './projects-keys';

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

/**
 * The picture of a project. It is private, so it cannot be an ordinary <img src>: the request needs the
 * access token, and the bytes are shown as a data address (at most 2 MB). The time of
 * the last change of the project is part of the key, so a new picture is fetched at once.
 */
export const useProjectImage = (
  project: Pick<Project, 'id' | 'hasImage' | 'updatedAt'>,
) =>
  useQuery({
    queryKey: [...projectsKeys.all, 'image', project.id, project.updatedAt],
    queryFn: async () =>
      blobToDataUrl(
        await apiClient.get<Blob>(`/projects/${project.id}/image`, {
          responseType: 'blob',
        }),
      ),
    enabled: project.hasImage,
    staleTime: Infinity,
  });

export function useUploadProjectImage(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const body = new FormData();
      body.append('file', file);
      return apiClient.put<Project>(`/projects/${projectId}/image`, body);
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: projectsKeys.all }),
  });
}

export function useRemoveProjectImage(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.delete(`/projects/${projectId}/image`),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: projectsKeys.all }),
  });
}
