import { render, screen } from '@testing-library/react';
import { Avatar, AvatarStack } from './avatar';

describe('Avatar', () => {
  it('shows the initials and is named after the person', () => {
    render(<Avatar name="Ann Lee" />);

    expect(screen.getByRole('img', { name: 'Ann Lee' })).toHaveTextContent(
      'AL',
    );
  });

  it('can be hidden from screen readers when the name is written next to it', () => {
    render(<Avatar name="Ann Lee" decorative />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});

describe('AvatarStack', () => {
  const people = [
    { id: 1, name: 'Ann Lee' },
    { id: 2, name: 'Bob Ray' },
    { id: 3, name: 'Cy Moon' },
  ];

  it('collapses the people that do not fit into a counter', () => {
    render(<AvatarStack people={people} max={2} />);

    expect(screen.getAllByRole('img')).toHaveLength(2);
    expect(screen.getByText('+1')).toHaveAttribute('title', 'Cy Moon');
  });

  it('shows everyone when they fit', () => {
    render(<AvatarStack people={people} />);

    expect(screen.getAllByRole('img')).toHaveLength(3);
    expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();
  });
});
