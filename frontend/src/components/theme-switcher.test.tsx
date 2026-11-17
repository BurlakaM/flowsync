import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { chooseOption } from '@/testing/test-utils';
import { ThemeSwitcher } from './theme-switcher';

afterEach(() => {
  document.documentElement.classList.remove('dark');
  document.documentElement.style.colorScheme = '';
});

describe('ThemeSwitcher', () => {
  it('switches the page to the dark theme and remembers the choice', async () => {
    const user = userEvent.setup();
    render(<ThemeSwitcher />);

    await chooseOption(user, screen.getByLabelText('Theme'), 'Dark');

    expect(document.documentElement).toHaveClass('dark');
    expect(localStorage.getItem('theme')).toBe('dark');

    await chooseOption(user, screen.getByLabelText('Theme'), 'Light');

    expect(document.documentElement).not.toHaveClass('dark');
    expect(localStorage.getItem('theme')).toBe('light');
  });
});
