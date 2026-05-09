const today = () => new Date().toISOString().split('T')[0];
const now = () => new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; }
  catch { return fallback; }
}
function save(key, data) { localStorage.setItem(key, JSON.stringify(data)); }

// ── Navigation ──
document.querySelectorAll('#sidebar li').forEach(li => {
  li.addEventListener('click', () => {
    document.querySelectorAll('#sidebar li').forEach(l => l.classList.remove('active'));
    document.querySelectorAll('.module').forEach(m => m.classList.remove('active'));
    li.classList.add('active');
    document.getElementById(li.dataset.module).classList.add('active');
  });
});

// ══════════════════════════════════════════
// FITNESS MODULE
// ══════════════════════════════════════════
let workouts = load('workouts', []);

document.getElementById('workout-form').addEventListener('submit', e => {
  e.preventDefault();
  const exercise = document.getElementById('exercise-select').value || document.getElementById('custom-exercise').value.trim();
  if (!exercise) return;
  const weight = parseFloat(document.getElementById('weight').value) || 0;
  const reps = parseInt(document.getElementById('reps').value) || 0;
  const sets = parseInt(document.getElementById('sets').value) || 1;
  const rpe = parseFloat(document.getElementById('rpe').value) || null;

  const entry = { id: Date.now(), date: today(), exercise, weight, reps, sets, rpe };
  workouts.push(entry);
  save('workouts', workouts);

  document.getElementById('exercise-select').value = '';
  document.getElementById('custom-exercise').value = '';
  document.getElementById('weight').value = '';
  document.getElementById('reps').value = '';
  document.getElementById('sets').value = '1';
  document.getElementById('rpe').value = '';

  renderTodayWorkout();
  updateCoach(exercise);
  updateProgressExercises();
});

function renderTodayWorkout() {
  const todayEntries = workouts.filter(w => w.date === today());
  const tbody = document.querySelector('#today-workout tbody');
  const empty = document.getElementById('today-empty');

  if (!todayEntries.length) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  tbody.innerHTML = todayEntries.map(w => `
    <tr>
      <td>${w.exercise}</td>
      <td>${w.weight} kg</td>
      <td>${w.reps}</td>
      <td>${w.sets}</td>
      <td>${w.rpe || '-'}</td>
      <td>${w.weight * w.reps * w.sets} kg</td>
      <td><button class="btn-sm danger" onclick="deleteWorkout(${w.id})">Del</button></td>
    </tr>
  `).join('');
}

function deleteWorkout(id) {
  workouts = workouts.filter(w => w.id !== id);
  save('workouts', workouts);
  renderTodayWorkout();
}

function updateCoach(exercise) {
  const history = workouts.filter(w => w.exercise === exercise).sort((a, b) => new Date(a.date) - new Date(b.date));
  const adviceEl = document.getElementById('coach-advice');

  if (history.length < 2) {
    adviceEl.innerHTML = `<div class="coach-box"><div class="coach-label">Coach</div><p>Keep logging <strong>${exercise}</strong> sessions. I'll give you progression advice once I have more data.</p></div>`;
    return;
  }

  const recent = history.slice(-5);
  const latest = recent[recent.length - 1];
  const maxWeight = Math.max(...history.map(h => h.weight));
  const maxVol = Math.max(...history.map(h => h.weight * h.reps * h.sets));
  const avgRpe = recent.reduce((s, h) => s + (h.rpe || 7), 0) / recent.length;

  let advice = [];

  if (avgRpe < 7 && latest.reps >= 8) {
    const bump = latest.weight < 40 ? 2.5 : 5;
    advice.push(`RPE is averaging ${avgRpe.toFixed(1)} — you have room to grow. <strong>Increase weight to ${latest.weight + bump} kg</strong> next session.`);
  } else if (avgRpe < 7) {
    advice.push(`RPE is low (${avgRpe.toFixed(1)}). Try adding <strong>1-2 more reps per set</strong> before increasing weight.`);
  } else if (avgRpe >= 9) {
    advice.push(`RPE is high (${avgRpe.toFixed(1)}). Consider a <strong>deload week</strong> — drop to ${Math.round(latest.weight * 0.85)} kg for recovery.`);
  } else {
    if (latest.reps < 6) {
      advice.push(`You're in strength range. Try to hit <strong>${latest.reps + 1} reps</strong> at ${latest.weight} kg before adding weight.`);
    } else {
      const bump = latest.weight < 40 ? 2.5 : 5;
      advice.push(`Good progress. Next session, try <strong>${latest.weight + bump} kg x ${Math.max(latest.reps - 2, 4)} reps</strong>.`);
    }
  }

  const currentVol = latest.weight * latest.reps * latest.sets;
  const volTrend = recent.length >= 3
    ? (recent[recent.length - 1].weight * recent[recent.length - 1].reps * recent[recent.length - 1].sets) -
      (recent[0].weight * recent[0].reps * recent[0].sets)
    : 0;

  if (volTrend > 0) {
    advice.push(`Volume trending UP (+${volTrend} kg total). Great trajectory.`);
  } else if (volTrend < 0) {
    advice.push(`Volume trending DOWN. Check recovery, sleep, and nutrition.`);
  }

  advice.push(`All-time best: <strong>${maxWeight} kg</strong>. Current volume: <strong>${currentVol} kg</strong>.`);

  adviceEl.innerHTML = advice.map(a => `<div class="coach-box"><div class="coach-label">Coach</div><p>${a}</p></div>`).join('');
}

function updateProgressExercises() {
  const exercises = [...new Set(workouts.map(w => w.exercise))];
  const sel = document.getElementById('progress-exercise-select');
  const current = sel.value;
  sel.innerHTML = '<option value="">Select exercise to view progress</option>' +
    exercises.map(e => `<option value="${e}" ${e === current ? 'selected' : ''}>${e}</option>`).join('');
}

let progressChart = null;
document.getElementById('progress-exercise-select').addEventListener('change', e => {
  const exercise = e.target.value;
  if (!exercise) return;

  const history = workouts.filter(w => w.exercise === exercise).sort((a, b) => new Date(a.date) - new Date(b.date));
  const grouped = {};
  history.forEach(h => {
    if (!grouped[h.date]) grouped[h.date] = [];
    grouped[h.date].push(h);
  });

  const labels = Object.keys(grouped);
  const maxWeights = labels.map(d => Math.max(...grouped[d].map(h => h.weight)));
  const volumes = labels.map(d => grouped[d].reduce((s, h) => s + h.weight * h.reps * h.sets, 0));

  if (progressChart) progressChart.destroy();
  progressChart = new Chart(document.getElementById('progress-chart'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Max Weight (kg)', data: maxWeights, borderColor: '#6c5ce7', backgroundColor: '#6c5ce722', tension: 0.3, yAxisID: 'y' },
        { label: 'Total Volume (kg)', data: volumes, borderColor: '#00cec9', backgroundColor: '#00cec922', tension: 0.3, yAxisID: 'y1' }
      ]
    },
    options: {
      responsive: true,
      scales: {
        y: { position: 'left', ticks: { color: '#8b91a8' }, grid: { color: '#2e3347' } },
        y1: { position: 'right', ticks: { color: '#8b91a8' }, grid: { display: false } },
        x: { ticks: { color: '#8b91a8' }, grid: { color: '#2e3347' } }
      },
      plugins: { legend: { labels: { color: '#e1e4ed' } } }
    }
  });
});

// ══════════════════════════════════════════
// NUTRITION MODULE
// ══════════════════════════════════════════
let meals = load('meals', []);
let targets = load('nutrition-targets', { cal: 2500, protein: 180, carbs: 250, fat: 80 });

document.getElementById('target-cal').value = targets.cal;
document.getElementById('target-protein').value = targets.protein;
document.getElementById('target-carbs').value = targets.carbs;
document.getElementById('target-fat').value = targets.fat;

function saveTargets() {
  targets = {
    cal: parseInt(document.getElementById('target-cal').value) || 2500,
    protein: parseInt(document.getElementById('target-protein').value) || 180,
    carbs: parseInt(document.getElementById('target-carbs').value) || 250,
    fat: parseInt(document.getElementById('target-fat').value) || 80
  };
  save('nutrition-targets', targets);
  renderMeals();
}

document.getElementById('meal-form').addEventListener('submit', e => {
  e.preventDefault();
  const name = document.getElementById('food-name').value.trim();
  if (!name) return;

  const meal = {
    id: Date.now(),
    date: today(),
    type: document.getElementById('meal-type').value,
    name,
    qty: parseFloat(document.getElementById('food-qty').value) || 0,
    cal: parseFloat(document.getElementById('food-cal').value) || 0,
    protein: parseFloat(document.getElementById('food-protein').value) || 0,
    carbs: parseFloat(document.getElementById('food-carbs').value) || 0,
    fat: parseFloat(document.getElementById('food-fat').value) || 0
  };
  meals.push(meal);
  save('meals', meals);

  document.getElementById('food-name').value = '';
  document.getElementById('food-qty').value = '';
  document.getElementById('food-cal').value = '';
  document.getElementById('food-protein').value = '';
  document.getElementById('food-carbs').value = '';
  document.getElementById('food-fat').value = '';

  renderMeals();
});

function renderMeals() {
  const todayMeals = meals.filter(m => m.date === today());
  const listEl = document.getElementById('meals-list');
  const empty = document.getElementById('meals-empty');

  const totals = todayMeals.reduce((s, m) => ({
    cal: s.cal + m.cal, protein: s.protein + m.protein, carbs: s.carbs + m.carbs, fat: s.fat + m.fat
  }), { cal: 0, protein: 0, carbs: 0, fat: 0 });

  document.getElementById('total-cal').textContent = Math.round(totals.cal);
  document.getElementById('total-protein').textContent = Math.round(totals.protein) + 'g';
  document.getElementById('total-carbs').textContent = Math.round(totals.carbs) + 'g';
  document.getElementById('total-fat').textContent = Math.round(totals.fat) + 'g';

  document.getElementById('bar-protein').style.width = Math.min(100, (totals.protein / targets.protein) * 100) + '%';
  document.getElementById('bar-carbs').style.width = Math.min(100, (totals.carbs / targets.carbs) * 100) + '%';
  document.getElementById('bar-fat').style.width = Math.min(100, (totals.fat / targets.fat) * 100) + '%';

  if (!todayMeals.length) {
    listEl.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  const groups = {};
  todayMeals.forEach(m => {
    if (!groups[m.type]) groups[m.type] = [];
    groups[m.type].push(m);
  });

  listEl.innerHTML = Object.entries(groups).map(([type, items]) => `
    <div class="meal-group">
      <h3>${type}</h3>
      ${items.map(m => `
        <div class="meal-item">
          <span>${m.name} ${m.qty ? `(${m.qty}g)` : ''}</span>
          <div class="meal-macros">
            <span>${m.cal} kcal</span>
            <span style="color:var(--protein)">P: ${m.protein}g</span>
            <span style="color:var(--carbs)">C: ${m.carbs}g</span>
            <span style="color:var(--fat)">F: ${m.fat}g</span>
            <button class="btn-sm danger" onclick="deleteMeal(${m.id})">x</button>
          </div>
        </div>
      `).join('')}
    </div>
  `).join('');
}

function deleteMeal(id) {
  meals = meals.filter(m => m.id !== id);
  save('meals', meals);
  renderMeals();
}

// ══════════════════════════════════════════
// REMINDERS MODULE
// ══════════════════════════════════════════
let reminders = load('reminders', []);

document.getElementById('reminder-form').addEventListener('submit', e => {
  e.preventDefault();
  const text = document.getElementById('reminder-text').value.trim();
  if (!text) return;

  reminders.push({
    id: Date.now(),
    text,
    time: document.getElementById('reminder-time').value,
    category: document.getElementById('reminder-category').value,
    recurring: document.getElementById('reminder-recurring').checked,
    done: false,
    date: today()
  });
  save('reminders', reminders);
  document.getElementById('reminder-text').value = '';
  document.getElementById('reminder-time').value = '';
  document.getElementById('reminder-recurring').checked = false;
  renderReminders();
});

function quickReminder(text, category) {
  reminders.push({
    id: Date.now(),
    text,
    time: '',
    category,
    recurring: true,
    done: false,
    date: today()
  });
  save('reminders', reminders);
  renderReminders();
}

function toggleReminder(id) {
  const r = reminders.find(r => r.id === id);
  if (r) r.done = !r.done;
  save('reminders', reminders);
  renderReminders();
}

function deleteReminder(id) {
  reminders = reminders.filter(r => r.id !== id);
  save('reminders', reminders);
  renderReminders();
}

function renderReminders() {
  const todayReminders = reminders.filter(r => r.date === today() || r.recurring);
  const listEl = document.getElementById('reminders-list');
  const empty = document.getElementById('reminders-empty');

  if (!todayReminders.length) {
    listEl.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  const sorted = [...todayReminders].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    if (a.time && b.time) return a.time.localeCompare(b.time);
    return a.time ? -1 : 1;
  });

  listEl.innerHTML = sorted.map(r => `
    <div class="reminder-item ${r.done ? 'done' : ''}">
      <div class="reminder-check" onclick="toggleReminder(${r.id})">${r.done ? '&#10003;' : ''}</div>
      <div class="reminder-body">
        <div class="reminder-title">${r.text}</div>
        <div class="reminder-meta">
          ${r.time ? `<span>${r.time}</span>` : ''}
          <span class="reminder-cat">${r.category}</span>
          ${r.recurring ? '<span>&#8635; Daily</span>' : ''}
        </div>
      </div>
      <button class="btn-sm danger" onclick="deleteReminder(${r.id})">Del</button>
    </div>
  `).join('');

  scheduleNotifications(todayReminders);
}

function scheduleNotifications(reminders) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') Notification.requestPermission();

  reminders.filter(r => r.time && !r.done).forEach(r => {
    const [h, m] = r.time.split(':').map(Number);
    const target = new Date();
    target.setHours(h, m, 0, 0);
    const delay = target - new Date();
    if (delay > 0 && delay < 86400000) {
      setTimeout(() => {
        if (Notification.permission === 'granted') {
          new Notification('Reminder', { body: r.text, icon: '&#9200;' });
        }
      }, delay);
    }
  });
}

// ══════════════════════════════════════════
// CRM MODULE
// ══════════════════════════════════════════
let prospects = load('prospects', []);
let interactions = load('interactions', []);

document.getElementById('prospect-form').addEventListener('submit', e => {
  e.preventDefault();
  const name = document.getElementById('prospect-name').value.trim();
  if (!name) return;

  prospects.push({
    id: Date.now(),
    name,
    company: document.getElementById('prospect-company').value.trim(),
    country: document.getElementById('prospect-country').value.trim(),
    email: document.getElementById('prospect-email').value.trim(),
    phone: document.getElementById('prospect-phone').value.trim(),
    stage: document.getElementById('prospect-stage').value,
    aum: document.getElementById('prospect-aum').value.trim(),
    source: document.getElementById('prospect-source').value.trim(),
    notes: document.getElementById('prospect-notes').value.trim(),
    createdAt: today(),
    lastContact: today()
  });
  save('prospects', prospects);

  document.getElementById('prospect-form').reset();
  renderProspects();
  renderPipeline();
});

function renderProspects() {
  const search = document.getElementById('crm-search').value.toLowerCase();
  const filter = document.getElementById('crm-filter').value;
  let filtered = prospects;

  if (search) filtered = filtered.filter(p =>
    p.name.toLowerCase().includes(search) ||
    p.company.toLowerCase().includes(search) ||
    p.country.toLowerCase().includes(search)
  );
  if (filter) filtered = filtered.filter(p => p.stage === filter);

  const tbody = document.querySelector('#prospects-table tbody');
  const empty = document.getElementById('crm-empty');

  if (!filtered.length) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  tbody.innerHTML = filtered.map(p => {
    const stageClass = p.stage.split(' ')[0];
    return `
      <tr onclick="openProspect(${p.id})" style="cursor:pointer">
        <td><strong>${p.name}</strong></td>
        <td>${p.company}</td>
        <td>${p.country}</td>
        <td><span class="stage-badge stage-${stageClass}">${p.stage}</span></td>
        <td>${p.aum ? '$' + p.aum : '-'}</td>
        <td>${p.lastContact}</td>
        <td><button class="btn-sm danger" onclick="event.stopPropagation(); deleteProspect(${p.id})">Del</button></td>
      </tr>
    `;
  }).join('');
}

function deleteProspect(id) {
  prospects = prospects.filter(p => p.id !== id);
  interactions = interactions.filter(i => i.prospectId !== id);
  save('prospects', prospects);
  save('interactions', interactions);
  renderProspects();
  renderPipeline();
}

function openProspect(id) {
  const p = prospects.find(p => p.id === id);
  if (!p) return;
  const pInteractions = interactions.filter(i => i.prospectId === id).sort((a, b) => new Date(b.date) - new Date(a.date));

  document.getElementById('prospect-detail').innerHTML = `
    <h2>${p.name}</h2>
    <p style="color:var(--text2); margin-bottom:16px">${p.company} ${p.country ? '| ' + p.country : ''}</p>
    <div class="grid-2" style="margin-bottom:16px">
      <div>
        <p><strong>Email:</strong> ${p.email || '-'}</p>
        <p><strong>Phone:</strong> ${p.phone || '-'}</p>
        <p><strong>Source:</strong> ${p.source || '-'}</p>
      </div>
      <div>
        <p><strong>Stage:</strong>
          <select onchange="updateStage(${p.id}, this.value)">
            ${['Lead','Contacted','Meeting Scheduled','Proposal Sent','Negotiation','Won','Lost']
              .map(s => `<option ${s === p.stage ? 'selected' : ''} value="${s}">${s}</option>`).join('')}
          </select>
        </p>
        <p><strong>Est. AUM:</strong> ${p.aum ? '$' + p.aum : '-'}</p>
      </div>
    </div>
    ${p.notes ? `<div class="card-sub"><h3>Notes</h3><p style="font-size:14px;color:var(--text2)">${p.notes}</p></div>` : ''}
    <div class="card-sub">
      <h3>Interactions</h3>
      <form onsubmit="addInteraction(event, ${p.id})" style="margin-bottom:12px">
        <div class="row-inputs">
          <select id="int-type-${p.id}">
            <option value="Call">Call</option>
            <option value="Email">Email</option>
            <option value="Meeting">Meeting</option>
            <option value="WhatsApp">WhatsApp</option>
            <option value="Note">Note</option>
          </select>
          <input type="text" id="int-note-${p.id}" placeholder="Note..." style="flex:2">
          <button type="submit" class="btn-secondary">Add</button>
        </div>
      </form>
      ${pInteractions.length ? pInteractions.map(i => `
        <div class="interaction-item">
          <div class="int-date">${i.date} | ${i.type}</div>
          <div>${i.note}</div>
        </div>
      `).join('') : '<p class="empty-state">No interactions yet.</p>'}
    </div>
  `;
  document.getElementById('prospect-modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('prospect-modal').classList.add('hidden');
}

function updateStage(id, stage) {
  const p = prospects.find(p => p.id === id);
  if (p) {
    p.stage = stage;
    p.lastContact = today();
    save('prospects', prospects);
    renderProspects();
    renderPipeline();
  }
}

function addInteraction(e, prospectId) {
  e.preventDefault();
  const type = document.getElementById(`int-type-${prospectId}`).value;
  const note = document.getElementById(`int-note-${prospectId}`).value.trim();
  if (!note) return;

  interactions.push({ id: Date.now(), prospectId, type, note, date: today() });
  save('interactions', interactions);

  const p = prospects.find(p => p.id === prospectId);
  if (p) { p.lastContact = today(); save('prospects', prospects); }

  openProspect(prospectId);
  renderProspects();
}

let pipelineChart = null;
function renderPipeline() {
  const stages = ['Lead', 'Contacted', 'Meeting Scheduled', 'Proposal Sent', 'Negotiation', 'Won', 'Lost'];
  const counts = stages.map(s => prospects.filter(p => p.stage === s).length);
  const active = prospects.filter(p => !['Won', 'Lost'].includes(p.stage)).length;
  const won = prospects.filter(p => p.stage === 'Won').length;

  document.getElementById('pipeline-stats').innerHTML = `
    <div class="stat-box"><div class="stat-num" style="color:var(--accent2)">${prospects.length}</div><div class="stat-label">Total</div></div>
    <div class="stat-box"><div class="stat-num" style="color:var(--blue)">${active}</div><div class="stat-label">Active</div></div>
    <div class="stat-box"><div class="stat-num" style="color:var(--green)">${won}</div><div class="stat-label">Won</div></div>
  `;

  if (pipelineChart) pipelineChart.destroy();
  pipelineChart = new Chart(document.getElementById('pipeline-chart'), {
    type: 'bar',
    data: {
      labels: stages,
      datasets: [{
        data: counts,
        backgroundColor: ['#636e72', '#0984e3', '#6c5ce7', '#fdcb6e', '#e17055', '#00b894', '#b2bec3']
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { color: '#8b91a8', stepSize: 1 }, grid: { color: '#2e3347' } },
        x: { ticks: { color: '#8b91a8', font: { size: 11 } }, grid: { display: false } }
      }
    }
  });
}

// ══════════════════════════════════════════
// MARKET INTEL MODULE
// ══════════════════════════════════════════
let newsItems = load('news-items', []);
let quickLinks = load('quick-links', []);

document.getElementById('news-form').addEventListener('submit', e => {
  e.preventDefault();
  const title = document.getElementById('news-title').value.trim();
  if (!title) return;

  newsItems.push({
    id: Date.now(),
    date: today(),
    category: document.getElementById('news-category').value,
    title,
    body: document.getElementById('news-body').value.trim(),
    tags: document.getElementById('news-tags').value.split(',').map(t => t.trim()).filter(Boolean)
  });
  save('news-items', newsItems);
  document.getElementById('news-form').reset();
  renderNews();
});

document.getElementById('link-form').addEventListener('submit', e => {
  e.preventDefault();
  const name = document.getElementById('link-name').value.trim();
  const url = document.getElementById('link-url').value.trim();
  if (!name || !url) return;
  quickLinks.push({ name, url });
  save('quick-links', quickLinks);
  document.getElementById('link-name').value = '';
  document.getElementById('link-url').value = '';
  renderQuickLinks();
});

function renderQuickLinks() {
  const container = document.getElementById('quick-links');
  const defaults = container.querySelectorAll('a[href]');
  const custom = quickLinks.map(l => `<a href="${l.url}" target="_blank" class="link-card">${l.name}</a>`).join('');
  let html = '';
  defaults.forEach(a => { html += a.outerHTML; });
  html += custom;
  container.innerHTML = html;
}

function renderNews() {
  const filter = document.getElementById('news-filter').value;
  let filtered = newsItems;
  if (filter) filtered = filtered.filter(n => n.category === filter);
  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

  const feedEl = document.getElementById('news-feed');
  const empty = document.getElementById('news-empty');

  if (!filtered.length) {
    feedEl.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  const catClass = {
    'Eastern Europe': 'cat-eastern', 'Global Markets': 'cat-global',
    'Founders & Deals': 'cat-founders', 'Regulatory': 'cat-regulatory', 'Competitor': 'cat-competitor'
  };

  feedEl.innerHTML = filtered.map(n => `
    <div class="news-item">
      <div class="news-header">
        <div>
          <span class="news-cat ${catClass[n.category] || ''}">${n.category}</span>
          <span class="news-title" style="margin-left:8px">${n.title}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="news-date">${n.date}</span>
          <button class="btn-sm danger" onclick="deleteNews(${n.id})">x</button>
        </div>
      </div>
      ${n.body ? `<div class="news-body">${n.body}</div>` : ''}
      ${n.tags.length ? `<div class="news-tags">${n.tags.map(t => `<span class="news-tag">${t}</span>`).join('')}</div>` : ''}
    </div>
  `).join('');
}

function deleteNews(id) {
  newsItems = newsItems.filter(n => n.id !== id);
  save('news-items', newsItems);
  renderNews();
}

// ══════════════════════════════════════════
// INIT
// ══════════════════════════════════════════
renderTodayWorkout();
updateProgressExercises();
renderMeals();
renderReminders();
renderProspects();
renderPipeline();
renderNews();
renderQuickLinks();

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});
