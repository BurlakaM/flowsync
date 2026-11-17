-- DropIndex
DROP INDEX "audit_logs_project_id_created_at_idx";

-- DropIndex
DROP INDEX "comments_task_id_idx";

-- CreateIndex
CREATE INDEX "audit_logs_project_id_id_idx" ON "audit_logs"("project_id", "id" DESC);

-- CreateIndex
CREATE INDEX "comments_task_id_id_idx" ON "comments"("task_id", "id");

