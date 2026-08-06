import { Suspense } from "react";
import { StudioClient } from "@/components/studio-client";

export default function StudioPage() {
  return (
    <Suspense fallback={null}>
      <StudioClient />
    </Suspense>
  );
}
