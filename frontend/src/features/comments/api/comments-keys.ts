export const commentsKeys = {
  all: ['comments'] as const,
  list: (taskId: number) => [...commentsKeys.all, 'list', taskId] as const,
};
