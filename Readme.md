# Shopify Locales Translator

A tool for translating Shopify theme locale files between different languages.

## Description

This project provides a utility for automating the translation of Shopify theme locale files. It helps store owners and developers maintain consistent translations across multiple languages for their Shopify themes.

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/shopify-locales-translator.git

# Navigate to the project directory
cd shopify-locales-translator

# Install dependencies
npm install
```

## Usage

```bash
# Basic usage
node translate.js --source en.json --target fr,es,de

# With custom output directory
node translate.js --source en.json --target fr,es,de --output ./translations
```

## Features

- Translate Shopify locale files to multiple languages simultaneously
- Preserve JSON structure and keys
- Support for all languages available through translation APIs
- Maintain formatting and placeholders in translated strings
- Option to review and manually adjust translations

## Configuration

Create a `.env` file with your translation API credentials:

```
TRANSLATION_API_KEY=your_api_key_here
```

## License

MIT