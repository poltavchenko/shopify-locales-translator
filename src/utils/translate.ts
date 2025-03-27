import { LocaleData, SupportedLanguage } from '../types';

// Helper function to wait for a specified time
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Retry function with exponential backoff
async function retryWithBackoff<T>(fn: () => Promise<T>, retries = 3, backoffMs = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) throw error;

    // If error message contains "Too many requests", wait longer
    const waitTime = error.message?.includes('Too many requests') ? backoffMs * 2 : backoffMs;

    await wait(waitTime);
    return retryWithBackoff(fn, retries - 1, waitTime * 2);
  }
}

export async function translateLocaleData(sourceData: LocaleData, targetLang: SupportedLanguage): Promise<LocaleData> {
  try {
    return await retryWithBackoff(async () => {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/translate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
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
    });
  } catch (error) {
    console.error('Translation error:', error);
    throw new Error(`Failed to translate: ${error.message}`);
  }
}
