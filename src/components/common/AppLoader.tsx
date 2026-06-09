interface AppLoaderProps {
  message?: string;
}

export function AppLoader({ message = 'Loading Gravium OS' }: AppLoaderProps) {
  return (
    <div className="fixed inset-0 z-[9999] flex min-h-screen items-center justify-center overflow-hidden bg-black text-[#F5F5F5]">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(96,61,42,0.34),transparent_34%),linear-gradient(135deg,rgba(85,93,58,0.20),transparent_34%),linear-gradient(180deg,rgba(245,245,245,0.08),transparent_28%)]" />
      <div className="pointer-events-none absolute inset-x-8 top-8 h-px bg-[#F5F5F5]/12" />
      <div className="pointer-events-none absolute inset-x-8 bottom-8 h-px bg-[#F5F5F5]/10" />

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center px-8 text-center">
        <div className="relative mb-7 flex h-24 w-24 items-center justify-center rounded-[2rem] border border-[#F5F5F5]/12 bg-[#F5F5F5]/6 shadow-2xl shadow-black/40 backdrop-blur">
          <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-b from-white/12 to-transparent" />

          <svg
            aria-hidden="true"
            className="pointer-events-none absolute inset-[-7px] h-[calc(100%+14px)] w-[calc(100%+14px)] -rotate-90"
            viewBox="0 0 112 112"
            fill="none"
          >
            <rect
              x="10"
              y="10"
              width="92"
              height="92"
              rx="30"
              pathLength="100"
              stroke="rgba(245,245,245,0.12)"
              strokeWidth="3"
            />
            <rect
              x="10"
              y="10"
              width="92"
              height="92"
              rx="30"
              pathLength="100"
              stroke="rgba(245,245,245,0.85)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="24 76"
              style={{ animation: 'gravium_app_loader_trace 1.2s linear infinite' }}
            />
          </svg>

          <img
            src="/brand/gravium-icon-light.png"
            alt=""
            className="relative z-10 h-12 w-12 object-contain"
            style={{ filter: 'brightness(0) invert(1)' }}
          />
        </div>

        <img
          src="/brand/gravium-wordmark-light.png"
          alt="Gravium"
          className="mb-4 h-7 w-auto object-contain"
          style={{ filter: 'brightness(0) invert(1)' }}
        />

        <p className="text-sm font-medium tracking-[0.22em] text-[#F5F5F5]/72 uppercase">
          {message}
        </p>

      </div>

      <style>{`
        @keyframes gravium_app_loader_trace {
          0% {
            stroke-dashoffset: 0;
          }

          100% {
            stroke-dashoffset: -100;
          }
        }
      `}</style>
    </div>
  );
}
