// Chunked to avoid blowing the call stack on String.fromCharCode(...bytes)
// for large PDFs/images.
const CHUNK_SIZE = 0x8000

export async function blobToBase64(blob: Blob): Promise<string> {
  // Routed through Response rather than calling blob.arrayBuffer() directly —
  // jsdom's Blob (used in tests) doesn't implement that method, while the
  // fetch API's Response does, in both real browsers and Node's test runtime.
  const bytes = new Uint8Array(await new Response(blob).arrayBuffer())
  let binary = ''
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE))
  }
  return btoa(binary)
}

export function base64ToBlob(base64: string, type: string): Blob {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return new Blob([bytes], { type })
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
