-- Synthetic data for the load test: ~60 000 tasks, ~180 000 comments, ~100 000 activity rows.
-- Run on an empty, freshly migrated database (ops/load/run.sh does it). `:pwhash` is the bcrypt hash of the
-- password every test user shares. The user with id 1 owns projects 1..25 and is a member of 26..40, so
-- it can see every project: any task id between 1 and 60 000 is readable by it.
\set ON_ERROR_STOP on

INSERT INTO users (name, email, password, role, email_verified_at, updated_at)
SELECT 'Perf User ' || g, 'perf' || g || '@example.test', :'pwhash', 'USER', now(), now()
FROM generate_series(1, 50) g;

INSERT INTO projects (name, description, owner_id, updated_at)
SELECT 'Project ' || g, 'Synthetic project ' || g,
       CASE WHEN g <= 25 THEN 1 ELSE 2 + (g % 15) END, now()
FROM generate_series(1, 40) g;

-- The load user is a member of the projects it does not own; users 2..20 are members of everything.
INSERT INTO project_members (project_id, user_id)
SELECT p.id, 1 FROM projects p WHERE p.owner_id <> 1;
INSERT INTO project_members (project_id, user_id)
SELECT p.id, u.id FROM projects p JOIN users u ON u.id BETWEEN 2 AND 20 AND u.id <> p.owner_id
ON CONFLICT DO NOTHING;

INSERT INTO tags (name, project_id)
SELECT (ARRAY['bug','feature','chore','docs','urgent','backend','frontend','design','infra','test','ux','api','perf','security','release'])[k], p.id
FROM projects p, generate_series(1, 15) k;

-- A word that searches will look for. A volatile function is evaluated again for every row
-- (a subquery with random() in it would be evaluated once, or return several rows).
CREATE FUNCTION pg_temp.pick_word() RETURNS text LANGUAGE sql VOLATILE AS $$
  SELECT (ARRAY['deploy','login','invoice','report','dashboard','migration','email','search','upload','payment',
    'export','import','profile','settings','notification','billing','onboarding','analytics','cache','queue'])[1 + floor(random() * 20)::int]
$$;

INSERT INTO tasks (name, description, status, project_id, created_by_id, created_at, updated_at)
SELECT pg_temp.pick_word() || ' ' ||
       pg_temp.pick_word() || ' #' || g,
       'Task about ' || pg_temp.pick_word() || ' and ' ||
       pg_temp.pick_word() || ': ' || md5(random()::text),
       (ARRAY['TODO','IN_PROGRESS','DONE'])[1 + floor(random() * 3)::int]::task_status,
       p.id, 1 + floor(random() * 19)::int,
       now() - random() * interval '365 days', now() - random() * interval '30 days'
FROM projects p, generate_series(1, 1500) g;

INSERT INTO task_assignees (task_id, user_id)
SELECT id, 2 + floor(random() * 18)::int FROM tasks;
INSERT INTO task_assignees (task_id, user_id)
SELECT id, 2 + floor(random() * 18)::int FROM tasks WHERE random() < 0.5
ON CONFLICT DO NOTHING;

-- Two tags per task, from the tags of its own project (implicit many-to-many table: A = tag, B = task).
INSERT INTO "_TaskTags" ("A", "B")
SELECT (SELECT t.id FROM tags t WHERE t.project_id = k.project_id ORDER BY t.id OFFSET floor(random() * 15)::int + 0 * k.id LIMIT 1), k.id
FROM tasks k, generate_series(1, 2)
ON CONFLICT DO NOTHING;

INSERT INTO comments (text, task_id, author_id, created_at, updated_at)
SELECT 'Comment ' || md5(random()::text) || ' about ' || pg_temp.pick_word(),
       t.id, 1 + floor(random() * 19)::int, now() - random() * interval '300 days', now()
FROM tasks t, generate_series(1, 3);

INSERT INTO audit_logs (project_id, actor_id, type, entity_type, entity_id, data, created_at)
SELECT 1 + floor(random() * 40)::int, 1 + floor(random() * 19)::int,
       (ARRAY['task.created','task.updated','comment.created'])[1 + floor(random() * 3)::int],
       'Task', 1 + floor(random() * 60000)::int, jsonb_build_object('name', 'Task ' || g),
       now() - random() * interval '200 days'
FROM generate_series(1, 100000) g;

ANALYZE;
SELECT 'users' AS "table", count(*) FROM users UNION ALL SELECT 'projects', count(*) FROM projects
UNION ALL SELECT 'tasks', count(*) FROM tasks UNION ALL SELECT 'comments', count(*) FROM comments
UNION ALL SELECT 'audit_logs', count(*) FROM audit_logs;
