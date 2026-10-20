/** Keep a cached first-party app from parsing a newer deployment's product. */
export async function currentDeploymentResponse(response: Response, ports: {
  readonly build: string;
  readonly version: () => Promise<Response>;
  readonly refresh: (build: string) => Promise<never>;
}): Promise<Response> {
  let version: unknown;
  try {
    const remote = await ports.version();
    if (!remote.ok) return response;
    version = await remote.json();
  } catch { return response; } // Offline visits keep their verified cached product.
  if (typeof version === 'object' && version !== null && 'build' in version &&
    typeof version.build === 'string' && version.build !== '' && version.build !== ports.build) {
    return ports.refresh(version.build);
  }
  return response;
}
