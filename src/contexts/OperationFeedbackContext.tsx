import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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

const OperationFeedbackContext =
  createContext<OperationFeedbackContextValue | null>(null);

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
        {isLoading ? (
          <div className="relative mb-6 flex h-20 w-20 items-center justify-center rounded-[1.65rem] border border-[#F5F5F5]/12 bg-[#F5F5F5]/6 shadow-2xl shadow-black/40 backdrop-blur">
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
                style={{ animation: 'gravium_operation_trace 1.2s linear infinite' }}
              />
            </svg>

            <div
              aria-hidden="true"
              className="absolute inset-3 rounded-[1.25rem] border border-white/12"
              style={{ animation: 'gravium_operation_breathe 1.6s ease-in-out infinite' }}
            />

            <img
              src="/brand/gravium-crown-icon.svg"
              alt=""
              className="relative z-10 h-9 w-9 object-contain"
            />
          </div>
        ) : (
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-[#F5F5F5]/12 bg-[#F5F5F5]/6 shadow-2xl shadow-black/40 backdrop-blur">
            {isSuccess && <Check className="h-9 w-9 text-[#F5F5F5]" />}
            {isError && <X className="h-9 w-9 text-[#F5F5F5]" />}
          </div>
        )}

        <img
          src="/brand/gravium-wordmark-dark.png"
          alt="Gravium"
          className="mb-6 h-7 w-auto object-contain opacity-95 brightness-0 invert"
        />

        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.34em] text-[#F5F5F5]/72">
          {state.message}
        </p>
      </div>

      <style>{`
        @keyframes gravium_operation_trace {
          0% {
            stroke-dashoffset: 0;
          }

          100% {
            stroke-dashoffset: -100;
          }
        }

        @keyframes gravium_operation_breathe {
          0% {
            transform: scale(1);
            opacity: 0.55;
          }

          50% {
            transform: scale(1.06);
            opacity: 1;
          }

          100% {
            transform: scale(1);
            opacity: 0.55;
          }
        }
      `}</style>
    </div>
  );
}

export function OperationFeedbackProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<OperationState | null>(null);
  const operationIdRef = useRef(0);
  const safetyTimeoutRef = useRef<number | null>(null);
  const safetyClearTimeoutRef = useRef<number | null>(null);

  const clearSafetyTimers = useCallback(() => {
    if (safetyTimeoutRef.current !== null) {
      window.clearTimeout(safetyTimeoutRef.current);
      safetyTimeoutRef.current = null;
    }

    if (safetyClearTimeoutRef.current !== null) {
      window.clearTimeout(safetyClearTimeoutRef.current);
      safetyClearTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearSafetyTimers();
    };
  }, [clearSafetyTimers]);

  const showOperationLoading = useCallback(
    (message: string) => {
      clearSafetyTimers();

      const operationId = operationIdRef.current + 1;
      operationIdRef.current = operationId;

      setState({
        phase: 'loading',
        message,
      });

      safetyTimeoutRef.current = window.setTimeout(() => {
        if (operationIdRef.current !== operationId) return;

        setState({
          phase: 'error',
          message: 'Operation took too long. Please refresh and check if it completed.',
        });

        safetyClearTimeoutRef.current = window.setTimeout(() => {
          if (operationIdRef.current !== operationId) return;

          setState(null);
        }, 1800);
      }, 12000);
    },
    [clearSafetyTimers]
  );

  const showOperationSuccess = useCallback(
    async (message: string = 'Saved Successfully', duration: number = 650) => {
      clearSafetyTimers();

      const operationId = operationIdRef.current + 1;
      operationIdRef.current = operationId;

      setState({
        phase: 'success',
        message,
      });

      await wait(duration);

      if (operationIdRef.current === operationId) {
        setState(null);
      }
    },
    [clearSafetyTimers]
  );

  const showOperationError = useCallback(
    async (message: string = 'Something Went Wrong', duration: number = 900) => {
      clearSafetyTimers();

      const operationId = operationIdRef.current + 1;
      operationIdRef.current = operationId;

      setState({
        phase: 'error',
        message,
      });

      await wait(duration);

      if (operationIdRef.current === operationId) {
        setState(null);
      }
    },
    [clearSafetyTimers]
  );

  const hideOperation = useCallback(() => {
    clearSafetyTimers();
    operationIdRef.current += 1;
    setState(null);
  }, [clearSafetyTimers]);

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
