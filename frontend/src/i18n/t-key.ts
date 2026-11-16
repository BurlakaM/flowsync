/**
 * Marks a text that is translated later (for example a validation message kept in a schema outside any
 * component). It returns the text unchanged: the key IS the English text. The translation test finds
 * these markers just like it finds `t('...')`.
 */
export const tKey = (key: string): string => key;
