import { Suspense } from "react";
import SelfTestScreen from "@/components/SelfTestScreen";

export default function Page() {
  return (
    <Suspense fallback={<p className="muted">Opening your questions…</p>}>
      <SelfTestScreen />
    </Suspense>
  );
}
