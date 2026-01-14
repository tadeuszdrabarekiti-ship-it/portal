// sync_cron_table.js
// Synchronizacja schedulerState z flows (tylko CRON)
const fs = require('fs');
const path = require('path');

function parseCronEntry(entry) {
  if (/^\d{2}:\d{2}:\d{2}$/.test(entry)) {
    const [h, m, s] = entry.split(":").map(Number);
    return { type: 'exact', h, m, s };
  }
  if (/^\*:(\d{2}):(\d{2})$/.test(entry)) {
    const [, m, s] = entry.split(":").map(Number);
    return { type: 'everyHourAt', m, s };
  }
  if (/^\*\d+$/.test(entry)) {
    const n = Number(entry.slice(1));
    return { type: 'everyNMinutes', n };
  }
  return null;
}
 
function getNextRun(cron, now) {
  function pad(n) { return n.toString().padStart(2, '0'); }
  function formatLocalDateTime(d) {
    return `${pad(d.getDate())}-${pad(d.getMonth()+1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
  let next;
  if (cron.type === 'exact') {
    next = new Date(now);
    next.setHours(cron.h, cron.m, cron.s, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
  } else if (cron.type === 'everyHourAt') {
    next = new Date(now);
    next.setMinutes(cron.m, cron.s, 0);
    if (next <= now) next.setHours(next.getHours() + 1);
  } else if (cron.type === 'everyNMinutes') {
    next = new Date(now);
    const min = now.getMinutes();
    const add = cron.n - (min % cron.n);
    next.setMinutes(min + add, 0, 0);
    if (next <= now) next.setMinutes(next.getMinutes() + cron.n);
  } else {
    return null;
  }
  return formatLocalDateTime(next);
}

function syncCronTable(flows, schedulerState) {
  // Mapy: klucz = flowName|cronEntry
  const flowCronMap = new Map();
  const stateCronMap = new Map();
  const now = new Date();

  // Zbuduj mapę z flows
  for (const flow of flows) {
    if (flow.type === 'CRON' && Array.isArray(flow.crontable)) {
      for (const cronEntry of flow.crontable) {
        flowCronMap.set(`${flow.name}|${cronEntry}`, {
          flowName: flow.name,
          cronEntry,
          flow,
          cronEntryDef: cronEntry
        });
      }
    }
  }

  // Zbuduj mapę z schedulerState
  for (const job of schedulerState) {
    stateCronMap.set(`${job.flowName}|${job.cronEntry}`, job);
  }

  const added = [];
  const removed = [];
  const updated = [];
  const unchanged = [];

  // Dodaj nowe zadania
  for (const [key, val] of flowCronMap.entries()) {
    if (!stateCronMap.has(key)) {
      // Nowe zadanie
      const cron = parseCronEntry(val.cronEntry);
      const nextRun = cron ? getNextRun(cron, now) : null;
      const job = {
        flowName: val.flowName,
        cronEntry: val.cronEntry,
        nextRun,
        traceId: null,
        running: false
      };
      schedulerState.push(job);
      added.push(job);
    } else {
      // Istniejące zadanie, sprawdź czy crontable się zmieniło
      const job = stateCronMap.get(key);
      const cron = parseCronEntry(val.cronEntry);
      const nextRun = cron ? getNextRun(cron, now) : null;
      // Możesz dodać tu dodatkowe warunki aktualizacji, np. zmiana definicji flow
      if (job.nextRun !== nextRun) {
        job.nextRun = nextRun;
        updated.push(job);
      } else {
        unchanged.push(job);
      }
    }
  }

  // Usuń zadania, których nie ma w flows
  for (const [key, job] of stateCronMap.entries()) {
    if (!flowCronMap.has(key)) {
      // Usunięte zadanie
      const idx = schedulerState.indexOf(job);
      if (idx !== -1) {
        schedulerState.splice(idx, 1);
        removed.push(job);
      }
    }
  }

  return { added, removed, updated, unchanged, schedulerState };
}

module.exports = { syncCronTable };
