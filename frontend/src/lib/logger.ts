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

export const copyLogsToClipboard = () => {
  const text = logs.join('\n');
  if (!text) {
    alert('No logs recorded yet.');
    return;
  }
  navigator.clipboard.writeText(text).then(() => {
    alert('Debug logs copied to clipboard! Please paste them into the chat.');
  }).catch(err => {
    alert('Failed to copy logs to clipboard.');
    originalError(err);
  });
};