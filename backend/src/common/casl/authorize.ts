import { ForbiddenException } from '@nestjs/common';
import {
  defineAbilityFor,
  type Action,
  type ProjectContext,
  type SubjectName,
} from './app-ability';

/**
 * Throws 403 unless the user may perform the action in the project. The subject is a name
 * ("Project") or a tagged object (`subject('Task', task)`) when the rule depends on its fields.
 */
export function authorize(
  userId: number,
  project: ProjectContext,
  action: Action,
  target: SubjectName | object,
  message: string,
): void {
  if (!defineAbilityFor(userId, project).can(action, target)) {
    throw new ForbiddenException(message);
  }
}
