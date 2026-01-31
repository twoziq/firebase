import { api } from './api';

const logs: string[] = [];
const originalLog = console.log;
const originalError = console.error;

console.log = (...args: any[]) => {
  logs.push(`[LOG] ${new Date().toLocaleTimeString()}: ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}`);
  originalLog.apply(console, args);
};

console.error = (...args: any[]) => {
  logs.push(`[ERROR] ${new Date().toLocaleTimeString()}: ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}`);
  originalError.apply(console, args);
};

export const copyLogsToClipboard = async () => {
  let serverLogs = "";
  try {
    const res = await api.get('/api/logs');
    if (res.data?.logs) {
      serverLogs = "\n\n--- SERVER LOGS ---\n" + res.data.logs.join('\n');
    }
  } catch (e) {
    serverLogs = "\n\n--- SERVER LOGS FETCH FAILED ---\n" + String(e);
  }

  const text = logs.join('\n') + serverLogs;
  
  if (!text.trim()) {
    alert('No logs recorded yet.');
    return;
  }
  navigator.clipboard.writeText(text).then(() => {
    alert('Debug logs (Client + Server) copied to clipboard! Please paste them into the chat.');
  }).catch(err => {
    alert('Failed to copy logs to clipboard.');
    originalError(err);
  });
};