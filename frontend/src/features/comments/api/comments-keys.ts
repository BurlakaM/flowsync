export const commentsKeys = {
  all: ['comments'] as const,
  list: (taskId: number, page: number) =>
    [...commentsKeys.all, 'list', taskId, page] as const,
};
