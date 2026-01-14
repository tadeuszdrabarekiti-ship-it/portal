// logs.js

document.getElementById('loadLogs').addEventListener('click', async () => {
  const date = document.getElementById('logDate').value;
  if (!date) return alert('Wybierz datę!');
  const resp = await fetch(`/logs/raw?date=${date}`);
  if (!resp.ok) {
    document.querySelector('#logsTable tbody').innerHTML = `<tr><td colspan='2'>Brak logów lub błąd pobierania.</td></tr>`;
    return;
  }
  const text = await resp.text();
  const lines = text.split('\n').filter(Boolean);
  const tbody = document.querySelector('#logsTable tbody');
  tbody.innerHTML = '';
  lines.forEach((line, idx) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${idx + 1}</td><td style="font-family:monospace;white-space:pre-wrap;">${line}</td>`;
    tbody.appendChild(tr);
  });
});
