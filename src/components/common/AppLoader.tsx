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
          <img
            src="/brand/gravium-icon-light.png"
            alt=""
            className="relative h-12 w-12 object-contain"
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

        <div className="mt-7 h-1 w-40 overflow-hidden rounded-full bg-[#F5F5F5]/10">
          <div className="h-full w-1/2 animate-[gravium-loader_1.35s_ease-in-out_infinite] rounded-full bg-[#F5F5F5]/70" />
        </div>
      </div>

      <style>{`
        @keyframes gravium-loader {
          0% {
            transform: translateX(-110%);
          }
          50% {
            transform: translateX(70%);
          }
          100% {
            transform: translateX(230%);
          }
        }
      `}</style>
    </div>
  );
}
