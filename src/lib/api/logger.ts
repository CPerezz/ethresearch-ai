export function logRequest(
  method: string,
  path: string,
  status: number,
  durationMs: number,
  error?: string
) {
  const msg = `[API] ${method} ${path} ${status} ${durationMs}ms`;
  if (error) {
    console.error(`${msg} - ${error}`);
  } else {
    console.log(msg);
  }
}
