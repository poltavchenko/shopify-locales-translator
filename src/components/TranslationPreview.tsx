import React from 'react';
import { LocaleData, SupportedLanguage } from '../types';

interface TranslationPreviewProps {
  translations: Record<SupportedLanguage, LocaleData>;
}

export const TranslationPreview: React.FC<TranslationPreviewProps> = ({ translations }) => {
  return (
    <div className="w-full overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Key</th>
            {Object.entries(translations).map(([lang]) => (
              <th
                key={lang}
                className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500"
              >
                {lang}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 bg-white">
          {Object.keys(translations[Object.keys(translations)[0] || '']).map((key) => (
            <tr key={key}>
              <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">{key}</td>
              {Object.entries(translations).map(([lang, data]) => (
                <td
                  key={lang}
                  className="whitespace-nowrap px-6 py-4 text-sm text-gray-500"
                >
                  {data[key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
