type StateDirEnvSnapshot = {
  winclawStateDir: string | undefined;
  clawdbotStateDir: string | undefined;
};

export function snapshotStateDirEnv(): StateDirEnvSnapshot {
  return {
    winclawStateDir: process.env.WINCLAW_STATE_DIR,
    clawdbotStateDir: process.env.CLAWDBOT_STATE_DIR,
  };
}

export function restoreStateDirEnv(snapshot: StateDirEnvSnapshot): void {
  if (snapshot.winclawStateDir === undefined) {
    delete process.env.WINCLAW_STATE_DIR;
  } else {
    process.env.WINCLAW_STATE_DIR = snapshot.winclawStateDir;
  }
  if (snapshot.clawdbotStateDir === undefined) {
    delete process.env.CLAWDBOT_STATE_DIR;
  } else {
    process.env.CLAWDBOT_STATE_DIR = snapshot.clawdbotStateDir;
  }
}

export function setStateDirEnv(stateDir: string): void {
  process.env.WINCLAW_STATE_DIR = stateDir;
  delete process.env.CLAWDBOT_STATE_DIR;
}
