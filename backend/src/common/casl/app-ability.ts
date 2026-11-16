import {
  AbilityBuilder,
  createMongoAbility,
  type MongoAbility,
} from '@casl/ability';

export type Action = 'read' | 'create' | 'update' | 'delete';
export type SubjectName = 'Project' | 'Member' | 'Task' | 'Comment' | 'Tag';

/** Objects handed to `can()` are tagged with `subject('Task', { ... })`, so the conditions below can read their fields. */
export type AppAbility = MongoAbility<[Action, SubjectName | object]>;

/** What the rules need to know about the project the user is acting in. */
export interface ProjectContext {
  ownerId: number;
}

const EVERYTHING_IN_A_PROJECT: SubjectName[] = [
  'Project',
  'Member',
  'Task',
  'Comment',
  'Tag',
];

/**
 * The single place that says who may do what inside a project. It is built for users who can already
 * see the project (access is checked first and answers 404): this is about 403, "you may look, but not do this".
 *
 * Conditions use the fields of the object being acted on: `createdById` of a task, `authorId` of a
 * comment, `userId` of a membership.
 */
export function defineAbilityFor(
  userId: number,
  project: ProjectContext,
): AppAbility {
  const { can, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

  // Owner and members alike.
  can('read', EVERYTHING_IN_A_PROJECT);
  can('create', ['Task', 'Comment', 'Tag']);
  can('update', ['Task', 'Tag']);
  can('update', 'Comment', { authorId: userId });
  can('delete', 'Task', { createdById: userId });
  can('delete', 'Comment', { authorId: userId });
  can('delete', 'Member', { userId }); // leaving the project

  if (project.ownerId === userId) {
    can('update', 'Project');
    can('delete', ['Project', 'Task', 'Comment', 'Tag', 'Member']);
    can('create', 'Member');
  }

  return build();
}
