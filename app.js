// =============================================
// Bibla Apps — app.js
// =============================================

import { initializeApp }              from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore, doc, getDoc, getDocs, setDoc, onSnapshot, collection }
                                       from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ---- Firebase setup ----

const firebaseConfig = {
  apiKey:            "AIzaSyCep3erAzfctu24i8QDzC51yz5eZQ3XkvI",
  authDomain:        "bibla-balance-app.firebaseapp.com",
  projectId:         "bibla-balance-app",
  storageBucket:     "bibla-balance-app.firebasestorage.app",
  messagingSenderId: "833335006706",
  appId:             "1:833335006706:web:41ca8423aafce8579f876b"
};

const firebaseApp = initializeApp(firebaseConfig);
const db          = getFirestore(firebaseApp);

// ---- Login ----

async function sha256(text) {
  var buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buffer)).map(function (b) {
    return b.toString(16).padStart(2, '0');
  }).join('');
}

async function handleLogin() {
  var username = document.getElementById('login-username').value.trim().toLowerCase();
  var password = document.getElementById('login-password').value.trim();

  if (!username && !password) {
    showLoginError('Please enter your username and PIN to sign in.');
    return;
  }

  if (!username) {
    showLoginError('Username is required. Please enter your username.');
    return;
  }

  if (!password) {
    showLoginError('PIN is required. Please enter your 6-digit PIN.');
    return;
  }

  if (!/^\d{6}$/.test(password)) {
    showLoginError('Your PIN must be exactly 6 numbers (e.g. 123456). Letters and symbols are not allowed.');
    return;
  }

  var usernameHash = await sha256(username);
  var passwordHash = await sha256(password);

  var match;
  try {
    var userSnap = await getDoc(doc(db, 'users', usernameHash));
    if (userSnap.exists() && userSnap.data().passwordHash === passwordHash) {
      match = userSnap.data();
    }
  } catch (e) {
    showLoginError('Could not connect to the server. Please check your internet connection and try again.');
    return;
  }

  if (!match) {
    showLoginError('Incorrect username or PIN. Please double-check your details and try again.');
    return;
  }

  sessionStorage.setItem('loggedInUser', usernameHash);
  sessionStorage.setItem('canAdd', match.canAdd ? 'true' : 'false');
  sessionStorage.setItem('alias', match.alias || '');
  window.location.href = 'home.html';
}

function showLoginError(msg) {
  var el = document.getElementById('login-error');
  el.textContent = msg;
  el.classList.add('visible');
}

function logout() {
  sessionStorage.clear();
  window.location.href = 'index.html';
}

// ---- Data model ----

var transactions = [];
var nextId       = 1;
var currentAction = null;

// ---- Firestore persistence ----

async function saveData() {
  await setDoc(doc(db, 'appData', 'transactions'), { list: transactions });
}

function showBalanceLoading(visible) {
  var el = document.getElementById('balance-loading');
  var list = document.getElementById('transaction-list');
  if (el) el.style.display = visible ? 'block' : 'none';
  if (list) list.style.display = visible ? 'none' : '';
}

function startLiveSync() {
  onSnapshot(doc(db, 'appData', 'transactions'), function (snap) {
    if (snap.exists() && snap.data().list) {
      transactions = snap.data().list;
      nextId = transactions.reduce(function (max, t) { return Math.max(max, t.id + 1); }, 1);
      showBalanceLoading(false);
      renderAll();
    }
  });
}


// ---- Rendering ----

function formatMoney(amount) {
  return '$' + Math.abs(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function getBalance() {
  return transactions.reduce(function (sum, t) { return sum + t.amount; }, 0);
}

function renderAll(highlightId) {
  var balance = getBalance();
  document.getElementById('balance-display').textContent =
    (balance < 0 ? '-' : '') + '$' + Math.abs(balance).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  var list = document.getElementById('transaction-list');
  list.innerHTML = '';
  list.classList.toggle('scrollable', transactions.length > 10);

  transactions.forEach(function (t) {
    var li        = document.createElement('li');
    li.className  = 'transaction' + (t.id === highlightId ? ' new-transaction' : '');
    li.dataset.id = t.id;

    var isAdd      = t.amount > 0;
    var wasEdited  = t.comment !== t.originalComment;
    var editedBadge = wasEdited ? '<span class="edited-badge">edited</span>' : '';

    li.innerHTML =
      '<span class="transaction-date">'   + t.date + '</span>' +
      '<span class="transaction-comment" onclick="editComment(this)">' +
        t.comment + '<span class="edit-icon">✏️</span>' + editedBadge +
      '</span>' +
      '<span class="transaction-amount ' + (isAdd ? 'positive' : 'negative') + '">' +
        (isAdd ? '+' : '-') + formatMoney(t.amount) +
      '</span>';

    var badge = li.querySelector('.edited-badge');
    if (badge) {
      badge.onclick = function (e) {
        e.stopPropagation();
        showOriginal(badge, t.originalComment);
      };
    }

    list.appendChild(li);

    if (t.id === highlightId) {
      setTimeout(function () { li.classList.remove('new-transaction'); }, 1000);
    }
  });
}

// ---- Balance form ----

function openForm(action) {
  currentAction = action;
  document.getElementById('form-title').textContent = action === 'add' ? 'Add Funds' : 'Withdraw Funds';
  document.getElementById('form-confirm-btn').className = 'form-confirm ' + (action === 'add' ? 'confirm-add' : 'confirm-withdraw');
  document.getElementById('form-amount').value  = '';
  document.getElementById('form-comment').value = '';
  document.getElementById('modal-overlay').classList.add('open');
  setTimeout(function () { document.getElementById('form-amount').focus(); }, 50);
}

function closeForm() {
  document.getElementById('modal-overlay').classList.remove('open');
  currentAction = null;
}

function handleOverlayClick(event) {
  if (event.target === document.getElementById('modal-overlay')) closeForm();
}

async function confirmTransaction() {
  var amount  = parseFloat(document.getElementById('form-amount').value);
  var comment = document.getElementById('form-comment').value.trim();

  if (!amount || amount <= 0) { alert('Please enter a valid amount.'); return; }
  if (!comment) { alert('Please add a comment.'); return; }
  if (currentAction === 'withdraw' && amount > getBalance()) {
    alert('Not enough funds in your balance.');
    return;
  }

  var today    = new Date();
  var dateStr  = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  var finalAmt = currentAction === 'add' ? amount : -amount;
  var t        = { id: nextId++, date: dateStr, amount: finalAmt, comment: comment, originalComment: comment };

  transactions.unshift(t);
  await saveData();
  renderAll(t.id);
  closeForm();
}

// ---- Editable transaction comments ----

function editComment(span) {
  if (span.querySelector('input')) return;

  var li   = span.closest('li');
  var id   = parseInt(li.dataset.id);
  var t    = transactions.find(function (x) { return x.id === id; });
  if (!t) return;

  var currentText = t.comment;
  span.innerHTML  = '';
  span.onclick    = null;

  var input       = document.createElement('input');
  input.type      = 'text';
  input.value     = currentText;
  input.className = 'comment-input';
  span.appendChild(input);
  input.focus();
  input.select();

  async function saveComment() {
    var newText = input.value.trim() || currentText;
    t.comment   = newText;
    await saveData();
    renderAll();

    var newLi = document.querySelector('li[data-id="' + id + '"]');
    if (newLi) {
      var badge = newLi.querySelector('.edited-badge');
      if (badge) {
        badge.onclick = function (e) {
          e.stopPropagation();
          showOriginal(badge, t.originalComment);
        };
      }
    }
  }

  input.addEventListener('blur', saveComment);
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') { input.value = currentText; input.blur(); }
  });
}

function showOriginal(badge, originalText) {
  var existing = badge.querySelector('.original-tooltip');
  if (existing) { existing.remove(); return; }

  var tip       = document.createElement('span');
  tip.className = 'original-tooltip';
  tip.textContent = 'Original: ' + originalText;
  badge.appendChild(tip);

  setTimeout(function () {
    document.addEventListener('click', function handler() {
      tip.remove();
      document.removeEventListener('click', handler);
    });
  }, 0);
}

// ---- Background prefetch (runs on home page) ----

async function prefetchTransactions() {
  try {
    var snap = await getDoc(doc(db, 'appData', 'transactions'));
    if (snap.exists() && snap.data().list) {
      sessionStorage.setItem('prefetched_transactions', JSON.stringify(snap.data().list));
    }
  } catch (e) {}
}

function openApp(event, url) {
  if (sessionStorage.getItem('prefetched_transactions')) {
    return; // data ready — let the link navigate normally
  }
  event.preventDefault();
  var tile = document.getElementById('balance-tile');
  tile.classList.add('tile-loading');

  var waited = 0;
  var interval = setInterval(function () {
    waited += 100;
    if (sessionStorage.getItem('prefetched_transactions') || waited >= 5000) {
      clearInterval(interval);
      window.location.href = url;
    }
  }, 100);
}

// ---- Version ----

async function loadVersion() {
  try {
    var res = await fetch('version.txt');
    var version = (await res.text()).trim();
    var el = document.getElementById('app-version');
    if (el) el.textContent = version;
  } catch (e) {}
}

// ---- Chores ----

var choresData        = { list: [] };
var sharedCategories  = ['Cleaning', 'Kitchen', 'Laundry', 'Errands', 'Pets'];
var editingChoreId    = null;
var currentChoreUser  = null; // { hash, alias } of the user whose chores are shown
var choresUnsubscribe = null;

function choresDocRef() {
  return doc(db, 'choresData', currentChoreUser.hash);
}

async function saveChores() {
  await setDoc(choresDocRef(), choresData);
}

async function saveCategories() {
  await setDoc(doc(db, 'choresData', 'config'), { categories: sharedCategories });
}

async function loadCategories() {
  var snap = await getDoc(doc(db, 'choresData', 'config'));
  if (snap.exists() && snap.data().categories) {
    sharedCategories = snap.data().categories;
  }
}

function formatDate(dateStr) {
  var d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateTime(dateStr) {
  var d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function nowISO() {
  return new Date().toISOString();
}

function addDays(dateStr, days) {
  var d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function renderChores() {
  var container = document.getElementById('chores-container');
  if (!container) return;

  renderStreak();

  var isAdmin = sessionStorage.getItem('canAdd') === 'true';
  var toolbar = document.getElementById('chores-toolbar');
  if (toolbar) toolbar.style.display = isAdmin ? 'flex' : 'none';

  if (choresData.list.length === 0) {
    container.innerHTML = '<p class="chores-loading">No chores yet' + (isAdmin ? ' — use &quot;+ Add Chore&quot; to get started.' : '.') + '</p>';
    return;
  }

  var grouped = {};
  sharedCategories.forEach(function (cat) { grouped[cat] = []; });
  choresData.list.forEach(function (c) {
    if (!grouped[c.category]) grouped[c.category] = [];
    grouped[c.category].push(c);
  });

  container.innerHTML = '';
  Object.keys(grouped).forEach(function (cat) {
    var chores = grouped[cat];
    if (chores.length === 0) return;

    var section = document.createElement('div');
    section.className = 'chore-category-section';

    var heading = document.createElement('p');
    heading.className = 'chore-category-heading';
    heading.textContent = cat;
    section.appendChild(heading);

    var ul = document.createElement('ul');
    ul.className = 'chore-list';

    chores.forEach(function (chore) {
      var isDone = chore.status === 'done';
      var li = document.createElement('li');
      li.className = 'chore-item' + (isDone ? ' done' : '');

      var checkbox = document.createElement('div');
      checkbox.className = 'chore-checkbox' + (isDone ? ' checked' : '');
      checkbox.innerHTML = isDone ? '✓' : '';
      checkbox.onclick = function () { toggleChore(chore.id); };

      var body = document.createElement('div');
      body.className = 'chore-body';

      var nameEl = document.createElement('div');
      nameEl.className = 'chore-name';
      nameEl.textContent = chore.name;
      if (chore.timeOfDay) {
        var todIcons = { morning: '🌅', afternoon: '☀️', evening: '🌙' };
        var tag = document.createElement('span');
        tag.className = 'tod-tag tod-' + chore.timeOfDay;
        tag.textContent = todIcons[chore.timeOfDay] + ' ' + chore.timeOfDay.charAt(0).toUpperCase() + chore.timeOfDay.slice(1);
        nameEl.appendChild(tag);
      }

      var metaEl = document.createElement('div');
      metaEl.className = 'chore-meta';
      var hasRecurring = Array.isArray(chore.recurringDays) && chore.recurringDays.length > 0;
      if (isDone) {
        var metaParts = [];
        if (chore.doneBy) metaParts.push('Done by ' + chore.doneBy + ' · ' + formatDateTime(chore.doneAt));
        if (hasRecurring && chore.nextOccurrence) {
          metaParts.push('Next: ' + formatDate(chore.nextOccurrence));
        }
        metaEl.textContent = metaParts.join(' · ');
      } else if (hasRecurring) {
        metaEl.textContent = 'Repeats ' + chore.recurringDays.sort(function(a,b){return a-b;}).map(function(d){ return DAY_NAMES[d]; }).join(', ');
      }

      body.appendChild(nameEl);
      body.appendChild(metaEl);

      var actions = document.createElement('div');
      actions.className = 'chore-actions';

      if (isDone) {
        var undoBtn = document.createElement('button');
        undoBtn.className = 'chore-icon-btn undo';
        undoBtn.title = 'Undo';
        undoBtn.textContent = '↩';
        undoBtn.onclick = function () { undoChore(chore.id); };
        actions.appendChild(undoBtn);
      }

      var histBtn = document.createElement('button');
      histBtn.className = 'chore-icon-btn';
      histBtn.title = 'History';
      histBtn.textContent = '📋';
      histBtn.onclick = function () { showChoreHistory(chore); };
      actions.appendChild(histBtn);

      if (isAdmin) {
        var editBtn = document.createElement('button');
        editBtn.className = 'chore-icon-btn';
        editBtn.title = 'Edit';
        editBtn.textContent = '✏️';
        editBtn.onclick = function () { openChoreForm(chore.id); };
        actions.appendChild(editBtn);

        var delBtn = document.createElement('button');
        delBtn.className = 'chore-icon-btn delete';
        delBtn.title = 'Delete';
        delBtn.textContent = '🗑';
        delBtn.onclick = function () { deleteChore(chore.id); };
        actions.appendChild(delBtn);
      }

      li.appendChild(checkbox);
      li.appendChild(body);
      li.appendChild(actions);
      ul.appendChild(li);
    });

    section.appendChild(ul);
    container.appendChild(section);
  });
}

async function awardStreakBonus() {
  try {
    var snap = await getDoc(doc(db, 'appData', 'transactions'));
    var list = (snap.exists() && snap.data().list) ? snap.data().list : [];
    var maxId = list.reduce(function (m, t) { return Math.max(m, t.id); }, 0);
    var today = new Date();
    var dateStr = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    list.unshift({
      id: maxId + 1,
      date: dateStr,
      amount: 2,
      comment: '🎉 7-day chore streak bonus',
      originalComment: '🎉 7-day chore streak bonus'
    });
    await setDoc(doc(db, 'appData', 'transactions'), { list: list });
    showStreakToast();
  } catch (e) {}
}

function showStreakToast() {
  var existing = document.getElementById('streak-toast');
  if (existing) existing.remove();

  var toast = document.createElement('div');
  toast.id = 'streak-toast';
  toast.className = 'streak-toast';
  toast.innerHTML = '🎉 7-day streak! <strong>+$2 bonus</strong> added to balance!';
  document.body.appendChild(toast);

  setTimeout(function () { toast.classList.add('visible'); }, 10);
  setTimeout(function () {
    toast.classList.remove('visible');
    setTimeout(function () { toast.remove(); }, 400);
  }, 4000);
}

function updateStreak(today) {
  if (!choresData.streak) choresData.streak = { count: 0, completedDates: [], bonusesAwarded: 0 };
  var s = choresData.streak;
  if (!s.bonusesAwarded) s.bonusesAwarded = 0;

  var isNewDay = !s.completedDates.includes(today);

  if (isNewDay) {
    s.completedDates.push(today);
    s.completedDates = s.completedDates.slice(-60);
  }

  // recalculate streak count
  var count = 0;
  var d = new Date(today);
  while (true) {
    var iso = d.toISOString().split('T')[0];
    if (s.completedDates.includes(iso)) { count++; d.setDate(d.getDate() - 1); }
    else break;
  }
  s.count = count;

  // award $2 bonus for every new 7-day milestone
  var milestones = Math.floor(count / 7);
  if (milestones > s.bonusesAwarded) {
    s.bonusesAwarded = milestones;
    awardStreakBonus();
  }
}

function renderStreak() {
  var banner = document.getElementById('streak-banner');
  var label  = document.getElementById('streak-label');
  var dots   = document.getElementById('streak-dots');
  if (!banner) return;

  var s = (choresData.streak) || { count: 0, completedDates: [] };
  banner.style.display = 'flex';

  var count = s.count || 0;
  label.textContent = count === 1 ? '1-day streak!' : count + '-day streak' + (count > 1 ? '!' : '');

  // Build last 7 day dots
  dots.innerHTML = '';
  for (var i = 6; i >= 0; i--) {
    var d = new Date();
    d.setDate(d.getDate() - i);
    var iso = d.toISOString().split('T')[0];
    var dayName = DAY_NAMES[d.getDay()];
    var filled = s.completedDates && s.completedDates.includes(iso);

    var wrap = document.createElement('div');
    wrap.className = 'streak-dot-wrap';

    var dot = document.createElement('div');
    dot.className = 'streak-dot' + (filled ? ' filled' : '');
    dot.innerHTML = filled ? '✓' : '';

    var lbl = document.createElement('span');
    lbl.className = 'streak-dot-label';
    lbl.textContent = dayName;

    wrap.appendChild(dot);
    wrap.appendChild(lbl);
    dots.appendChild(wrap);
  }
}

async function toggleChore(id) {
  var chore = choresData.list.find(function (c) { return c.id === id; });
  if (!chore || chore.status === 'done') return;

  var alias = sessionStorage.getItem('alias') || 'Someone';
  var today = todayISO();
  chore.status = 'done';
  chore.doneBy = alias;
  chore.doneAt = nowISO();
  if (Array.isArray(chore.recurringDays) && chore.recurringDays.length > 0) {
    chore.nextOccurrence = nextOccurrenceFromDays(chore.recurringDays);
  }
  if (!chore.history) chore.history = [];
  chore.history.unshift({ doneBy: alias, doneAt: nowISO() });
  updateStreak(today);
  await saveChores();
}

async function undoChore(id) {
  var chore = choresData.list.find(function (c) { return c.id === id; });
  if (!chore) return;
  chore.status = 'pending';
  chore.doneBy = null;
  chore.doneAt = null;
  chore.nextOccurrence = null;
  if (chore.history && chore.history.length > 0) chore.history.shift();
  await saveChores();
}

async function deleteChore(id) {
  if (!confirm('Delete this chore?')) return;
  choresData.list = choresData.list.filter(function (c) { return c.id !== id; });
  await saveChores();
}

function openChoreForm(id) {
  editingChoreId = id || null;
  var modal = document.getElementById('chore-modal');
  var titleEl = document.getElementById('chore-modal-title');
  var nameEl = document.getElementById('chore-name');
  var catEl = document.getElementById('chore-category');
  var recurCheck = document.getElementById('chore-recurring-check');
  var picker = document.getElementById('day-picker');

  catEl.innerHTML = '';
  sharedCategories.forEach(function (cat) {
    var opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    catEl.appendChild(opt);
  });

  // Wire up time-of-day buttons (single select, click again to deselect)
  document.querySelectorAll('.tod-btn').forEach(function (btn) {
    btn.classList.remove('selected');
    btn.onclick = function () {
      var isSelected = btn.classList.contains('selected');
      document.querySelectorAll('.tod-btn').forEach(function (b) { b.classList.remove('selected'); });
      if (!isSelected) btn.classList.add('selected');
    };
  });

  // Wire up day buttons
  picker.querySelectorAll('.day-btn').forEach(function (btn) {
    btn.classList.remove('selected');
    btn.onclick = function () { btn.classList.toggle('selected'); };
  });

  if (id) {
    var chore = choresData.list.find(function (c) { return c.id === id; });
    titleEl.textContent = 'Edit Chore';
    nameEl.value = chore.name;
    catEl.value = chore.category;
    var hasRecurring = Array.isArray(chore.recurringDays) && chore.recurringDays.length > 0;
    recurCheck.checked = hasRecurring;
    picker.style.display = hasRecurring ? 'flex' : 'none';
    if (hasRecurring) {
      picker.querySelectorAll('.day-btn').forEach(function (btn) {
        if (chore.recurringDays.includes(parseInt(btn.dataset.day))) btn.classList.add('selected');
      });
    }
    document.querySelectorAll('.tod-btn').forEach(function (btn) {
      btn.classList.toggle('selected', btn.dataset.tod === (chore.timeOfDay || ''));
    });
  } else {
    titleEl.textContent = 'Add Chore';
    nameEl.value = '';
    catEl.selectedIndex = 0;
    recurCheck.checked = false;
    picker.style.display = 'none';
  }

  modal.classList.add('open');
  setTimeout(function () { nameEl.focus(); }, 50);
}

function closeChoreForm() {
  document.getElementById('chore-modal').classList.remove('open');
  editingChoreId = null;
}

function handleChoreOverlayClick(event) {
  if (event.target === document.getElementById('chore-modal')) closeChoreForm();
}

var DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toggleRecurring() {
  var check = document.getElementById('chore-recurring-check');
  var picker = document.getElementById('day-picker');
  if (picker) picker.style.display = check.checked ? 'flex' : 'none';
  if (!check.checked) {
    picker.querySelectorAll('.day-btn').forEach(function (btn) {
      btn.classList.remove('selected');
    });
  }
}

function getSelectedDays() {
  var selected = [];
  document.querySelectorAll('.day-btn.selected').forEach(function (btn) {
    selected.push(parseInt(btn.dataset.day));
  });
  return selected;
}

function nextOccurrenceFromDays(days) {
  var today = new Date();
  var todayDay = today.getDay();
  var sorted = days.slice().sort(function (a, b) { return a - b; });
  var next = sorted.find(function (d) { return d > todayDay; });
  var daysToAdd = next !== undefined ? next - todayDay : 7 - todayDay + sorted[0];
  var d = new Date();
  d.setDate(d.getDate() + daysToAdd);
  return d.toISOString().split('T')[0];
}

async function confirmChore() {
  var name = document.getElementById('chore-name').value.trim();
  var category = document.getElementById('chore-category').value;
  var isRecurring = document.getElementById('chore-recurring-check').checked;
  var selectedDays = isRecurring ? getSelectedDays() : null;
  var todBtn = document.querySelector('.tod-btn.selected');
  var timeOfDay = todBtn ? todBtn.dataset.tod : null;

  if (!name) { alert('Please enter a chore name.'); return; }
  if (isRecurring && selectedDays.length === 0) { alert('Please select at least one day it repeats on.'); return; }

  if (editingChoreId) {
    var chore = choresData.list.find(function (c) { return c.id === editingChoreId; });
    chore.name = name;
    chore.category = category;
    chore.recurringDays = selectedDays;
    chore.timeOfDay = timeOfDay;
  } else {
    var maxId = choresData.list.reduce(function (m, c) { return Math.max(m, c.id); }, 0);
    choresData.list.push({
      id: maxId + 1,
      name: name,
      category: category,
      status: 'pending',
      recurringDays: selectedDays,
      timeOfDay: timeOfDay,
      doneBy: null,
      doneAt: null,
      nextOccurrence: null,
      history: []
    });
  }

  await saveChores();
  closeChoreForm();
}

function openCategoryForm() {
  document.getElementById('category-name').value = '';
  document.getElementById('category-modal').classList.add('open');
  setTimeout(function () { document.getElementById('category-name').focus(); }, 50);
}

function closeCategoryForm() {
  document.getElementById('category-modal').classList.remove('open');
}

function handleCategoryOverlayClick(event) {
  if (event.target === document.getElementById('category-modal')) closeCategoryForm();
}

async function confirmCategory() {
  var name = document.getElementById('category-name').value.trim();
  if (!name) { alert('Please enter a category name.'); return; }
  if (sharedCategories.includes(name)) { alert('That category already exists.'); return; }
  sharedCategories.push(name);
  await saveCategories();
  closeCategoryForm();
}

function showChoreHistory(chore) {
  var modal = document.getElementById('history-modal');
  document.getElementById('history-modal-title').textContent = chore.name + ' — History';
  var list = document.getElementById('history-list');
  list.innerHTML = '';
  if (!chore.history || chore.history.length === 0) {
    list.innerHTML = '<li>No history yet.</li>';
  } else {
    chore.history.forEach(function (entry) {
      var li = document.createElement('li');
      li.textContent = 'Done by ' + entry.doneBy + ' · ' + formatDateTime(entry.doneAt);
      list.appendChild(li);
    });
  }
  modal.classList.add('open');
}

function closeHistoryModal() {
  document.getElementById('history-modal').classList.remove('open');
}

async function resetOverdueRecurring() {
  var today = todayISO();
  var changed = false;
  choresData.list.forEach(function (chore) {
    if (chore.status === 'done' && Array.isArray(chore.recurringDays) && chore.recurringDays.length > 0) {
      if (chore.nextOccurrence && chore.nextOccurrence <= today) {
        chore.status = 'pending';
        chore.doneBy = null;
        chore.doneAt = null;
        chore.nextOccurrence = null;
        changed = true;
      }
    }
  });
  if (changed) await saveChores();
}

async function loadChoreUsers() {
  var snap = await getDocs(collection(db, 'users'));
  var users = [];
  snap.forEach(function (d) {
    users.push({ hash: d.id, alias: d.data().alias || d.id.slice(0, 6) });
  });
  return users;
}

function renderUserPicker(users) {
  var picker = document.getElementById('chore-user-picker');
  if (!picker) return;
  picker.innerHTML = '';
  users.forEach(function (u) {
    var btn = document.createElement('button');
    btn.className = 'user-pick-btn' + (u.hash === currentChoreUser.hash ? ' active' : '');
    btn.textContent = u.alias;
    btn.onclick = function () { switchChoreUser(u, users); };
    picker.appendChild(btn);
  });
}

function switchChoreUser(user, users) {
  currentChoreUser = user;
  renderUserPicker(users);
  startChoresSync();
}

function startChoresSync() {
  if (choresUnsubscribe) choresUnsubscribe();
  var firstLoad = true;
  choresUnsubscribe = onSnapshot(choresDocRef(), async function (snap) {
    if (snap.exists()) {
      choresData = snap.data();
      if (!choresData.list) choresData.list = [];
    } else {
      choresData = { list: [] };
    }
    if (firstLoad) {
      firstLoad = false;
      await resetOverdueRecurring();
    } else {
      renderChores();
    }
  });
}

// ---- Boot ----

document.addEventListener('DOMContentLoaded', async function () {
  var allowedHosts = ['biblix.io', 'www.biblix.io'];
  if (!allowedHosts.includes(window.location.hostname)) {
    window.location.replace('https://biblix.io');
    return;
  }

  loadVersion();

  // Home page guard + background prefetch
  if (document.querySelector('.home-main')) {
    if (!sessionStorage.getItem('loggedInUser')) {
      window.location.href = 'index.html';
      return;
    }
    var alias = sessionStorage.getItem('alias');
    var welcomeEl = document.getElementById('welcome-msg');
    if (welcomeEl) {
      welcomeEl.textContent = alias ? 'Welcome back, ' + alias : 'Welcome back';
    }
    prefetchTransactions();
  }

  // Balance page guard
  if (document.getElementById('balance-display')) {
    if (!sessionStorage.getItem('loggedInUser')) {
      window.location.href = 'index.html';
      return;
    }
    if (sessionStorage.getItem('canAdd') !== 'true') {
      var addBtn = document.querySelector('.add-btn');
      if (addBtn) {
        addBtn.disabled = true;
        addBtn.title    = 'You do not have permission to add funds';
      }
    }

    var prefetched = sessionStorage.getItem('prefetched_transactions');
    if (prefetched) {
      transactions = JSON.parse(prefetched);
      nextId = transactions.reduce(function (max, t) { return Math.max(max, t.id + 1); }, 1);
      sessionStorage.removeItem('prefetched_transactions');
      renderAll();
    } else {
      showBalanceLoading(true);
    }
    startLiveSync();
  }

  // Chores page guard
  if (document.getElementById('chores-container')) {
    if (!sessionStorage.getItem('loggedInUser')) {
      window.location.href = 'index.html';
      return;
    }
    var myHash = sessionStorage.getItem('loggedInUser');
    var myAlias = sessionStorage.getItem('alias') || 'Me';
    currentChoreUser = { hash: myHash, alias: myAlias };

    await loadCategories();

    if (sessionStorage.getItem('canAdd') === 'true') {
      var allUsers = await loadChoreUsers();
      var pickerWrap = document.getElementById('chore-user-picker-wrap');
      if (pickerWrap && allUsers.length > 1) pickerWrap.style.display = 'flex';
      renderUserPicker(allUsers);
      window._choreUsers = allUsers;
    }
    startChoresSync();
  }

  // Login page — wire up Enter key
  var fields = ['login-username', 'login-password'];
  fields.forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') handleLogin();
    });
  });
});

// Expose functions called from HTML onclick attributes
window.openApp                  = openApp;
window.handleLogin              = handleLogin;
window.logout                   = logout;
window.openForm                 = openForm;
window.closeForm                = closeForm;
window.handleOverlayClick       = handleOverlayClick;
window.confirmTransaction       = confirmTransaction;
window.editComment              = editComment;
window.openChoreForm            = openChoreForm;
window.closeChoreForm           = closeChoreForm;
window.handleChoreOverlayClick  = handleChoreOverlayClick;
window.toggleRecurring          = toggleRecurring;
window.confirmChore             = confirmChore;
window.openCategoryForm         = openCategoryForm;
window.closeCategoryForm        = closeCategoryForm;
window.handleCategoryOverlayClick = handleCategoryOverlayClick;
window.confirmCategory          = confirmCategory;
window.closeHistoryModal        = closeHistoryModal;
