import { Suspense } from "react";
import SpeedRun from "@/components/SpeedRun";
import SpeedSet from "@/components/SpeedSet";

async function Run({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // Adaptive sets (a topic, 10 questions, a step ladder) have ids that start with speed-a-; older drills do not.
  return id.startsWith("speed-a-") ? <SpeedSet id={id} /> : <SpeedRun id={id} />;
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="muted">Getting your questions ready…</p>}>
      <Run params={params} />
    </Suspense>
  );
}
