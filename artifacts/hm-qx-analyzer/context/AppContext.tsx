import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  ReactNode,
} from 'react';

export type AppView = 'dashboard' | 'analyzer';

export interface Signal {
  direction: 'UP' | 'DOWN';
  strength: number;
  holdPrice: number;
  closePrice: number;
  label: string;
}

interface AppContextType {
  view: AppView;
  setView: (v: AppView) => void;
  currentUrl: string;
  setCurrentUrl: (url: string) => void;
  scanStatus: string;
  setScanStatus: (s: string) => void;
  isScanning: boolean;
  setIsScanning: (v: boolean) => void;
  signal: Signal | null;
  setSignal: (s: Signal | null) => void;
  autoScanEnabled: boolean;
  setAutoScanEnabled: (v: boolean) => void;

  // Price event bridge between BrowserView ↔ useCandleSignal
  priceHandlerRef: React.MutableRefObject<((price: number) => void) | null>;
  reportPrice: (price: number) => void;

  // Scan trigger: BrowserView watches this to inject JS
  scanTrigger: number;
  fireScanTrigger: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<AppView>('dashboard');
  const [currentUrl, setCurrentUrl] = useState('');
  const [scanStatus, setScanStatus] = useState('CANDLE REACTION AI ACTIVE');
  const [isScanning, setIsScanning] = useState(false);
  const [signal, setSignal] = useState<Signal | null>(null);
  const [autoScanEnabled, setAutoScanEnabled] = useState(true);

  // A ref so the price handler can be swapped without re-renders
  const priceHandlerRef = useRef<((price: number) => void) | null>(null);

  const reportPrice = useCallback((price: number) => {
    priceHandlerRef.current?.(price);
  }, []);

  // Incrementing trigger — BrowserView useEffect reacts to this
  const [scanTrigger, setScanTrigger] = useState(0);
  const fireScanTrigger = useCallback(() => {
    setScanTrigger((n) => n + 1);
  }, []);

  return (
    <AppContext.Provider
      value={{
        view,
        setView,
        currentUrl,
        setCurrentUrl,
        scanStatus,
        setScanStatus,
        isScanning,
        setIsScanning,
        signal,
        setSignal,
        autoScanEnabled,
        setAutoScanEnabled,
        priceHandlerRef,
        reportPrice,
        scanTrigger,
        fireScanTrigger,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
