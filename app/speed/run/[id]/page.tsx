import { Suspense } from "react";
import SpeedRun from "@/components/SpeedRun";

async function Run({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SpeedRun id={id} />;
}

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="muted">Getting your questions ready…</p>}>
      <Run params={params} />
    </Suspense>
  );
}
