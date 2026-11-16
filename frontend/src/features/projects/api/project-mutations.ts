import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Member, Project, ProjectInput } from '../types';
import { projectsKeys } from './projects-keys';

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ProjectInput) =>
      apiClient.post<Project>('/projects', input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: projectsKeys.all }),
  });
}

export function useUpdateProject(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ProjectInput) =>
      apiClient.patch<Project>(`/projects/${id}`, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: projectsKeys.all }),
  });
}

export function useDeleteProject(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.delete(`/projects/${id}`),
    onSuccess: () => {
      // The project is gone: drop its detail instead of refetching a 404.
      queryClient.removeQueries({ queryKey: projectsKeys.detail(id) });
      return queryClient.invalidateQueries({ queryKey: projectsKeys.lists() });
    },
  });
}

export function useAddMember(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (email: string) =>
      apiClient.post<Member>(`/projects/${projectId}/members`, { email }),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: projectsKeys.detail(projectId),
      }),
  });
}

export function useRemoveMember(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: number) =>
      apiClient.delete(`/projects/${projectId}/members/${userId}`),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: projectsKeys.detail(projectId),
      }),
  });
}
