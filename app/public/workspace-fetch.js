// The private workspace session is separate from Google/Codex account connections.
let redirecting = false;
export async function workspaceFetch(url, options) {
  const response = await fetch(url, options);
  if (response.status === 401) {
    if (!redirecting && typeof window !== 'undefined') {
      redirecting = true;
      window.location.assign('/?signin=expired');
    }
    throw new Error('Your workspace session expired. Sign in again to continue.');
  }
  return response;
}
