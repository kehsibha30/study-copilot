import fs from "node:fs";
import { PDFDocument } from "pdf-lib";
import type Anthropic from "@anthropic-ai/sdk";
import { filePath, type Paper, type Question } from "./store";

type Content = Anthropic.Beta.BetaContentBlockParam[];

// Only the one page a question sits on, so a small job does not pay to re-read the whole paper.
// Returns nothing for questions that do not depend on a figure.
export async function pageOf(paper: Paper, q: Question): Promise<Content> {
  if (!q.hasFigure) return [];
  const first = paper.files[0];
  if (!first) return [];
  if (first.mime === "application/pdf") {
    const bytes = fs.readFileSync(filePath(paper.id, first.stored));
    let data = bytes.toString("base64");
    try {
      const src = await PDFDocument.load(bytes);
      const index = q.page - 1;
      if (index >= 0 && index < src.getPageCount()) {
        const one = await PDFDocument.create();
        const [page] = await one.copyPages(src, [index]);
        one.addPage(page);
        data = Buffer.from(await one.save()).toString("base64");
      }
    } catch (error) {
      console.error(`[paper ${paper.id}] could not cut out page ${q.page}; sending the whole file`, error);
    }
    return [{ type: "document", source: { type: "base64", media_type: "application/pdf", data } }];
  }
  const file = paper.files[Math.min(Math.max(q.page - 1, 0), paper.files.length - 1)];
  const data = fs.readFileSync(filePath(paper.id, file.stored)).toString("base64");
  return [{ type: "image", source: { type: "base64", media_type: file.mime as "image/jpeg" | "image/png" | "image/webp", data } }];
}
