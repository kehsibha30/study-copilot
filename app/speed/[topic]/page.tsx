import { Suspense } from "react";
import SpeedTopic from "@/components/SpeedTopic";

async function Topic({ params }: { params: Promise<{ topic: string }> }) {
  const { topic } = await params;
  return <SpeedTopic topic={topic} />;
}

export default function Page({ params }: { params: Promise<{ topic: string }> }) {
  return (
    <Suspense fallback={<p className="muted">Opening Speed…</p>}>
      <Topic params={params} />
    </Suspense>
  );
}
