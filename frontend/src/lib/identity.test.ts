import { getIdentityColor, getInitials, IDENTITY_COLORS } from './identity';

describe('getInitials', () => {
  it('takes the first letters of the first and the last word', () => {
    expect(getInitials('Ann Lee')).toBe('AL');
    expect(getInitials('Ann Maria Lee')).toBe('AL');
  });

  it('works with one word, other alphabets and extra spaces', () => {
    expect(getInitials('ann')).toBe('A');
    expect(getInitials('  Іван   Коваль ')).toBe('ІК');
  });

  it('has a placeholder for an empty name', () => {
    expect(getInitials('   ')).toBe('?');
  });
});

describe('getIdentityColor', () => {
  it('gives the same color to the same text every time', () => {
    expect(getIdentityColor('Ann')).toBe(getIdentityColor('Ann'));
  });

  it('spreads neighbouring ids over different colors', () => {
    expect(getIdentityColor(1)).not.toBe(getIdentityColor(2));
    expect(getIdentityColor(1)).toBe(
      getIdentityColor(1 + IDENTITY_COLORS.length),
    );
  });
});
