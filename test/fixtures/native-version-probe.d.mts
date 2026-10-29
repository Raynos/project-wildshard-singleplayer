export interface VersionProbe {
  executable: string;
  realExecutable: string;
  pid: number | null;
  elapsedMs: number;
  cleanupMs: number;
  cleanupError: string | null;
  code: number | null;
  signal: NodeJS.Signals | null;
  timedOut: boolean;
  error: string | null;
  stdout: string;
  stderr: string;
  firstStdoutAtMs: number | null;
  versionLineAtMs: number | null;
  deadlineMs: number;
}
export interface FilesystemIdentity {
  path: string;
  device: number | null;
  filesystem: string | null;
  mount: {point: string; type: string; source: string} | null;
  error: string | null;
}
/** One --version invocation, with a ten-second measurement cap and owned process cleanup. */
export function measureNativeVersion(executable: string): Promise<VersionProbe>;
export function nativeFilesystem(path: string): FilesystemIdentity;
export function nativeStorageState(profile: string, runnerTemp: string | undefined): {
  profile: FilesystemIdentity;
  repositoryTmp: FilesystemIdentity;
  runnerTmp: FilesystemIdentity | null;
  systemTmp: FilesystemIdentity;
  profileAndRunnerSameDevice: boolean | null;
  profileAndSystemTmpSameDevice: boolean | null;
};
