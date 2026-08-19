export interface OcrLanguageOption {
  code: string
  label: string
}

// Every language whose model is bundled under public/tessdata/ (see
// `npm run update-tessdata` and CONTRIBUTING.md). "Suggest text" runs exactly
// ONE of these per call, picked via the canvas's OCR language selector — not
// combined. Tesseract's multi-language mode was tried first (see git history)
// but proved unreliable once several visually-distinct scripts were combined
// in one pass: it would sometimes identify the wrong script entirely (e.g.
// Chinese text coming back as Tamil), not just misread an ambiguous
// character. A single explicit language per call is the only way to
// guarantee Tesseract actually uses the right model.
export const BUNDLED_OCR_LANGUAGES: OcrLanguageOption[] = [
  { code: 'eng', label: 'English' },
  { code: 'chi_sim', label: '简体中文 (Chinese Simplified)' },
  { code: 'chi_tra', label: '繁體中文 (Chinese Traditional)' },
  { code: 'msa', label: 'Bahasa Melayu (Malay)' },
  { code: 'tam', label: 'தமிழ் (Tamil)' },
  { code: 'tha', label: 'ภาษาไทย (Thai)' },
  { code: 'vie', label: 'Tiếng Việt (Vietnamese)' },
]

export const DEFAULT_OCR_LANGUAGE = 'eng'
