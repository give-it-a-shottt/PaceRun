import { create } from 'zustand';

type ToastState = {
  message: string | null;
  /** 같은 문구를 연달아 띄워도 타이머가 다시 돌도록 구분하는 번호 */
  seq: number;
  show: (message: string) => void;
  hide: () => void;
};

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  seq: 0,
  show: (message) => set((s) => ({ message, seq: s.seq + 1 })),
  hide: () => set({ message: null }),
}));

/** 어디서든 부를 수 있는 토스트(3초). 예: `showToast('GPS 신호를 찾는 중')` */
export function showToast(message: string) {
  useToastStore.getState().show(message);
}
