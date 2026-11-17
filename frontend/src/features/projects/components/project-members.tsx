import { UserMinus, UserPlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useState, type FormEvent } from 'react';
import { Spinner } from '@/components/spinner';
import { Avatar } from '@/components/ui/avatar';
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
  const { t } = useTranslation();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    add.mutate(trimmed, { onSuccess: () => setEmail('') });
  };

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <h2>{t('Members')}</h2>
          <span className="rounded-md bg-muted px-1.5 text-xs leading-5 font-medium text-muted-foreground tabular-nums">
            {project.members.length}
          </span>
        </CardTitle>
        <CardDescription>
          {t('Members can create and edit tasks, comments and tags.')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-1">
          {project.members.map((member) => (
            <li
              key={member.userId}
              className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-accent/40"
            >
              <Avatar name={member.name} seed={member.userId} decorative />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{member.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {member.email}
                </p>
              </div>
              {member.role === 'OWNER' ? (
                <Badge>{t('Owner')}</Badge>
              ) : (
                isOwner && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={remove.isPending}
                    aria-label={t('Remove {{name}}', { name: member.name })}
                    title={t('Remove')}
                    onClick={() => remove.mutate(member.userId)}
                  >
                    <UserMinus />
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
            <Label htmlFor="member-email" className="sr-only">
              {t('Add a member by email')}
            </Label>
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <UserPlus
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  id="member-email"
                  type="email"
                  value={email}
                  placeholder={t('Add a member by email')}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="off"
                  className="pl-9"
                />
              </div>
              <Button
                type="submit"
                className="h-10"
                disabled={add.isPending || !email.trim()}
              >
                {add.isPending && <Spinner className="text-current" />}
                {t('Add')}
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
