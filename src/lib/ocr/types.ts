// Pluggable OCR engine interface per SPEC.md section 2. PP-OCRv6 is the only
// implementation today (src/lib/ocr/ppocr.ts); another engine can be added as a
// second implementation of this same interface without touching the calling
// code in src/lib/suggestText.ts.
export interface OcrResult {
  text: string
  confidence?: number
}

export interface OcrEngine {
  name: string
  recognize(imageBlob: Blob): Promise<OcrResult>
}
