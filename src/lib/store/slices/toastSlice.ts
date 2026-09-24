import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export interface ToastItem {
  id: number;
  message: string;
  tone: "success" | "error";
}

interface ToastState {
  items: ToastItem[];
}

const initialState: ToastState = { items: [] };

let counter = 0;

const toastSlice = createSlice({
  name: "toast",
  initialState,
  reducers: {
    pushToast: {
      reducer(state, action: PayloadAction<ToastItem>) {
        state.items.push(action.payload);
      },
      prepare(message: string, tone: ToastItem["tone"]) {
        return { payload: { id: ++counter, message, tone } };
      },
    },
    removeToast(state, action: PayloadAction<number>) {
      state.items = state.items.filter((t) => t.id !== action.payload);
    },
  },
});

export const { pushToast, removeToast } = toastSlice.actions;
export default toastSlice.reducer;
