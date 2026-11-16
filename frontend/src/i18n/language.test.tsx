import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '@/i18n';
import { LanguageSwitcher } from '@/components/language-switcher';
import { detectLanguage } from './language';

describe('detectLanguage', () => {
  const browser = vi.spyOn(window.navigator, 'language', 'get');

  afterEach(() => browser.mockReset());

  it('uses English for an unknown browser language', () => {
    browser.mockReturnValue('de-DE');
    expect(detectLanguage()).toBe('en');
  });

  it('uses Ukrainian for a Ukrainian browser', () => {
    browser.mockReturnValue('uk-UA');
    expect(detectLanguage()).toBe('uk');
  });

  it('prefers the saved choice over the browser', () => {
    browser.mockReturnValue('uk-UA');
    localStorage.setItem('language', 'en');
    expect(detectLanguage()).toBe('en');
  });

  it('ignores a saved value it does not know', () => {
    browser.mockReturnValue('en-US');
    localStorage.setItem('language', 'xx');
    expect(detectLanguage()).toBe('en');
  });

  it('survives blocked storage', () => {
    browser.mockReturnValue('uk');
    const blocked = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('blocked');
      });

    expect(detectLanguage()).toBe('uk');
    blocked.mockRestore();
  });
});

describe('the interface in Ukrainian', () => {
  function Sample() {
    const { t } = useTranslation();
    return (
      <>
        <p>{t('Sign in')}</p>
        <p data-testid="tasks">{t('tasks_count', { count: 5 })}</p>
        <LanguageSwitcher />
      </>
    );
  }

  it('switches at once with the language selector and remembers the choice', async () => {
    const user = userEvent.setup();
    render(<Sample />);
    expect(screen.getByText('Sign in')).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Language'), 'uk');

    expect(await screen.findByText('Увійти')).toBeInTheDocument();
    expect(screen.getByLabelText('Мова')).toHaveValue('uk');
    expect(localStorage.getItem('language')).toBe('uk');
  });

  it.each([
    [1, '1 задача'],
    [2, '2 задачі'],
    [5, '5 задач'],
    [11, '11 задач'],
    [21, '21 задача'],
    [24, '24 задачі'],
    [0, '0 задач'],
  ])('uses the right form for %i tasks', async (count, expected) => {
    await act(() => i18n.changeLanguage('uk'));

    expect(i18n.t('tasks_count', { count })).toBe(expected);
  });

  it('uses English forms for English', async () => {
    expect(i18n.t('tasks_count', { count: 1 })).toBe('1 task');
    expect(i18n.t('tasks_count', { count: 3 })).toBe('3 tasks');
    expect(i18n.t('comments_count', { count: 1 })).toBe('1 comment');
  });

  it('shows an unknown text as it is', async () => {
    await act(() => i18n.changeLanguage('uk'));

    expect(i18n.t('Never translated text')).toBe('Never translated text');
    await waitFor(() => expect(i18n.language).toBe('uk'));
  });
});

describe('page language attribute', () => {
  it('follows the language of the interface', async () => {
    await act(() => i18n.changeLanguage('uk'));
    expect(document.documentElement.lang).toBe('uk');

    await act(() => i18n.changeLanguage('en'));
    expect(document.documentElement.lang).toBe('en');
  });
});
