
"use client";

import { CoreFlowLogo } from "@/components/icons";

export function StartupAnimation() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover opacity-10"
        src="https://cdn.pixelbin.io/v2/throbbing-poetry-5e04c5/original/pexels-tima-miroshnichenko-7991158_1_1.mp4"
      />
      <div className="absolute inset-0 bg-background/50 backdrop-blur-sm"></div>
      <div className="z-10 animate-pulse">
        <CoreFlowLogo className="h-16 w-16 text-primary" />
      </div>
    </div>
  );
}
