import { Deno } from 'deno.ns';
import { Translator } from 'https://esm.sh/deepl-node@1.12.0';
import { corsHeaders } from '../_shared/cors.ts';

interface TranslateRequest {
  text?: string;
  targetLang: string;
  sourceData?: Record<string, string>;
}

// Get API key from environment or header
const DEEPL_API_KEY = Deno.env.get('DEEPL_API_KEY') || '';

// DeepL language codes are uppercase
const LANGUAGE_MAP: Record<string, string> = {
  fr: 'FR',
  de: 'DE',
  es: 'ES',
  it: 'IT',
  nl: 'NL',
  pl: 'PL',
  pt: 'PT',
  ru: 'RU',
};

const DO_NOT_TRANSLATE = ['Add to cart', 'Checkout', 'SKU', 'cart', 'Cart'];

// Helper to pause execution
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Single translateText function that uses the translator instance
async function translateText(text: string, targetLang: string, translator: Translator): Promise<string> {
  try {
    // Map language code to DeepL format
    const deeplLang = LANGUAGE_MAP[targetLang] || targetLang.toUpperCase();

    console.log(`Translating to ${deeplLang}...`);
    const result = await translator.translateText(text, null, deeplLang);
    return Array.isArray(result) ? result[0].text : result.text;
  } catch (error) {
    console.error('DeepL translation error:', error);
    throw new Error(`Translation failed: ${error.message}`);
  }
}

// Single translateLocaleData function
async function translateLocaleData(
  sourceData: Record<string, string>,
  targetLang: string,
  translator: Translator
): Promise<Record<string, string>> {
  const translatedData: Record<string, string> = {};
  const entries = Object.entries(sourceData);

  // Add throttling to avoid rate limits
  let requestCount = 0;
  const THROTTLE_AFTER = 5; // Throttle after every 5 requests
  const THROTTLE_TIME = 1000; // Wait 1 second
  const MAX_ATTEMPTS = 3;

  for (const [key, value] of entries) {
    if (typeof value === 'string') {
      // Skip translation for items in DO_NOT_TRANSLATE list
      if (DO_NOT_TRANSLATE.includes(value)) {
        translatedData[key] = value;
        continue;
      }

      // Throttle requests to avoid hitting API limits
      if (requestCount > 0 && requestCount % THROTTLE_AFTER === 0) {
        console.log(`Throttling for ${THROTTLE_TIME}ms after ${requestCount} requests`);
        await wait(THROTTLE_TIME);
      }
      requestCount++;

      // Handle variables like {{count}} by replacing them temporarily
      const variables: string[] = [];
      const textWithPlaceholders = value.replace(/{{([^}]+)}}/g, (match) => {
        variables.push(match);
        return `__VAR${variables.length - 1}__`;
      });

      // Retry logic with exponential backoff
      let attempts = 0;
      let translatedText = '';

      while (attempts < MAX_ATTEMPTS) {
        try {
          translatedText = await translateText(textWithPlaceholders, targetLang, translator);
          break;
        } catch (error) {
          attempts++;
          console.error(`Translation attempt ${attempts} failed: ${error.message}`);

          if (attempts >= MAX_ATTEMPTS) {
            throw error;
          }

          // Exponential backoff
          const backoffTime = 1000 * Math.pow(2, attempts);
          console.log(`Retrying in ${backoffTime}ms...`);
          await wait(backoffTime);
        }
      }

      // Restore variables
      variables.forEach((variable, index) => {
        translatedText = translatedText.replace(`__VAR${index}__`, variable);
      });

      translatedData[key] = translatedText;
    }
  }

  return translatedData;
}

// Main endpoint handler
Deno.serve(async (req) => {
  // Handle preflight CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get API key from environment or header
    const apiKey = DEEPL_API_KEY || req.headers.get('X-DeepL-API-Key') || '';

    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error:
            'DeepL API key is not configured. Either set with supabase secrets or provide in X-DeepL-API-Key header',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse request body
    let requestData;
    try {
      requestData = await req.json();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { sourceData, targetLang } = requestData as TranslateRequest;

    // Validate request
    if (!sourceData || !targetLang) {
      return new Response(JSON.stringify({ error: 'Missing required fields: sourceData and targetLang' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify target language is supported
    if (!LANGUAGE_MAP[targetLang] && !Object.values(LANGUAGE_MAP).includes(targetLang.toUpperCase())) {
      return new Response(JSON.stringify({ error: `Unsupported target language: ${targetLang}` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Try direct API call if translator instance fails
    let translatedData;
    try {
      // Create translator instance with the API key
      const translator = new Translator(apiKey);
      console.log(`Starting translation to ${targetLang} with ${Object.keys(sourceData).length} strings`);
      translatedData = await translateLocaleData(sourceData, targetLang, translator);
    } catch (error) {
      console.error(`Translation failed with library: ${error.message}`);
      // If regular translation fails, attempt direct API call
      // This is a fallback mechanism
      console.log('Attempting direct API call as fallback...');
      translatedData = await directDeeplTranslation(sourceData, targetLang, apiKey);
    }

    // Return translated data
    return new Response(JSON.stringify(translatedData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in translate function:', error);

    return new Response(JSON.stringify({ error: `Translation error: ${error.message}` }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Add this direct API call function as fallback
async function directDeeplTranslation(
  sourceData: Record<string, string>,
  targetLang: string,
  apiKey: string
): Promise<Record<string, string>> {
  const translatedData: Record<string, string> = {};
  const entries = Object.entries(sourceData);
  const deeplLang = LANGUAGE_MAP[targetLang] || targetLang.toUpperCase();

  for (const [key, value] of entries) {
    if (typeof value !== 'string') continue;

    // Skip translation for items in DO_NOT_TRANSLATE list
    if (DO_NOT_TRANSLATE.includes(value)) {
      translatedData[key] = value;
      continue;
    }

    // Handle variables like {{count}}
    const variables: string[] = [];
    const textWithPlaceholders = value.replace(/{{([^}]+)}}/g, (match) => {
      variables.push(match);
      return `__VAR${variables.length - 1}__`;
    });

    // Direct API call
    try {
      const response = await fetch('https://api.deepl.com/v2/translate', {
        method: 'POST',
        headers: {
          Authorization: `DeepL-Auth-Key ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: [textWithPlaceholders],
          target_lang: deeplLang,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`DeepL API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      let translatedText = data.translations[0].text;

      // Restore variables
      variables.forEach((variable, index) => {
        translatedText = translatedText.replace(`__VAR${index}__`, variable);
      });

      translatedData[key] = translatedText;

      // Throttle requests
      await wait(200);
    } catch (error) {
      console.error(`Error translating key ${key}: ${error.message}`);
      // Keep original text if translation fails
      translatedData[key] = value;
    }
  }

  return translatedData;
}
