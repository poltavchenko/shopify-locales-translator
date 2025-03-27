import JSZip from 'jszip';
import { LocaleData, SupportedLanguage } from '../types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function unflattenObject(flattenedObj: Record<string, string>): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = {};

  for (const key in flattenedObj) {
    const keys = key.split('.');
    let current = result;

    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (i === keys.length - 1) {
        current[k] = flattenedObj[key];
      } else {
        current[k] = current[k] || {};
        current = current[k];
      }
    }
  }

  return result;
}

export async function exportTranslations(translations: Record<SupportedLanguage, LocaleData>): Promise<Blob> {
  const zip = new JSZip();

  Object.entries(translations).forEach(([lang, data]) => {
    // Unflatten the data before saving
    const unflattened = unflattenObject(data);

    // Format filename according to Shopify standards (e.g., es.json, de.json)
    const filename = `${lang}.json`;
    const content = JSON.stringify(unflattened, null, 2);
    zip.file(filename, content);
  });

  return await zip.generateAsync({ type: 'blob' });
}

export function downloadTranslations(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'shopify-translations.zip';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
