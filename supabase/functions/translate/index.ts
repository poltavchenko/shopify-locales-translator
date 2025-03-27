import { Deno } from 'deno.ns';
import { Translator } from 'https://esm.sh/deepl-node@1.12.0';
import { corsHeaders } from '../_shared/cors.ts';

interface TranslateRequest {
  text: string;
  targetLang: string;
  sourceData?: Record<string, string>;
}

const DEEPL_API_KEY = Deno.env.get('VITE_DEEPL_API_KEY') || '';
const translator = new Translator(DEEPL_API_KEY);

// Update the LANGUAGE_MAP to ensure it uses the correct DeepL language codes
const LANGUAGE_MAP: Record<string, string> = {
  pl: 'PL',
  de: 'DE',
  it: 'IT',
  es: 'ES',
  uk: 'UK', // Note: DeepL likely doesn't support Ukrainian
};

const DO_NOT_TRANSLATE = ['Add to cart', 'Checkout', 'SKU', 'cart', 'Cart'];

async function translateText(text: string, targetLang: string): Promise<string> {
  try {
    const deeplLang = LANGUAGE_MAP[targetLang] || targetLang.toUpperCase();
    const result = await translator.translateText(text, null, deeplLang);

    // The translator returns an array of translations or a single result
    return Array.isArray(result) ? result[0].text : result.text;
  } catch (error) {
    throw new Error(`Translation failed: ${error.message}`);
  }
}

// Add this function near the top of the file
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Update the translateLocaleData function to include throttling:
async function translateLocaleData(
  sourceData: Record<string, string>,
  targetLang: string
): Promise<Record<string, string>> {
  const translatedData: Record<string, string> = {};
  const entries = Object.entries(sourceData);

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

      // Add throttling to avoid rate limits
      if (requestCount > 0 && requestCount % THROTTLE_AFTER === 0) {
        await wait(THROTTLE_TIME);
      }
      requestCount++;

      const variables: string[] = [];
      const textWithPlaceholders = value.replace(/{{([^}]+)}}/g, (match) => {
        variables.push(match);
        return `__VAR${variables.length - 1}__`;
      });

      // Retry translation up to 3 times with increasing backoff
      let attempts = 0;
      let translatedText = '';
      while (attempts < 3) {
        try {
          translatedText = await translateText(textWithPlaceholders, targetLang);
          break;
        } catch (error) {
          attempts++;
          if (attempts >= 3) throw error;

          // Exponential backoff
          await wait(1000 * Math.pow(2, attempts));
        }
      }

      variables.forEach((variable, index) => {
        translatedText = translatedText.replace(`__VAR${index}__`, variable);
      });

      translatedData[key] = translatedText;
    }
  }

  return translatedData;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sourceData, targetLang } = (await req.json()) as TranslateRequest;

    if (!sourceData || !targetLang) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const translatedData = await translateLocaleData(sourceData, targetLang);

    return new Response(JSON.stringify(translatedData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
