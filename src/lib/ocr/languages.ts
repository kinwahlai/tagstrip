export interface OcrLanguageOption {
  code: string
  label: string
}

// Every language whose model is bundled under public/tessdata/ (see
// `npm run update-tessdata` and CONTRIBUTING.md).
export const BUNDLED_OCR_LANGUAGES: OcrLanguageOption[] = [
  { code: 'eng', label: 'English' },
  { code: 'chi_sim', label: '简体中文 (Chinese Simplified)' },
  { code: 'chi_tra', label: '繁體中文 (Chinese Traditional)' },
  { code: 'msa', label: 'Bahasa Melayu (Malay)' },
  { code: 'tam', label: 'தமிழ் (Tamil)' },
  { code: 'tha', label: 'ภาษาไทย (Thai)' },
  { code: 'vie', label: 'Tiếng Việt (Vietnamese)' },
]

// "Suggest text" auto-combines every bundled language into one Tesseract
// pass EXCEPT Simplified vs Traditional Chinese — those two share so many
// identical or near-identical characters that combining both lets Tesseract
// pick the wrong script's reading for an ambiguous glyph (confirmed in
// practice: simplified text coming back misread as traditional). The other
// languages here are visually distinct enough from each other that this
// isn't a problem. So Chinese script is the one thing still a user choice —
// everything else stays fully automatic.
export const CHINESE_SCRIPT_OPTIONS: OcrLanguageOption[] = [
  { code: 'chi_sim', label: '简体 (Simplified)' },
  { code: 'chi_tra', label: '繁體 (Traditional)' },
]

export const DEFAULT_CHINESE_SCRIPT = 'chi_sim'

const NON_CHINESE_OCR_CODES = BUNDLED_OCR_LANGUAGES.map((lang) => lang.code).filter(
  (code) => code !== 'chi_sim' && code !== 'chi_tra',
)

// Builds the '+'-joined language string Tesseract expects: every non-Chinese
// language plus whichever Chinese script the user picked.
export function buildOcrLanguage(chineseScript: string): string {
  return [...NON_CHINESE_OCR_CODES, chineseScript].join('+')
}
