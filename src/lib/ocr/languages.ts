// Tesseract language codes this build ships data for (see public/tessdata/
// and `npm run update-tessdata`). Adding a language means: bundle its
// @tesseract.js-data package's traineddata as public/tessdata/<code>.traineddata.gz,
// add it here, and it shows up in the canvas's OCR language picker.
export interface OcrLanguageOption {
  code: string
  label: string
}

export const OCR_LANGUAGES: OcrLanguageOption[] = [
  { code: 'eng', label: 'English' },
  { code: 'chi_sim', label: '简体中文' },
  { code: 'chi_tra', label: '繁體中文' },
]

export const DEFAULT_OCR_LANGUAGE = 'eng'
