// app.js: screens, buttons and saving. Uses the scoring functions from logic.js.

const $ = id => document.getElementById(id);
const STORAGE_KEY = 'callbreak-score-v2';

// ---------- state ----------
let state = loadState() || {
  names: ['Player 1', 'Player 2', 'Player 3', 'Player 4'],
  totalRounds: 5,
  rounds: [],          // [{ bids:[..4], won:[..4] }]
  started: false,
};
let current = emptyRound();
let tab = 'bids';      // 'bids' or 'won'

function emptyRound() { return { bids: [null, null, null, null], won: [null, null, null, null], blind: [false, false, false, false] }; }
const isBlind = (r, i) => !!(r.blind && r.blind[i]);
function loadState() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch (e) { return null; } }
function saveState() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {} }
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

// ---------- setup screen ----------
function renderSetup() {
  $('nameInputs').innerHTML = state.names
    .map((n, i) => `<input type="text" maxlength="12" value="${esc(n)}" data-i="${i}" placeholder="Player ${i + 1}">`)
    .join('');
  $('roundOpts').innerHTML = [3, 5, 7, 10]
    .map(n => `<button class="btn ${state.totalRounds === n ? 'sel' : ''}" data-n="${n}">${n}</button>`)
    .join('');
}

function readNames() {
  document.querySelectorAll('#nameInputs input').forEach(inp => {
    const i = +inp.dataset.i;
    state.names[i] = inp.value.trim() || `Player ${i + 1}`;
  });
}

$('roundOpts').addEventListener('click', e => {
  const n = +e.target.dataset.n;
  if (!n) return;
  readNames();               // keep typed names when re-rendering
  state.totalRounds = n;
  renderSetup();
});

$('startBtn').addEventListener('click', () => {
  readNames();
  state.rounds = [];
  state.started = true;
  current = emptyRound();
  tab = 'bids';
  saveState();
  render();
});

// ---------- scoreboard ----------
function renderBoard() {
  const t = totals(state.rounds);
  const max = Math.max(...t);
  let h = '<table><tr><th>#</th>' + state.names.map(n => `<th class="name">${esc(n)}</th>`).join('') + '</tr>';

  if (!state.rounds.length) h += '<tr><td colspan="5" class="empty">No rounds yet</td></tr>';

  state.rounds.forEach((r, k) => {
    h += `<tr><td class="r">R${k + 1}</td>` + r.bids.map((b, i) => {
      const bl = isBlind(r, i);
      const p = roundScore(b, r.won[i], bl);
      return `<td class="${p < 0 ? 'neg' : ''}">${formatScore(p)}<small>${r.won[i]}/${b}${bl ? ' <span class="bl">B</span>' : ''}</small></td>`;
    }).join('') + '</tr>';
  });

  if (state.rounds.length) {
    h += '<tr class="total"><td class="r">Total</td>' +
      t.map(v => `<td class="${v === max ? 'lead' : v < 0 ? 'neg' : ''}">${formatScore(v)}</td>`).join('') + '</tr>';
  }
  $('board').innerHTML = h + '</table>';
}

// ---------- round entry ----------
function renderEntry() {
  const finished = state.rounds.length >= state.totalRounds;
  $('entry').classList.toggle('hidden', finished);
  $('done').classList.toggle('hidden', !finished);
  $('undoBtn').classList.toggle('hidden', !state.rounds.length);

  if (finished) {
    const w = winners(state.names, state.rounds);
    $('winName').textContent = `${w.names.join(' & ')}  ·  ${formatScore(w.score)}`;
    return;
  }

  $('roundTitle').textContent = `Round ${state.rounds.length + 1} of ${state.totalRounds}`;
  $('tBid').classList.toggle('on', tab === 'bids');
  $('tWon').classList.toggle('on', tab === 'won');

  const values = current[tab];
  const first = tab === 'bids' ? 1 : 0;
  let h = '';
  state.names.forEach((n, i) => {
    const bl = current.blind[i];
    let info = '';
    if (tab === 'bids') {
      info = `<button class="blindBtn ${bl ? 'on' : ''}" data-blind="${i}">${bl ? '✓ Blind' : 'Blind'}</button>`;
    } else {
      info = `${bl ? '<span class="bl">BLIND</span> ' : ''}bid <em>${current.bids[i]}</em>`;
      if (current.won[i] != null) {
        const p = roundScore(current.bids[i], current.won[i], bl);
        info += ` · <span class="${p >= 0 ? 'pos' : 'neg'}">${formatScore(p)}</span>`;
      }
    }
    h += `<div class="p"><div class="ph"><b>${esc(n)}</b><span>${info}</span></div><div class="chips">`;
    for (let v = first; v <= 13; v++) {
      const off = tab === 'bids' && bl && v < BLIND_MIN_BID;   // blind: 1-4 not allowed
      h += `<button class="${values[i] === v ? 'sel' : ''}" data-p="${i}" data-v="${v}"${off ? ' disabled' : ''}>${v}</button>`;
    }
    h += '</div></div>';
  });
  $('players').innerHTML = h;

  const status = $('status');
  const next = $('nextBtn');
  if (tab === 'bids') {
    const ready = current.bids.every(v => v != null);
    const sum = current.bids.reduce((a, v) => a + (v || 0), 0);
    status.className = 'status';
    status.textContent = ready ? `Total bids: ${sum}` : "Tap each player's bid";
    next.textContent = 'Next → Tricks won';
    next.disabled = !ready;
  } else {
    const ready = current.won.every(v => v != null);
    const sum = current.won.reduce((a, v) => a + (v || 0), 0);
    const errors = ready ? validateRound(current.bids, current.won, current.blind) : [];
    if (!ready) { status.className = 'status'; status.textContent = `Tricks entered: ${sum} / 13`; }
    else if (errors.length) { status.className = 'status warn'; status.textContent = errors[0]; }
    else { status.className = 'status ok'; status.textContent = '✓ 13 tricks'; }
    next.textContent = 'Save round';
    next.disabled = !ready || errors.length > 0;
  }
}

$('players').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  if (b.dataset.blind != null) {                         // Blind on/off
    const i = +b.dataset.blind;
    current.blind[i] = !current.blind[i];
    if (current.blind[i] && current.bids[i] != null && current.bids[i] < BLIND_MIN_BID) current.bids[i] = null;
    renderEntry();
    return;
  }
  const i = +b.dataset.p, v = +b.dataset.v;
  current[tab][i] = current[tab][i] === v ? null : v;   // tap again to clear
  if (tab === 'won') current.won = autoFillLast(current.won);
  renderEntry();
});

$('tBid').addEventListener('click', () => { tab = 'bids'; renderEntry(); });
$('tWon').addEventListener('click', () => {
  if (current.bids.every(v => v != null)) { tab = 'won'; renderEntry(); }
});

$('nextBtn').addEventListener('click', () => {
  if (tab === 'bids') {
    tab = 'won';
    renderEntry();
    window.scrollTo({ top: $('entry').offsetTop - 10, behavior: 'smooth' });
    return;
  }
  if (validateRound(current.bids, current.won, current.blind).length) return;
  state.rounds.push({ bids: [...current.bids], won: [...current.won], blind: [...current.blind] });
  current = emptyRound();
  tab = 'bids';
  saveState();
  render();
});

// ---------- undo / new game ----------
function undoLast() {
  const r = state.rounds.pop();
  if (!r) return;
  current = { bids: r.bids, won: r.won, blind: r.blind || [false, false, false, false] };   // put it back for editing
  tab = 'won';
  saveState();
  render();
}
$('undoBtn').addEventListener('click', undoLast);
$('undoBtn2').addEventListener('click', undoLast);

$('againBtn').addEventListener('click', () => {
  state.rounds = []; current = emptyRound(); tab = 'bids';
  saveState(); render();
});

$('newBtn').addEventListener('click', () => $('confirm').classList.remove('hidden'));
$('cNo').addEventListener('click', () => $('confirm').classList.add('hidden'));
$('cYes').addEventListener('click', () => {
  $('confirm').classList.add('hidden');
  state.started = false; state.rounds = []; current = emptyRound();
  saveState(); render();
});

// ---------- main render ----------
function render() {
  $('setup').classList.toggle('hidden', state.started);
  $('game').classList.toggle('hidden', !state.started);
  $('newBtn').classList.toggle('hidden', !state.started);
  if (!state.started) renderSetup();
  else { renderBoard(); renderEntry(); }
}

render();
