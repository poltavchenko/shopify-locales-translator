import React, { useState } from 'react';
import { FileUploader } from './components/FileUploader';
import { TranslationPreview } from './components/TranslationPreview';
import { Globe2, Download } from 'lucide-react';
import { LocaleData, SupportedLanguage, LANGUAGES } from './types';
import { translateLocaleData } from './utils/translate';
import { exportTranslations, downloadTranslations } from './utils/export';
import { flattenObject } from './utils/flatten';
import { Analytics } from '@vercel/analytics/react';

function stripJsonComments(str: string): string {
  // Remove single line comments
  str = str.replace(/\/\/.*/g, '');

  // Remove multi-line comments
  str = str.replace(/\/\*[\s\S]*?\*\//g, '');

  // Remove trailing commas
  str = str.replace(/,(\s*[}\]])/g, '$1');

  return str.trim();
}

function App() {
  const [translations, setTranslations] = useState<Record<SupportedLanguage, LocaleData>>(
    {} as Record<SupportedLanguage, LocaleData>
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [languageErrors, setLanguageErrors] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState<{ total: number; completed: number }>({ total: 0, completed: 0 });

  const handleFileLoad = async (content: string) => {
    try {
      setIsLoading(true);
      setError(null);
      setLanguageErrors({});

      // Strip comments and parse JSON
      const cleanContent = stripJsonComments(content);
      const sourceData = JSON.parse(cleanContent);

      // Flatten the source data for display
      const flattenedSourceData = flattenObject(sourceData);

      // Initialize translations with flattened source data
      const initialTranslations = {
        'en-UK': flattenedSourceData,
      } as Record<SupportedLanguage, LocaleData>;

      // Calculate total number of languages to translate
      const languages = Object.keys(LANGUAGES).filter((lang) => lang !== 'en-UK');
      setProgress({ total: languages.length, completed: 0 });

      // Store language-specific errors
      const errors: Record<string, string> = {};

      // Translate to all supported languages, but continue even if one fails
      for (const lang of languages) {
        try {
          // For Ukrainian, bypass translation as it's not supported by DeepL
          if (lang === 'uk') {
            initialTranslations[lang as SupportedLanguage] = flattenedSourceData;
          } else {
            initialTranslations[lang as SupportedLanguage] = await translateLocaleData(
              flattenedSourceData,
              lang as SupportedLanguage
            );
          }
        } catch (translationError) {
          console.error(`Error translating to ${lang}:`, translationError);
          errors[lang] = `Failed to translate to ${LANGUAGES[lang as SupportedLanguage]}: ${translationError.message}`;
          // Don't return here - continue with other languages
        } finally {
          setProgress((prev) => ({ ...prev, completed: prev.completed + 1 }));
        }
      }

      // Set any language-specific errors
      if (Object.keys(errors).length > 0) {
        setLanguageErrors(errors);
        setError(`Translation completed with ${Object.keys(errors).length} language errors. See details below.`);
      }

      setTranslations(initialTranslations);
    } catch (error) {
      console.error('Error processing file:', error);
      setError("Error processing the file. Please make sure it's a valid JSON file.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const blob = await exportTranslations(translations);
      downloadTranslations(blob);
    } catch (error) {
      console.error('Error exporting translations:', error);
      setError('Failed to export translations');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="mx-auto max-w-7xl py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-8 text-center">
            <Globe2 className="mx-auto h-12 w-12 text-gray-400" />
            <h2 className="mt-2 text-3xl font-bold text-gray-900">Shopify Locales Translator</h2>
            <p className="mt-1 text-sm text-gray-500">
              Upload your locale file to translate it into multiple languages while preserving structure and variables
            </p>
          </div>

          <div className="flex flex-col items-center space-y-8">
            <FileUploader onFileLoad={handleFileLoad} />

            {isLoading && (
              <div className="w-full max-w-md text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900"></div>
                <p className="mt-2 text-sm text-gray-500">
                  Processing translations... ({progress.completed}/{progress.total})
                </p>
                {progress.total > 0 && (
                  <div className="mt-2 h-2.5 w-full rounded-full bg-gray-200">
                    <div
                      className="h-2.5 rounded-full bg-indigo-600"
                      style={{ width: `${(progress.completed / progress.total) * 100}%` }}
                    ></div>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="w-full max-w-2xl border-l-4 border-red-400 bg-red-50 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg
                      className="h-5 w-5 text-red-400"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {Object.keys(languageErrors).length > 0 && (
              <div className="w-full max-w-2xl">
                <h3 className="mb-2 text-sm font-medium text-gray-700">Language-specific errors:</h3>
                <ul className="space-y-2">
                  {Object.entries(languageErrors).map(([lang, errorMsg]) => (
                    <li
                      key={lang}
                      className="border-l-4 border-yellow-400 bg-yellow-50 p-3"
                    >
                      <p className="text-sm text-yellow-700">{errorMsg}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {Object.keys(translations).length > 0 && (
              <>
                <button
                  onClick={handleExport}
                  className="inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                >
                  <Download className="mr-2 h-5 w-5" />
                  Download Translations
                </button>
                <div className="w-full overflow-hidden rounded-lg shadow-xl">
                  <TranslationPreview translations={translations} />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <Analytics />
    </div>
  );
}

export default App;
