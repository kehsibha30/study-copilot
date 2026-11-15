import { Suspense } from "react";
import PaperScreen from "@/components/PaperScreen";

export default function Page() {
  return (
    <Suspense fallback={<p className="muted">Opening your paper…</p>}>
      <PaperScreen />
    </Suspense>
  );
}
