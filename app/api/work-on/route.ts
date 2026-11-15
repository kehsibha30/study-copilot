import { connection } from "next/server";
import { workOn } from "@/lib/workon";

// Worked out from the papers on disk each time it is asked for. Without connection() the build would
// freeze the answer at build time (the papers are read with synchronous file calls, which do not stop that).
export async function GET() {
  await connection();
  return Response.json({ report: workOn() });
}
