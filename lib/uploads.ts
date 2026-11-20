// What an upload may contain. Shared by the two upload steps (prepare, then create).

export const ALLOWED: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
export const MAX_TOTAL_BYTES = 20 * 1024 * 1024;
export const MAX_FILES = 30;

export type FileMeta = { name: string; type: string; size: number };

export function storedName(i: number, type: string) {
  return `page-${i + 1}.${ALLOWED[type]}`;
}

// Returns a plain sentence for the student if the files cannot be used, or null if they are fine.
export function checkFiles(files: FileMeta[]): string | null {
  const ok = files.filter((f) => f && typeof f.name === "string" && typeof f.type === "string" && typeof f.size === "number" && f.size > 0);
  if (ok.length === 0 || ok.length !== files.length) return "Choose a PDF or photos of your paper first.";
  if (ok.length > MAX_FILES) return `That is more than ${MAX_FILES} files. Upload fewer pages at a time.`;
  const bad = ok.find((f) => !ALLOWED[f.type]);
  if (bad) return `"${bad.name}" is not a PDF or a photo. Use PDF, JPG or PNG.`;
  const pdfs = ok.filter((f) => f.type === "application/pdf");
  if (pdfs.length > 1 || (pdfs.length === 1 && ok.length > 1)) return "Upload one PDF, or photos of the pages, not both together.";
  if (ok.reduce((sum, f) => sum + f.size, 0) > MAX_TOTAL_BYTES) return "That is over 20 MB. Upload fewer pages at a time.";
  return null;
}

export const MAX_KEY_FILES = 6;

export function keyStoredName(i: number, type: string) {
  return `key-${i + 1}.${ALLOWED[type]}`;
}

// The answer key photos or PDF. Same rules as the paper, but fewer pages.
export function checkKeyFiles(files: FileMeta[]): string | null {
  if (files.length > MAX_KEY_FILES) return `That is more than ${MAX_KEY_FILES} pages for the answer key.`;
  return checkFiles(files);
}
