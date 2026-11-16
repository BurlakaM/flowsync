-- Full-text search for tasks and comments (GIN indexes over expression indexes: Prisma cannot model
-- them, so they live only in SQL). The 'simple' configuration is used on purpose: it does no stemming,
-- which suits a mix of Ukrainian and English text. The expressions must stay identical to the ones in
-- TasksSearchService, otherwise PostgreSQL will not use the indexes.
CREATE INDEX "tasks_fts_idx" ON "tasks" USING GIN (
  (
    setweight(to_tsvector('simple', "name"), 'A') ||
    setweight(to_tsvector('simple', coalesce("description", '')), 'B')
  )
);

CREATE INDEX "comments_fts_idx" ON "comments" USING GIN (to_tsvector('simple', "text"));
