import type { EmailContent } from '../notifications/notification-content';

// The token travels in the URL fragment (#token=...): browsers never send a fragment to a server or in a
// Referer header, so the secret does not end up in access logs or leak to third-party resources.

export function verificationEmail(appUrl: string, token: string): EmailContent {
  return {
    subject: 'Confirm your email address',
    text: `Welcome to FlowSync!\n\nConfirm your email address to receive notifications: ${appUrl}/verify-email#token=${token}\n\nThe link works for 24 hours. If you did not sign up, ignore this email.\n`,
  };
}

export function passwordResetEmail(
  appUrl: string,
  token: string,
): EmailContent {
  return {
    subject: 'Reset your FlowSync password',
    text: `Someone asked to reset the password of this account.\n\nChoose a new password: ${appUrl}/reset-password#token=${token}\n\nThe link works for one hour and only once. If it was not you, ignore this email: your password stays as it is.\n`,
  };
}
