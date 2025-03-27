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
    console.log(`Retrying after ${waitTime}ms... (${retries} attempts left)`);

    await wait(waitTime);
    return retryWithBackoff(fn, retries - 1, waitTime * 2);
  }
}

export async function translateLocaleData(sourceData: LocaleData, targetLang: SupportedLanguage): Promise<LocaleData> {
  try {
    // Get the API key from environment
    const apiKey = import.meta.env.VITE_DEEPL_API_KEY || '';

    if (!apiKey) {
      console.warn('DeepL API key is not set in environment variables');
    }

    return await retryWithBackoff(
      async () => {
        console.log(`Attempting translation to ${targetLang}...`);

        // Use fetch with timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout

        try {
          const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/translate`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
              'X-DeepL-API-Key': apiKey,
            },
            body: JSON.stringify({
              sourceData,
              targetLang,
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            let errorText;
            try {
              const error = await response.json();
              errorText = error.error || `HTTP error ${response.status}`;
            } catch (e) {
              errorText = `HTTP error ${response.status}`;
            }
            throw new Error(errorText);
          }

          return await response.json();
        } catch (error) {
          clearTimeout(timeoutId);
          if (error.name === 'AbortError') {
            throw new Error(`Translation request timed out for ${targetLang}`);
          }
          throw error;
        }
      },
      5,
      2000
    ); // Increase to 5 retries starting with 2s backoff
  } catch (error) {
    console.error(`Translation error (${targetLang}):`, error);
    throw new Error(`Failed to translate to ${targetLang}: ${error.message}`);
  }
}
