/** Network failures read as a sentence a person can act on, not "Failed to fetch". */
export function friendly(error: { name?: string; message: string }): string {
  if (error.name === 'AuthRetryableFetchError' || /failed to fetch|networkerror|load failed/i.test(error.message)) {
    return "Couldn't reach verzus. Check your connection and try again.";
  }
  return error.message;
}
