// =============================================
// Demo Project JavaScript
// Try asking Claude to modify this behaviour!
// =============================================

// This runs as soon as the page loads
document.addEventListener('DOMContentLoaded', function () {
  fetch('transactions.json')
    .then(function (res) {
      if (!res.ok) throw new Error('not found');
      return res.json();
    })
    .then(function (parsed) {
      if (!parsed.transactions || !Array.isArray(parsed.transactions)) throw new Error('invalid');
      transactions = parsed.transactions;
      nextId = transactions.reduce(function (max, t) { return Math.max(max, t.id + 1); }, 1);
      saveData();
      renderAll();
    })
    .catch(function () {
      // No transactions.json found — fall back to localStorage or built-in defaults
      var hadSavedData = loadData();
      if (!hadSavedData) {
        transactions = DEFAULT_TRANSACTIONS.slice();
        nextId = 6;
        saveData();
      }
      renderAll();
    });
});

// ---- Data model ----
// Each transaction: { id, date, amount, comment, originalComment }
// amount is positive for deposits, negative for withdrawals

var DEFAULT_TRANSACTIONS = [
  { id: 1, date: 'Jun 28, 2026', amount: -6.50,    comment: 'Coffee shop',              originalComment: 'Coffee shop' },
  { id: 2, date: 'Jun 25, 2026', amount: 3200.00,  comment: 'Monthly salary',           originalComment: 'Monthly salary' },
  { id: 3, date: 'Jun 22, 2026', amount: -84.20,   comment: 'Grocery store',            originalComment: 'Grocery store' },
  { id: 4, date: 'Jun 18, 2026', amount: -112.00,  comment: 'Electricity bill',         originalComment: 'Electricity bill' },
  { id: 5, date: 'Jun 15, 2026', amount: 750.00,   comment: 'Freelance payment received', originalComment: 'Freelance payment received' }
];

var transactions = [];
var nextId = 1;
var currentAction = null;

// ---- Persistence ----

function saveData() {
  localStorage.setItem('saar_transactions', JSON.stringify(transactions));
}

function loadData() {
  var saved = localStorage.getItem('saar_transactions');
  if (saved) {
    try {
      transactions = JSON.parse(saved);
      nextId = transactions.reduce(function (max, t) { return Math.max(max, t.id + 1); }, 1);
      return true;
    } catch (e) {
      transactions = [];
    }
  }
  return false;
}

function exportTransactions() {
  var data = JSON.stringify({ transactions: transactions }, null, 2);
  var blob = new Blob([data], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'transactions.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importTransactions(event) {
  var file = event.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function (e) {
    try {
      var parsed = JSON.parse(e.target.result);
      if (!parsed.transactions || !Array.isArray(parsed.transactions)) {
        alert('This file does not look like a valid transactions file.');
        return;
      }
      transactions = parsed.transactions;
      nextId = transactions.reduce(function (max, t) { return Math.max(max, t.id + 1); }, 1);
      saveData();
      renderAll();
      event.target.value = '';
    } catch (err) {
      alert('Could not read the file. Make sure it is a valid transactions.json file.');
    }
  };
  reader.readAsText(file);
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
    var li = document.createElement('li');
    li.className = 'transaction' + (t.id === highlightId ? ' new-transaction' : '');
    li.dataset.id = t.id;

    var isAdd = t.amount > 0;
    var wasEdited = t.comment !== t.originalComment;
    var editedBadge = wasEdited ? '<span class="edited-badge">edited</span>' : '';

    li.innerHTML =
      '<span class="transaction-date">' + t.date + '</span>' +
      '<span class="transaction-comment" onclick="editComment(this)">' +
        t.comment + '<span class="edit-icon">✏️</span>' + editedBadge +
      '</span>' +
      '<span class="transaction-amount ' + (isAdd ? 'positive' : 'negative') + '">' +
        (isAdd ? '+' : '-') + formatMoney(t.amount) +
      '</span>';

    // Wire up the edited badge tooltip
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
  document.getElementById('form-amount').value = '';
  document.getElementById('form-comment').value = '';
  document.getElementById('modal-overlay').classList.add('open');
  setTimeout(function () { document.getElementById('form-amount').focus(); }, 50);
}

function closeForm() {
  document.getElementById('modal-overlay').classList.remove('open');
  currentAction = null;
}

function handleOverlayClick(event) {
  // Close the modal if the user clicks the dark background (not the white box itself)
  if (event.target === document.getElementById('modal-overlay')) closeForm();
}

function confirmTransaction() {
  var amount = parseFloat(document.getElementById('form-amount').value);
  var comment = document.getElementById('form-comment').value.trim();

  if (!amount || amount <= 0) { alert('Please enter a valid amount.'); return; }
  if (!comment) { alert('Please add a comment.'); return; }
  if (currentAction === 'withdraw' && amount > getBalance()) {
    alert('Not enough funds in your balance.');
    return;
  }

  var today = new Date();
  var dateStr = today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  var finalAmount = currentAction === 'add' ? amount : -amount;

  var t = { id: nextId++, date: dateStr, amount: finalAmount, comment: comment, originalComment: comment };
  transactions.unshift(t);
  saveData();
  renderAll(t.id);
  closeForm();
}

// ---- Editable transaction comments ----

function editComment(span) {
  if (span.querySelector('input')) return;

  var li = span.closest('li');
  var id = parseInt(li.dataset.id);
  var t = transactions.find(function (x) { return x.id === id; });
  if (!t) return;

  var currentText = t.comment;

  span.innerHTML = '';
  var input = document.createElement('input');
  input.type = 'text';
  input.value = currentText;
  input.className = 'comment-input';
  span.appendChild(input);
  input.focus();
  input.select();
  span.onclick = null;

  function saveComment() {
    var newText = input.value.trim() || currentText;
    t.comment = newText;
    saveData();
    renderAll();

    // Re-wire badge on the freshly rendered row
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

  var tip = document.createElement('span');
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

// ---- Click counter button ----

// Tracks how many times the button has been clicked
var clickCount = 0;

// Messages to cycle through on each click
var messages = [
  "You clicked it! Nice work.",
  "Twice! You're getting the hang of this.",
  "Three times — you're on a roll!",
  "Four clicks. Are you testing something?",
  "Five! Claude Code made this button. Pretty cool, right?",
  "Six clicks. At this point, you're just having fun.",
  "Seven. Lucky number!",
  "Eight clicks. Okay, you win — here's a virtual high five: ✋",
  "Nine! Almost at ten.",
  "TEN CLICKS! You've unlocked... nothing. But good job anyway."
];

// This function runs every time the button is clicked
function handleButtonClick() {
  clickCount = clickCount + 1;

  // Pick a message — if we've run out, just keep showing the last one
  var messageIndex = Math.min(clickCount - 1, messages.length - 1);
  var messageText = messages[messageIndex];

  // Update the text on the page
  document.getElementById('message-display').textContent = messageText;

  // Show the click count below the button
  if (clickCount === 1) {
    document.getElementById('click-counter').textContent = '1 click so far';
  } else {
    document.getElementById('click-counter').textContent = clickCount + ' clicks so far';
  }

  // Change button colour slightly after 5 clicks as a fun reward
  if (clickCount >= 5) {
    document.getElementById('main-button').style.backgroundColor = '#6b46c1';
  }
}
