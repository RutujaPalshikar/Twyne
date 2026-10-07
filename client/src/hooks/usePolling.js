import { useEffect, useRef } from "react";

// Runs `callback` now and then every `intervalMs` while the component is mounted.
export default function usePolling(callback, intervalMs) {
  const latest = useRef(callback);
  useEffect(() => {
    latest.current = callback;
  });
  useEffect(() => {
    latest.current();
    const id = setInterval(() => latest.current(), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
}
