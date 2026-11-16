import { useState, type FormEvent } from 'react';
import { Spinner } from '@/components/spinner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getErrorMessage } from '@/lib/api-client';
import { useAddMember, useRemoveMember } from '../api/project-mutations';
import type { ProjectDetails } from '../types';

interface ProjectMembersProps {
  project: ProjectDetails;
}

/** The people of a project. Only the owner can add or remove members (the API enforces it too). */
export function ProjectMembers({ project }: ProjectMembersProps) {
  const isOwner = project.myRole === 'OWNER';
  const add = useAddMember(project.id);
  const remove = useRemoveMember(project.id);
  const [email, setEmail] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    add.mutate(trimmed, { onSuccess: () => setEmail('') });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Members</CardTitle>
        <CardDescription>
          Members can create and edit tasks, comments and tags.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="divide-y">
          {project.members.map((member) => (
            <li
              key={member.userId}
              className="flex items-center justify-between gap-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{member.name}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {member.email}
                </p>
              </div>
              {member.role === 'OWNER' ? (
                <Badge>Owner</Badge>
              ) : (
                isOwner && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={remove.isPending}
                    aria-label={`Remove ${member.name}`}
                    onClick={() => remove.mutate(member.userId)}
                  >
                    Remove
                  </Button>
                )
              )}
            </li>
          ))}
        </ul>

        {remove.isError && (
          <p role="alert" className="text-sm text-destructive">
            {getErrorMessage(remove.error)}
          </p>
        )}

        {isOwner && (
          <form onSubmit={submit} className="space-y-2">
            <Label htmlFor="member-email">Add a member by email</Label>
            <div className="flex gap-2">
              <Input
                id="member-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="off"
              />
              <Button type="submit" disabled={add.isPending || !email.trim()}>
                {add.isPending && <Spinner className="text-current" />}
                Add
              </Button>
            </div>
            {add.isError && (
              <p role="alert" className="text-sm text-destructive">
                {getErrorMessage(add.error)}
              </p>
            )}
          </form>
        )}
      </CardContent>
    </Card>
  );
}
