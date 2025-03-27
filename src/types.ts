export interface TranslationEntry {
  key: string;
  value: string;
}

export interface LocaleData {
  [key: string]: string;
}

export type SupportedLanguage = 'pl' | 'uk' | 'de' | 'it' | 'es' | 'en-UK';

export const LANGUAGES: Record<SupportedLanguage, string> = {
  pl: 'Polish',
  uk: 'Ukrainian',
  de: 'German',
  it: 'Italian',
  es: 'Spanish',
  'en-UK': 'British English',
};

export const DO_NOT_TRANSLATE = ['Add to cart', 'Checkout', 'SKU', 'cart', 'Cart'];
