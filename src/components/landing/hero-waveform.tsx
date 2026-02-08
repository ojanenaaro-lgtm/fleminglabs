"use client";

export function HeroWaveform() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Three overlapping sine-wave paths at different opacities */}
      <svg
        viewBox="0 0 2880 400"
        className="absolute bottom-0 w-[200%] h-[400px] animate-[waveform-drift_20s_linear_infinite]"
        preserveAspectRatio="none"
      >
        {/* Wave 1 — deepest, slowest */}
        <path
          d="M0,280 C120,240 240,320 360,280 C480,240 600,320 720,280 C840,240 960,320 1080,280 C1200,240 1320,320 1440,280 C1560,240 1680,320 1800,280 C1920,240 2040,320 2160,280 C2280,240 2400,320 2520,280 C2640,240 2760,320 2880,280"
          fill="none"
          stroke="#8BA888"
          strokeWidth="2"
          opacity="0.15"
          className="animate-[waveform-breathe_6s_ease-in-out_infinite]"
        />
        {/* Wave 2 — mid layer */}
        <path
          d="M0,300 C160,260 320,340 480,300 C640,260 800,340 960,300 C1120,260 1280,340 1440,300 C1600,260 1760,340 1920,300 C2080,260 2240,340 2400,300 C2560,260 2720,340 2880,300"
          fill="none"
          stroke="#8BA888"
          strokeWidth="2.5"
          opacity="0.25"
          className="animate-[waveform-breathe_5s_ease-in-out_infinite_0.5s]"
        />
        {/* Wave 3 — top layer, most visible */}
        <path
          d="M0,320 C200,290 400,350 600,320 C800,290 1000,350 1200,320 C1400,290 1600,350 1800,320 C2000,290 2200,350 2400,320 C2600,290 2800,350 2880,320"
          fill="none"
          stroke="#8BA888"
          strokeWidth="3"
          opacity="0.40"
          className="animate-[waveform-breathe_4s_ease-in-out_infinite_1s]"
        />
      </svg>
    </div>
  );
}
