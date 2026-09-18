import {createHash} from 'node:crypto';

// One bounded queue across rooms and summary types, so class-wide pre-generation
// cannot flood the AI service. Message classification has its own request path.
const concurrency = Math.max(1, Math.min(16, Number(process.env.AI_SUMMARY_CONCURRENCY) || 4));
const timeoutMs = Math.max(100, Number(process.env.AI_SUMMARY_TIMEOUT_MS) || 25000);
let active = 0;
const queue = [];
const jobs = new Map();
function pump() {
  while (active < concurrency && queue.length) {
    const {work, resolve, reject} = queue.shift();
    active++;
    Promise.resolve().then(work).then(resolve, reject).finally(() => { active--; pump(); });
  }
}
export function queueSummary(work) {
  return new Promise((resolve, reject) => { queue.push({work, resolve, reject}); pump(); });
}
export function summaryKey(scope, payload) {
  return createHash('sha256').update(JSON.stringify([scope, payload])).digest('hex');
}
export function startSummary(key, work, {force = false, retry = false} = {}) {
  const prior = jobs.get(key);
  // Force can retry a finished job, but must still join a running one.
  if (prior && (prior.status === 'pending' || (!force && !(retry && prior.status === 'error') && (prior.status !== 'error' || Date.now() - prior.finishedAt < 30000)))) return prior;
  const job = {status:'pending', value:null, promise:null};
  jobs.set(key, job);
  job.promise = queueSummary(work).then(value => {
    job.value = value;
    job.status = value == null ? 'empty' : 'ready';
  }).catch(error => {
    job.status = 'error';
    console.warn('[Summary] failed:', error?.message);
  }).finally(() => {
    job.finishedAt = Date.now();
    // Never evict an in-flight request (which would allow duplicate calls).
    if (jobs.size > 512) for (const [oldKey, old] of jobs) {
      if (jobs.size <= 512) break;
      if (old.status !== 'pending' && oldKey !== key) jobs.delete(oldKey);
    }
  });
  return job;
}
export async function fetchAIJson(url, payload) {
  const response = await fetch(url, {
    method:'POST',
    headers:{'Content-Type':'application/json', ...(process.env.AI_API_KEY ? {Authorization:`Bearer ${process.env.AI_API_KEY}`} : {})},
    body:JSON.stringify(payload), signal:AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`AI HTTP ${response.status}`);
  return response.json();
}
