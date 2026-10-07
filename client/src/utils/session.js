// The temporary session lives in sessionStorage: it survives a refresh of this
// tab, but disappears when the tab closes. No accounts, nothing permanent.
const KEY = "twyne.session";

export function loadSession() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY));
  } catch {
    return null;
  }
}
export const storeSession = (session) => sessionStorage.setItem(KEY, JSON.stringify(session));
export const removeSession = () => sessionStorage.removeItem(KEY);
