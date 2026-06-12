import { createContext, useContext, useEffect, useState } from 'react';

/* Lets each page set the topbar title + actions rendered by Layout. */
const TopbarContext = createContext({ title: '', actions: null, set: () => {} });

export function TopbarProvider({ children }) {
  const [state, setState] = useState({ title: '', actions: null });
  return (
    <TopbarContext.Provider value={{ ...state, set: setState }}>
      {children}
    </TopbarContext.Provider>
  );
}

export function useTopbarState() {
  return useContext(TopbarContext);
}

export function useTopbar(title, actions = null, deps = []) {
  const { set } = useContext(TopbarContext);
  useEffect(() => {
    set({ title, actions });
    return () => set({ title: '', actions: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
