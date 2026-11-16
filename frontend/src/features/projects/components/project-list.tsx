import { Link } from 'react-router';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { Project } from '../types';

interface ProjectListProps {
  projects: Project[];
}

export function ProjectList({ projects }: ProjectListProps) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {projects.map((project) => (
        <li key={project.id}>
          <Card className="relative h-full transition-colors hover:bg-muted/40">
            <CardHeader>
              <CardTitle className="flex items-start justify-between gap-2">
                {/* The stretched link makes the whole card clickable with one real link. */}
                <Link
                  to={`/projects/${project.id}`}
                  className="after:absolute after:inset-0 hover:underline"
                >
                  {project.name}
                </Link>
                {project.myRole === 'OWNER' && <Badge>Owner</Badge>}
              </CardTitle>
              <CardDescription className="line-clamp-2">
                {project.description || 'No description'}
              </CardDescription>
              <p className="pt-2 text-sm text-muted-foreground">
                {project.tasksCount}{' '}
                {project.tasksCount === 1 ? 'task' : 'tasks'}
              </p>
            </CardHeader>
          </Card>
        </li>
      ))}
    </ul>
  );
}
