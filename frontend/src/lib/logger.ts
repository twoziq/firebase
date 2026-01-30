// Simple logger to capture console logs for debugging
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

export const getLogs = () => logs.join('\n');

export const copyLogsToClipboard = () => {
  const text = getLogs();
  navigator.clipboard.writeText(text).then(() => {
    alert('Logs copied to clipboard!');
  }).catch(err => {
    originalError('Failed to copy logs', err);
  });
};
