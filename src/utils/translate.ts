import { LocaleData, SupportedLanguage } from '../types';

export async function translateLocaleData(
  sourceData: LocaleData,
  targetLang: SupportedLanguage
): Promise<LocaleData> {
  try {
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/translate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sourceData,
        targetLang,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Translation failed');
    }

    return await response.json();
  } catch (error) {
    console.error('Translation error:', error);
    throw new Error(`Failed to translate: ${error.message}`);
  }
}