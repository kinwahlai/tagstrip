// Pluggable OCR engine interface per SPEC.md section 2. Tesseract.js is the
// only implementation today (src/lib/ocr/tesseract.ts); a Transformers.js/Donut
// engine can be added later as a second implementation of this same interface
// without touching the calling code in src/lib/suggestText.ts.
export interface OcrResult {
  text: string
  confidence?: number
}

export interface OcrRecognizeOptions {
  // Engine-specific language hint. Tesseract treats this as one of its
  // language codes (e.g. "eng", "chi_sim") — see src/lib/ocr/languages.ts.
  lang?: string
}

export interface OcrEngine {
  name: string
  recognize(imageBlob: Blob, options?: OcrRecognizeOptions): Promise<OcrResult>
}
