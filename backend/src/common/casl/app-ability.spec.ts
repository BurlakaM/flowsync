import { subject } from '@casl/ability';
import { ForbiddenException } from '@nestjs/common';
import { defineAbilityFor } from './app-ability';
import { authorize } from './authorize';

const OWNER = 1;
const MEMBER = 2;
const project = { ownerId: OWNER };

const owner = defineAbilityFor(OWNER, project);
const member = defineAbilityFor(MEMBER, project);

describe('project abilities', () => {
  describe('the project itself', () => {
    it('lets everyone read it but only the owner change or delete it', () => {
      expect(owner.can('read', 'Project')).toBe(true);
      expect(member.can('read', 'Project')).toBe(true);

      expect(owner.can('update', 'Project')).toBe(true);
      expect(owner.can('delete', 'Project')).toBe(true);
      expect(member.can('update', 'Project')).toBe(false);
      expect(member.can('delete', 'Project')).toBe(false);
    });
  });

  describe('members', () => {
    it('lets only the owner add members', () => {
      expect(owner.can('create', 'Member')).toBe(true);
      expect(member.can('create', 'Member')).toBe(false);
    });

    it('lets the owner remove anyone and a member only themselves', () => {
      expect(owner.can('delete', subject('Member', { userId: MEMBER }))).toBe(
        true,
      );
      expect(member.can('delete', subject('Member', { userId: MEMBER }))).toBe(
        true,
      );
      expect(member.can('delete', subject('Member', { userId: 3 }))).toBe(
        false,
      );
    });
  });

  describe('tasks', () => {
    it('lets everyone create and edit tasks', () => {
      for (const ability of [owner, member]) {
        expect(ability.can('create', 'Task')).toBe(true);
        expect(ability.can('update', 'Task')).toBe(true);
      }
    });

    it('lets the author and the owner delete a task, but not another member', () => {
      const byMember = subject('Task', { createdById: MEMBER });
      const byOwner = subject('Task', { createdById: OWNER });
      const byDeleted = subject('Task', { createdById: null });

      expect(member.can('delete', byMember)).toBe(true);
      expect(member.can('delete', byOwner)).toBe(false);
      expect(member.can('delete', byDeleted)).toBe(false);
      expect(owner.can('delete', byMember)).toBe(true);
      expect(owner.can('delete', byDeleted)).toBe(true);
    });
  });

  describe('comments', () => {
    it('lets everyone add comments', () => {
      expect(owner.can('create', 'Comment')).toBe(true);
      expect(member.can('create', 'Comment')).toBe(true);
    });

    it('lets only the author edit a comment, even the owner cannot edit someone else’s', () => {
      expect(
        member.can('update', subject('Comment', { authorId: MEMBER })),
      ).toBe(true);
      expect(
        member.can('update', subject('Comment', { authorId: OWNER })),
      ).toBe(false);
      expect(
        owner.can('update', subject('Comment', { authorId: MEMBER })),
      ).toBe(false);
    });

    it('lets the author and the owner delete a comment (moderation)', () => {
      expect(
        member.can('delete', subject('Comment', { authorId: MEMBER })),
      ).toBe(true);
      expect(
        member.can('delete', subject('Comment', { authorId: OWNER })),
      ).toBe(false);
      expect(
        owner.can('delete', subject('Comment', { authorId: MEMBER })),
      ).toBe(true);
    });
  });

  describe('tags', () => {
    it('lets everyone create and rename tags but only the owner delete them', () => {
      for (const ability of [owner, member]) {
        expect(ability.can('create', 'Tag')).toBe(true);
        expect(ability.can('update', 'Tag')).toBe(true);
      }
      expect(owner.can('delete', 'Tag')).toBe(true);
      expect(member.can('delete', 'Tag')).toBe(false);
    });
  });

  it('gives nothing for unknown subjects', () => {
    expect(member.can('delete', 'Nothing' as never)).toBe(false);
  });
});

describe('authorize', () => {
  it('passes silently when the action is allowed', () => {
    expect(() =>
      authorize(OWNER, project, 'update', 'Project', 'nope'),
    ).not.toThrow();
  });

  it('throws 403 with the given message when it is not', () => {
    expect(() =>
      authorize(MEMBER, project, 'update', 'Project', 'Only the owner'),
    ).toThrow(new ForbiddenException('Only the owner'));
  });
});
