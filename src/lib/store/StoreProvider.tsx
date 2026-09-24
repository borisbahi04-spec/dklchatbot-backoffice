"use client";

import { useState } from "react";
import { Provider } from "react-redux";
import { makeStore } from "./store";

export function StoreProvider({ children }: { children: React.ReactNode }) {
  // Initialiseur paresseux : `makeStore()` n'est appelé qu'une seule fois,
  // à la création du composant, et le store reste stable entre les rendus
  // (y compris en StrictMode).
  const [store] = useState(() => makeStore());

  return <Provider store={store}>{children}</Provider>;
}
