import { Suspense } from "react";
import FixScreen from "@/components/FixScreen";

export default function Page() {
  return (
    <Suspense fallback={<p className="muted">Opening…</p>}>
      <FixScreen />
    </Suspense>
  );
}
