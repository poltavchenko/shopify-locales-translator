import { Translator } from 'npm:deepl-node@1.12.0';
import { corsHeaders } from '../_shared/cors.ts';

interface TranslateRequest {
  text: string;
  targetLang: string;
  sourceData?: Record<string, string>;
}

const DEEPL_API_KEY = Deno.env.get('DEEPL_API_KEY') || '';
const translator = new Translator(DEEPL_API_KEY);

const LANGUAGE_MAP: Record<string, string> = {
  'pl': 'PL',
  'uk': 'UK',
  'de': 'DE',
  'it': 'IT',
  'es': 'ES',
  'en-UK': 'EN-GB'
};

const DO_NOT_TRANSLATE = [
  'Add to cart',
  'Checkout',
  'SKU',
  'cart',
  'Cart'
];

async function translateText(text: string, targetLang: string): Promise<string> {
  if (DO_NOT_TRANSLATE.includes(text)) {
    return text;
  }

  try {
    const result = await translator.translateText(
      text,
      'EN',
      LANGUAGE_MAP[targetLang],
      {
        formality: 'more',
        preserveFormatting: true
      }
    );

    return result.text;
  } catch (error) {
    console.error('Translation error:', error);
    throw new Error(`Failed to translate text: ${error.message}`);
  }
}

async function translateLocaleData(
  sourceData: Record<string, string>,
  targetLang: string
): Promise<Record<string, string>> {
  const translatedData: Record<string, string> = {};
  const entries = Object.entries(sourceData);

  for (const [key, value] of entries) {
    if (typeof value === 'string') {
      const variables: string[] = [];
      const textWithPlaceholders = value.replace(/{{([^}]+)}}/g, (match) => {
        variables.push(match);
        return `__VAR${variables.length - 1}__`;
      });

      let translatedText = await translateText(textWithPlaceholders, targetLang);

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
    const { sourceData, targetLang } = await req.json() as TranslateRequest;

    if (!sourceData || !targetLang) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const translatedData = await translateLocaleData(sourceData, targetLang);

    return new Response(
      JSON.stringify(translatedData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});