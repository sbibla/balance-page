# Bibla Apps

A private family web app for managing chores and pocket money. Built with vanilla HTML/CSS/JS and Firebase.

🌐 **Live at [biblix.io](https://biblix.io)**

---

## Apps

### 💰 Balance
Track each child's pocket money balance.

- View current balance and transaction history
- Admin can add funds or record withdrawals with a comment
- Each user has their own independent balance
- Streak bonuses (+$2) are automatically added when a 7-day chore streak is reached

### 🧹 Chores
A daily chore checklist for each child.

- Chores are grouped by category (Cleaning, Kitchen, Laundry, Errands, Pets, and custom)
- Tasks scheduled for today are shown first, highlighted at the top
- Each chore can have a recommended time of day (Morning, Afternoon, Evening)
- Recurring chores repeat on selected days of the week and reset automatically at midnight
- **Shared chores** can be assigned to multiple children — only one can complete it per day
- Completion history is tracked per chore
- **Streak system**: completing all tasks due on a given day advances a 7-day streak counter. Missing a day resets it to zero. Reaching 7 days awards a $2 bonus

---

## Users & Access

| User | Role |
|------|------|
| sbibla | Admin — can add chores, manage users, view all balances |
| Mika | Child |
| Roy | Child |
| Lennie | Child |

- Admin can create new users directly from the app (⚙ Manage Users)
- Each user can be granted or revoked access to individual apps
- Admin receives a browser push notification whenever a child completes a chore

---

## Tech Stack

- **Frontend**: Vanilla HTML, CSS, JavaScript (no frameworks)
- **Database**: Firebase Firestore (real-time sync)
- **Hosting**: Cloudflare Pages (auto-deploys from GitHub)
- **Push notifications**: Web Push API via a Cloudflare Worker

---

## Firestore Structure

```
users/{userHash}           — user profile, PIN hash, app access
balanceData/{userHash}     — transaction list per user
choresData/{userHash}      — chore list + streak per user
choresData/config          — shared categories
choresData/shared          — shared chores
config/adminPush           — admin's push notification subscription
```
