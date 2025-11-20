import { EventEmitter } from "node:events";
import type { AgenticGenerationLogEntry } from "./agentic/agent.js";

const emitter = new EventEmitter();
emitter.setMaxListeners(0);

export function emitRunLog(runId: string, entry: AgenticGenerationLogEntry) {
  emitter.emit(runId, entry);
}

export function emitRunCompletion(runId: string) {
  emitter.emit(`${runId}:end`);
}

export function subscribeRunLogs(
  runId: string,
  listener: (entry: AgenticGenerationLogEntry) => void
) {
  emitter.on(runId, listener);
  return () => emitter.off(runId, listener);
}

export function subscribeRunCompletion(runId: string, listener: () => void) {
  emitter.on(`${runId}:end`, listener);
  return () => emitter.off(`${runId}:end`, listener);
}
