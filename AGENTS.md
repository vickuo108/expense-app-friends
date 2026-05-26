# AGENTS.md — expense-app-friends

## Project Overview

This project is a lightweight personal finance PWA built with:

* Vanilla HTML
* Vanilla CSS
* Vanilla JavaScript
* Service Worker
* LocalStorage persistence

All core logic is inside `index.html`.

Goal priorities:

1. Stability
2. Offline support
3. Mobile usability
4. Minimal complexity
5. Fast iteration

Avoid unnecessary abstractions or frameworks.

---

## Project Structure

```txt
expense-app-friends/
├── index.html
├── sw.js
├── manifest.json
└── AGENTS.md
```

### File Responsibilities

* `index.html`
  Contains all HTML, CSS, and JavaScript logic.

* `sw.js`
  Handles Service Worker cache versioning and offline support.

* `manifest.json`
  PWA configuration.

---

## Important Locations Inside index.html

| Feature                     | Location                     |
| --------------------------- | ---------------------------- |
| APP_VERSION / CHANGELOG     | Bottom JS section: `版本與更新日誌` |
| Default fixed expenses      | `DEFAULT_FIXED`              |
| Financial glossary defaults | `DEFAULT_GLOSSARY`           |
| Service Worker registration | Near `initReportNav`         |
| Monthly budget storage key  | `KEY_MONTHLY_BUDGETS`        |

---

## Release Workflow Rules

IMPORTANT:

Only perform release/version updates AFTER the user explicitly says:

> 「完成此次升級」

Before that:

* DO NOT update versions
* DO NOT modify changelog
* DO NOT update Service Worker cache name
* DO NOT push to GitHub

A single upgrade may include multiple feature changes.

---

## Required Actions During Release

After the user confirms release completion:

### 1. Update Service Worker Cache Version

Inside `sw.js`

Format:

```js
expense-friends-v{number}
```

Increment by 1 each release.

Example:

```txt
expense-friends-v1 -> expense-friends-v2
```

---

### 2. Update APP_VERSION

Inside `index.html`

Rules:

* Small changes:
  Increment patch version

```txt
friends-1.0 -> friends-1.1 -> friends-1.2
```

* Larger feature updates:
  Increment minor version appropriately

Use judgment based on change scope.

---

### 3. Add CHANGELOG Entry

Insert new entry at the TOP of `CHANGELOG`.

Format:

```js
{
  version:'friends-1.1',
  date:'YYYY-MM-DD',
  items:[
    'Short description',
    '...',
  ]
},
```

Requirements:

* Use Taipei timezone date
* Keep descriptions concise

---

### 4. Git Operations

Run:

```bash
git add index.html sw.js manifest.json AGENTS.md
git commit -m "..."
git push origin main
```

---

## Core Features

### Update Banner

When `sw.js` cache version changes:

* browser detects waiting Service Worker
* show top update banner
* user can refresh immediately

---

### Changelog Modal

On app startup:

* compare `APP_VERSION`
* compare localStorage:
  `vic2_seen_version`

If different:

* show changelog modal

---

### Monthly Budgets

Storage key:

```js
vic2_monthly_budgets
```

Format:

```json
{
  "2026-05": {
    "food": 5000,
    "fixed:Netflix": 390,
    "loan": 12000
  }
}
```

Rules:

* fixed expense keys use:
  `fixed:項目名`
* loan uses:
  `loan`

---

### Financial Glossary

Storage key:

```js
vic2_glossary
```

Entry point:

* button at bottom of settings page

---

### Credit Card Installments

Records include:

```js
installments
billedDate
paidInstallments
```

Installment deductions depend on:

* `billedDate`

---

### Monthly Available Balance

Stat box click behavior:

* show income details
* floating expenses
* fixed expenses
* loan details
* installment deductions

---

## Development Rules

### Keep Architecture Simple

DO:

* preserve current structure
* make minimal safe changes
* prefer existing patterns
* keep logic readable

DO NOT:

* introduce frameworks
* split files unnecessarily
* add build tools
* overengineer

---

## UI Guidelines

* Mobile-first
* Touch-friendly controls
* Fast rendering
* Minimal animations
* Clean and dense financial UI

---

## Code Style

* Prefer `const`
* Short focused functions
* Avoid deep nesting
* Clear naming
* Minimal comments

---

## Safety Rules

Before finishing modifications:

Verify:

* offline mode still works
* no Service Worker breakage
* no console errors
* no broken mobile layout
* localStorage compatibility preserved

---

## Workflow Preference

Small modifications:

* execute directly

Large modifications:

* provide short implementation plan first

All communication:

* Traditional Chinese
