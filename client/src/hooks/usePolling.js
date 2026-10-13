import { useEffect, useRef } from "react";

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
