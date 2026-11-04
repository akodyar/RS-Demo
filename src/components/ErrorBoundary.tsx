import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[HomeHub ErrorBoundary caught error]:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center text-slate-100">
          <div className="max-w-md w-full bg-slate-900/90 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-slate-800 space-y-6">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 flex items-center justify-center mx-auto text-2xl font-bold shadow-lg shadow-amber-500/10">
              ⚠️
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-100 mb-1">
                کێشەیەک ڕوویدا / An error occurred
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                تکایە پەڕەکە نوێ بکەرەوە یان بگەڕێوە بۆ پەڕەی سەرەکی.
              </p>
            </div>
            {this.state.error && (
              <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-3 text-start text-xs font-mono text-red-400 overflow-x-auto max-h-32">
                {this.state.error.message}
              </div>
            )}
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold rounded-xl text-xs transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                نوێکردنەوە / Reload
              </button>
              <button
                onClick={() => (window.location.href = '/')}
                className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                سەرەکی / Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
