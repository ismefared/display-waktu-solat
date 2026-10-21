import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

/**
 * 24/7 Fault-Isolating React Error Boundary
 * Traceability: Section 13 (24/7 Operation), Section 31 (Gate 9 Production Hardening)
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message || 'Ralat paparan tidak dijangka.',
    };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Display Waktu Solat ErrorBoundary]', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#060D0C] text-slate-100 flex flex-col items-center justify-center p-8 text-center">
          <div className="max-w-xl w-full border border-emerald-900/60 bg-[#0B1614] rounded-xl p-8 space-y-5">
            <h1 className="text-2xl font-bold text-amber-400">
              Pemulihan Automatik Paparan Waktu Solat
            </h1>
            <p className="text-slate-300 text-base leading-relaxed">
              Sistem mengesan gangguan sementara pada komponen paparan. Jadual waktu
              solat sedang dipulihkan secara selamat.
            </p>
            <p className="text-xs font-mono text-slate-400">
              Diagnostik: {this.state.errorMessage}
            </p>
            <div className="pt-2 flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={this.handleReset}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg transition-colors cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Pulihkan Paparan Sekarang</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
