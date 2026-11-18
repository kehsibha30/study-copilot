"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

// Go to another page without leaving a button switched off.
// "navigating" is true only while the move is under way, and React clears it by itself, so coming back with the
// Back button never finds a button still saying "Getting your questions ready…". (Bug seen 18 Nov 2026.)
export function useGo() {
  const router = useRouter();
  const [navigating, start] = useTransition();
  return { navigating, go: (url: string) => start(() => router.push(url)) };
}
