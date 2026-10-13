const KEY = "twyne.session";

export function loadSession() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY));
  } catch {
    return null;
  }
}
export const storeSession = (session) =>
  sessionStorage.setItem(KEY, JSON.stringify(session));
export const removeSession = () => sessionStorage.removeItem(KEY);
