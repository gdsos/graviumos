import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { Check, X } from 'lucide-react';

type OperationPhase = 'loading' | 'success' | 'error';

interface OperationState {
  phase: OperationPhase;
  message: string;
}

interface OperationFeedbackContextValue {
  showOperationLoading: (message: string) => void;
  showOperationSuccess: (message?: string, duration?: number) => Promise<void>;
  showOperationError: (message?: string, duration?: number) => Promise<void>;
  hideOperation: () => void;
}

const OperationFeedbackContext = createContext<OperationFeedbackContextValue | null>(null);

function wait(duration: number) {
  return new Promise(resolve => window.setTimeout(resolve, duration));
}

function OperationFeedbackOverlay({ state }: { state: OperationState }) {
  const isLoading = state.phase === 'loading';
  const isSuccess = state.phase === 'success';
  const isError = state.phase === 'error';

  return (
    <div className="fixed inset-0 z-[10000] flex min-h-screen items-center justify-center overflow-hidden bg-black/38 px-4 text-[#F5F5F5] backdrop-blur-md">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(96,61,42,0.18),transparent_34%),linear-gradient(135deg,rgba(85,93,58,0.12),transparent_34%)]" />

      <div className="relative z-10 flex w-full max-w-[21rem] flex-col items-center rounded-[2rem] border border-[#F5F5F5]/12 bg-black/72 px-8 py-9 text-center shadow-2xl shadow-black/45 backdrop-blur-2xl">
        <div className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-[1.65rem] border border-[#F5F5F5]/12 bg-[#F5F5F5]/6 shadow-2xl shadow-black/40 backdrop-blur">
          <div className="absolute inset-0 rounded-[2rem] bg-gradient-to-b from-white/12 to-transparent" />

          {isLoading && (
            <>
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
                  style={{ animation: 'gravium_operation_trace 1.2s linear infinite' }}
                />
              </svg>

              <img
                src="/brand/gravium-icon-light.png"
                alt=""
                className="relative h-10 w-10 object-contain"
                style={{ filter: 'brightness(0) invert(1)' }}
              />
            </>
          )}

          {isSuccess && (
            <div className="relative flex h-12 w-12 animate-[gravium_success_pop_360ms_ease-out] items-center justify-center rounded-full border border-[#F5F5F5]/24 bg-[#F5F5F5]/12">
              <Check className="h-6 w-6 text-[#F5F5F5]" strokeWidth={2.4} />
            </div>
          )}

          {isError && (
            <div className="relative flex h-12 w-12 animate-[gravium_success_pop_360ms_ease-out] items-center justify-center rounded-full border border-[#F5F5F5]/24 bg-[#F5F5F5]/12">
              <X className="h-6 w-6 text-[#F5F5F5]" strokeWidth={2.4} />
            </div>
          )}
        </div>

        <img
          src="/brand/gravium-wordmark-light.png"
          alt="Gravium"
          className="mb-4 h-6 w-auto object-contain"
          style={{ filter: 'brightness(0) invert(1)' }}
        />

        <p className="text-sm font-medium uppercase tracking-[0.22em] text-[#F5F5F5]/72">
          {state.message}
        </p>
      </div>

      <style>{`
        @keyframes gravium_operation_trace {
          from {
            stroke-dashoffset: 0;
          }

          to {
            stroke-dashoffset: -100;
          }
        }

        @keyframes gravium_success_pop {
          0% {
            transform: scale(0.82);
            opacity: 0;
          }

          70% {
            transform: scale(1.06);
            opacity: 1;
          }

          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

export function OperationFeedbackProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OperationState | null>(null);

  const showOperationLoading = useCallback((message: string) => {
    setState({
      phase: 'loading',
      message,
    });
  }, []);

  const showOperationSuccess = useCallback(async (
    message: string = 'Saved Successfully',
    duration: number = 650
  ) => {
    setState({
      phase: 'success',
      message,
    });

    await wait(duration);
    setState(null);
  }, []);

  const showOperationError = useCallback(async (
    message: string = 'Something Went Wrong',
    duration: number = 900
  ) => {
    setState({
      phase: 'error',
      message,
    });

    await wait(duration);
    setState(null);
  }, []);

  const hideOperation = useCallback(() => {
    setState(null);
  }, []);

  const value = useMemo(
    () => ({
      showOperationLoading,
      showOperationSuccess,
      showOperationError,
      hideOperation,
    }),
    [hideOperation, showOperationError, showOperationLoading, showOperationSuccess]
  );

  return (
    <OperationFeedbackContext.Provider value={value}>
      {children}
      {state && <OperationFeedbackOverlay state={state} />}
    </OperationFeedbackContext.Provider>
  );
}

export function useOperationFeedback() {
  const context = useContext(OperationFeedbackContext);

  if (!context) {
    throw new Error('useOperationFeedback must be used inside OperationFeedbackProvider');
  }

  return context;
}
