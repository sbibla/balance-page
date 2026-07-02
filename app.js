// =============================================
// Bibla Apps — app.js
// =============================================

import { initializeApp }              from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore, doc, getDoc, setDoc, onSnapshot, collection, getDocs, query }
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

  if (!username || !password) {
    showLoginError('Please enter your username and PIN.');
    return;
  }

  if (!/^\d{6}$/.test(password)) {
    showLoginError('Password must be exactly 6 digits.');
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
    showLoginError('Could not reach the server. Please try again.');
    return;
  }

  if (!match) {
    showLoginError('Incorrect username or PIN. Please try again.');
    return;
  }

  sessionStorage.setItem('loggedInUser', usernameHash);
  sessionStorage.setItem('canAdd', match.canAdd ? 'true' : 'false');
  window.location.href = 'balance.html';
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

// ---- User seeding (runs once if users collection is empty) ----

async function seedUsersIfNeeded() {
  var snap = await getDocs(query(collection(db, 'users')));
  if (!snap.empty) return;

  // Hashes of: mika/694227 and sbibla/123456
  var seed = [
    {
      usernameHash: '1567e79a15758616ee6c7bccbbd6f2bafcf3de6c49e7dd31fe6cd8a63d944359',
      passwordHash: 'b676ba5b01861ecd063e7fc69f102708009cc780d4bcb8dd58460e69738cf455',
      canAdd: false
    },
    {
      usernameHash: '0bbf0c3dff2524bc2a80c7fb2a21e31ebb5efe7c2a699ebd9164799fac3926d6',
      passwordHash: '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92',
      canAdd: true
    }
  ];

  for (var u of seed) {
    await setDoc(doc(db, 'users', u.usernameHash), {
      passwordHash: u.passwordHash,
      canAdd: u.canAdd
    });
  }
}

// ---- Data model ----

var DEFAULT_TRANSACTIONS = [
  { id: 10, date: 'May 25, 2026', amount: -50,   comment: 'The Oaks - Apple Cash',      originalComment: 'The Oaks - Apple Cash' },
  { id: 9,  date: 'May 8, 2026',  amount: -20,   comment: 'The Oaks - PJ',              originalComment: 'The Oaks - PJ' },
  { id: 8,  date: 'May 4, 2026',  amount:  23,   comment: 'Allowance',                  originalComment: 'Allowance' },
  { id: 7,  date: 'Apr 6, 2026',  amount:  23,   comment: 'Allowance',                  originalComment: 'Allowance' },
  { id: 6,  date: 'Mar 17, 2026', amount: -18,   comment: 'Amazon - curly hair gel',    originalComment: 'Amazon - curly hair gel' },
  { id: 5,  date: 'Jan 21, 2026', amount:  20,   comment: 'Cash',                       originalComment: 'Cash' },
  { id: 4,  date: 'Jan 21, 2026', amount: -10,   comment: '',                           originalComment: '' },
  { id: 3,  date: 'Jan 16, 2026', amount: -10,   comment: 'Starbucks',                  originalComment: 'Starbucks' },
  { id: 2,  date: 'Jan 1, 2026',  amount:  25,   comment: 'Allowance',                  originalComment: 'Allowance' },
  { id: 1,  date: 'Jan 1, 2026',  amount:  20,   comment: 'Facial',                     originalComment: 'Facial' },
  { id: 0,  date: 'Jan 1, 2026',  amount: 155,   comment: 'Opening balance',            originalComment: 'Opening balance' }
];

var transactions = [];
var nextId       = 1;
var currentAction = null;

// ---- Firestore persistence ----

async function saveData() {
  await setDoc(doc(db, 'appData', 'transactions'), { list: transactions });
}

async function loadData() {
  var snap = await getDoc(doc(db, 'appData', 'transactions'));
  if (snap.exists() && snap.data().list && snap.data().list.length > 0) {
    transactions = snap.data().list;
    nextId = transactions.reduce(function (max, t) { return Math.max(max, t.id + 1); }, 1);
    return true;
  }
  return false;
}

function startLiveSync() {
  onSnapshot(doc(db, 'appData', 'transactions'), function (snap) {
    if (snap.exists() && snap.data().list) {
      transactions = snap.data().list;
      nextId = transactions.reduce(function (max, t) { return Math.max(max, t.id + 1); }, 1);
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

// ---- Boot ----

document.addEventListener('DOMContentLoaded', async function () {

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

    await seedUsersIfNeeded();

    var hadData = await loadData();
    if (!hadData) {
      transactions = DEFAULT_TRANSACTIONS.slice();
      nextId       = 11;
      await saveData();
    }
    startLiveSync();
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
window.handleLogin        = handleLogin;
window.logout             = logout;
window.openForm           = openForm;
window.closeForm          = closeForm;
window.handleOverlayClick = handleOverlayClick;
window.confirmTransaction = confirmTransaction;
window.editComment        = editComment;
