import { Deno } from 'deno.ns';
import { Translator } from 'https://esm.sh/deepl-node@1.12.0';
import { corsHeaders } from '../_shared/cors.ts';

interface TranslateRequest {
  text?: string;
  targetLang: string;
  sourceData?: Record<string, string>;
}

// Use DEEPL_API_KEY directly (set with supabase secrets set)
const translator = new Translator(DEEPL_API_KEY);

// Check if API key is available
if (!DEEPL_API_KEY) {
  console.error('DeepL API key is missing! Make sure to set it with: supabase secrets set DEEPL_API_KEY=your_key');
}

const translator = new Translator(apiKey);

// DeepL language codes are uppercase
const LANGUAGE_MAP: Record<string, string> = {
  pl: 'PL',
  de: 'DE',
  it: 'IT',
  es: 'ES',
  // uk: 'UK', // DeepL doesn't support Ukrainian
};

const DO_NOT_TRANSLATE = ['Add to cart', 'Checkout', 'SKU', 'cart', 'Cart'];

// Helper to pause execution
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function translateText(text: string, targetLang: string): Promise<string> {
  try {
    // Map language code to DeepL format
    const deeplLang = LANGUAGE_MAP[targetLang] || targetLang.toUpperCase();

    // Ensure we have a valid API key
    if (!DEEPL_API_KEY) {
      throw new Error('DeepL API key is not configured');
    }

    console.log(`Translating to ${deeplLang}...`);
    const result = await translator.translateText(text, null, deeplLang);
    return Array.isArray(result) ? result[0].text : result.text;
  } catch (error) {
    console.error('DeepL translation error:', error);
    throw new Error(`Translation failed: ${error.message}`);
  }
}

async function translateLocaleData(
  sourceData: Record<string, string>,
  targetLang: string
): Promise<Record<string, string>> {
  const translatedData: Record<string, string> = {};
  const entries = Object.entries(sourceData);

  // Add throttling to avoid rate limits
  let requestCount = 0;
  const THROTTLE_AFTER = 5; // Throttle after every 5 requests
  const THROTTLE_TIME = 1000; // Wait 1 second

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
      const MAX_ATTEMPTS = 3;

      while (attempts < MAX_ATTEMPTS) {
        try {
          translatedText = await translateText(textWithPlaceholders, targetLang);
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
    // Check if API key is configured
    // Get API key from header as fallback
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

    // Use apiKey variable instead of DEEPL_API_KEY in your translator
    const translator = new Translator(apiKey);

    // Parse request body
    const { sourceData, targetLang } = (await req.json()) as TranslateRequest;

    // Validate request
    if (!sourceData || !targetLang) {
      return new Response(JSON.stringify({ error: 'Missing required fields: sourceData and targetLang' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Perform translation
    console.log(`Starting translation to ${targetLang} with ${Object.keys(sourceData).length} strings`);
    const translatedData = await translateLocaleData(sourceData, targetLang);

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
