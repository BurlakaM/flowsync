export const DOMAIN_EVENT = 'domain.event';

export type DomainEventType =
  | 'project.created'
  | 'project.updated'
  | 'project.deleted'
  | 'member.added'
  | 'member.removed'
  | 'task.created'
  | 'task.updated'
  | 'task.deleted'
  | 'comment.created'
  | 'comment.updated'
  | 'comment.deleted'
  | 'tag.created'
  | 'tag.updated'
  | 'tag.deleted';

export type DomainEntityType =
  'Project' | 'Member' | 'Task' | 'Comment' | 'Tag';

/**
 * Something that happened in a project. Services publish it after the change is saved; the audit log,
 * the notifications and the real-time updates each subscribe on their own, so a service never has to
 * know who is interested.
 */
export interface DomainEvent {
  type: DomainEventType;
  /** The user who did it. */
  actorId: number;
  projectId: number;
  entityType: DomainEntityType;
  /** For a member this is the id of the user. */
  entityId: number;
  /** Small JSON-safe facts shown in the activity feed (names, changes); never secrets or whole entities. */
  data: Record<string, unknown>;
}

/** What a subscriber receives: the event plus the id of its outbox row, the key for idempotency. */
export interface DeliveredDomainEvent extends DomainEvent {
  /** The same event always arrives with the same id, however many times it is delivered. */
  id: string;
}
