export interface OcrLanguageOption {
  code: string
  label: string
}

// Every language whose model is bundled under public/tessdata/ (see
// `npm run update-tessdata` and CONTRIBUTING.md). "Suggest text" always runs
// all of them combined via Tesseract's "eng+chi_sim+..." multi-language
// syntax — auto-detecting per-character which script fits, rather than
// asking the user to pick one — so adding a language here (plus bundling its
// data file) is the only step needed to wire it in.
export const BUNDLED_OCR_LANGUAGES: OcrLanguageOption[] = [
  { code: 'eng', label: 'English' },
  { code: 'chi_sim', label: '简体中文 (Chinese Simplified)' },
  { code: 'chi_tra', label: '繁體中文 (Chinese Traditional)' },
  { code: 'msa', label: 'Bahasa Melayu (Malay)' },
  { code: 'tam', label: 'தமிழ் (Tamil)' },
  { code: 'tha', label: 'ภาษาไทย (Thai)' },
  { code: 'vie', label: 'Tiếng Việt (Vietnamese)' },
]

export const DEFAULT_OCR_LANGUAGE = BUNDLED_OCR_LANGUAGES.map((lang) => lang.code).join('+')
