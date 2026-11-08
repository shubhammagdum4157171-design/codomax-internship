/* =====================================================
   Codomax Auth - script.js
   Sections:
   1. Settings            5. Password strength
   2. Small helpers       6. Alerts, toasts, loading button
   3. View switching      7. Talking to the backend (fetch)
   4. Field validation    8. Form submit + page wiring
   ===================================================== */
'use strict';

/* ---------- 1. Settings ---------- */
// Relative URLs work because Express serves this page from http://localhost:5000
const API = {
  register: '/api/auth/register',
  login: '/api/auth/login'
};
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/* ---------- 2. Small helpers ---------- */
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const card = $('#auth-card');
const tabsBar = $('.tabs');
const loginForm = $('#login-form');
const registerForm = $('#register-form');

let loggedIn = false; // only controls what the page shows; nothing is stored in the browser

// Read the current value of a form field by its name attribute
const valueOf = (form, name) => $(`[name="${name}"]`, form).value;

// Remove a trailing full stop so we can add our own sentence after a server message
const trimEnd = (text) => String(text).replace(/[\s.!]+$/, '');

/* ---------- 3. View switching (login / register / success) ---------- */
function switchView(view) {
  $$('.panel').forEach((panel) => { panel.hidden = panel.dataset.panel !== view; });

  // The tab bar is hidden after login; otherwise move the sliding indicator
  tabsBar.hidden = view === 'success';
  tabsBar.dataset.active = view === 'register' ? 'register' : 'login';
  $$('.tab').forEach((tab) => {
    const active = tab.dataset.switch === view;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
  });

  // Put the cursor in the first field of the new panel (without jumping the page)
  const firstInput = $(`.panel[data-panel="${view}"] input`);
  if (firstInput) firstInput.focus({ preventScroll: true });
}

// Every element with data-switch (tabs, nav buttons, hero buttons, links) changes the view
$$('[data-switch]').forEach((element) => {
  element.addEventListener('click', () => {
    const fromTabs = element.closest('.tabs');
    if (!(loggedIn && !fromTabs)) switchView(element.dataset.switch);
    if (!fromTabs) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
});

/* ---------- 4. Field validation ---------- */
// One rule per data-rule value in the HTML. Each returns '' (valid) or an error message.
const rules = {
  name: (v) => (v.trim().length >= 2 ? '' : 'Enter your full name (at least 2 characters).'),
  email: (v) => {
    if (!v.trim()) return 'Email is required.';
    return EMAIL_PATTERN.test(v.trim()) ? '' : 'Enter a valid email, like name@example.com.';
  },
  loginPassword: (v) => (v ? '' : 'Enter your password.'),
  password: (v) => {
    if (v.length < 8) return 'Use at least 8 characters.';
    return scorePassword(v) < 2 ? 'Too weak. Add capital letters, numbers or symbols.' : '';
  },
  confirm: (v, form) => (v === valueOf(form, 'password') ? '' : 'The passwords do not match.')
};

function setFieldState(input, message) {
  const field = input.closest('.field');
  field.classList.toggle('invalid', Boolean(message));
  field.classList.toggle('valid', !message && input.value !== '');
  $('.error-msg', field).textContent = message;
  input.setAttribute('aria-invalid', message ? 'true' : 'false');
}

function validateField(input) {
  const message = rules[input.dataset.rule](input.value, input.form);
  setFieldState(input, message);
  return message === '';
}

// Live validation: check when the user leaves a field, then re-check on every keystroke
$$('input[data-rule]').forEach((input) => {
  input.addEventListener('blur', () => {
    if (input.value !== '') { input.dataset.touched = '1'; validateField(input); }
  });
  input.addEventListener('input', () => {
    if (input.name === 'password' && input.form === registerForm) {
      updateStrength(input.value);
      const confirm = $('[name="confirm"]', registerForm);
      if (confirm.dataset.touched) validateField(confirm); // keep "match" message up to date
    }
    if (input.dataset.touched) validateField(input);
  });
});

// Show / hide password buttons
function setPasswordVisible(button, visible) {
  $('input', button.closest('.input-wrap')).type = visible ? 'text' : 'password';
  button.setAttribute('aria-pressed', String(visible));
  button.setAttribute('aria-label', visible ? 'Hide password' : 'Show password');
}
$$('[data-toggle-password]').forEach((button) => {
  button.addEventListener('click', () => {
    const input = $('input', button.closest('.input-wrap'));
    setPasswordVisible(button, input.type === 'password');
  });
});

// Empty a form and remove all validation styling
function clearForm(form) {
  form.reset();
  $$('.field', form).forEach((field) => {
    field.classList.remove('invalid', 'valid');
    $('.error-msg', field).textContent = '';
  });
  $$('input', form).forEach((input) => delete input.dataset.touched);
  $$('[data-toggle-password]', form).forEach((button) => setPasswordVisible(button, false));
  hideAlert(form);
  if (form === registerForm) updateStrength('');
}

/* ---------- 5. Password strength ---------- */
const STRENGTH_LABELS = ['Enter a password', 'Weak', 'Fair', 'Good', 'Strong'];

// Returns 0 (empty) or 1-4. Points for length, mixed case, a number and a symbol.
function scorePassword(password) {
  if (!password) return 0;
  let points = 0;
  if (password.length >= 8) points++;
  if (password.length >= 12) points++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) points++;
  if (/\d/.test(password)) points++;
  if (/[^A-Za-z0-9]/.test(password)) points++;
  if (password.length < 8) points = Math.min(points, 1); // short passwords can never be better than "Weak"
  return Math.max(1, Math.min(points, 4));
}

// A short, practical tip for the next improvement
function passwordTip(password) {
  if (!password) return 'Use 8 or more characters.';
  if (password.length < 8) return 'Add more characters (8 minimum).';
  if (!(/[a-z]/.test(password) && /[A-Z]/.test(password))) return 'Mix upper and lower case letters.';
  if (!/\d/.test(password)) return 'Add a number.';
  if (!/[^A-Za-z0-9]/.test(password)) return 'Add a symbol such as ! or @.';
  return 'Nice. This is hard to guess.';
}

function updateStrength(password) {
  const level = scorePassword(password);
  const meter = $('#strength');
  meter.dataset.level = String(level);
  $$('.strength-bars span', meter).forEach((bar, index) => bar.classList.toggle('on', index < level));
  $('#strength-label').textContent = STRENGTH_LABELS[level];
  $('#strength-tip').textContent = passwordTip(password);
}

/* ---------- 6. Alerts, toasts and the loading button ---------- */
function showAlert(form, type, message) {
  const box = $('.alert', form);
  box.className = `alert ${type}`;
  box.textContent = message; // textContent (not innerHTML) keeps server text from injecting HTML
  box.hidden = false;
}
function hideAlert(form) { $('.alert', form).hidden = true; }

// Small pop-up message in the corner. Click it to dismiss; it also closes by itself.
function toast(type, title, message) {
  const item = document.createElement('div');
  item.className = `toast ${type}`;
  item.setAttribute('role', type === 'error' ? 'alert' : 'status');
  const heading = document.createElement('strong');
  heading.textContent = title;
  const body = document.createElement('span');
  body.textContent = message;
  item.append(heading, body);

  const close = () => {
    item.classList.add('out');
    item.addEventListener('animationend', () => item.remove(), { once: true });
  };
  item.addEventListener('click', close);
  setTimeout(close, 4500);
  $('#toasts').append(item);
}

function setLoading(button, loading) {
  button.classList.toggle('loading', loading);
  button.disabled = loading;
  button.setAttribute('aria-busy', String(loading));
}

function shakeCard() {
  card.classList.remove('shake');
  void card.offsetWidth; // restart the animation if it is already running
  card.classList.add('shake');
}

/* ---------- 7. Talking to the backend ---------- */
// Sends JSON with fetch and returns both the HTTP response and the parsed JSON body (or null).
async function postJSON(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  let body = null;
  try { body = await response.json(); } catch (error) { /* the server did not send JSON */ }
  return { response, body };
}

// Never display anything that looks like a password, hash or salt
function redact(data) {
  return JSON.parse(JSON.stringify(data, (key, value) => (/pass|hash|salt/i.test(key) ? '[hidden]' : value)));
}

/* ---------- 8. Form submit + page wiring ---------- */
// What to do after the server says "success"
const onSuccess = {
  register(body, payload) {
    clearForm(registerForm);
    switchView('login');
    $('[name="email"]', loginForm).value = payload.email; // save the user some typing
    showAlert(loginForm, 'success', `${trimEnd(body.message)}. You can log in now.`);
    toast('success', 'Account created', body.message);
    $('[name="password"]', loginForm).focus({ preventScroll: true });
  },
  login(body, payload) {
    const user = body.user || body.data || {}; // backend returns the user details with a successful login
    $('#success-title').textContent = user.name ? `Welcome, ${user.name}` : 'You are logged in';
    $('#success-name').textContent = user.name || '-';
    $('#success-email').textContent = user.email || payload.email;
    $('#success-message').textContent = body.message;
    $('#raw-response').textContent = JSON.stringify(redact(body), null, 2);
    clearForm(loginForm); // the password is wiped from the form right away
    loggedIn = true;
    switchView('success');
    toast('success', 'Logged in', body.message);
  }
};

async function submitForm(event, action) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = $('button[type="submit"]', form);
  hideAlert(form);

  // Step 1: validate every field and stop if anything is wrong
  const inputs = $$('input[data-rule]', form);
  inputs.forEach((input) => { input.dataset.touched = '1'; });
  const results = inputs.map(validateField);
  if (results.includes(false)) {
    shakeCard();
    inputs[results.indexOf(false)].focus();
    return;
  }

  // Step 2: build exactly the JSON the backend expects
  const payload = action === 'register'
    ? { name: valueOf(form, 'name').trim(), email: valueOf(form, 'email').trim(), password: valueOf(form, 'password') }
    : { email: valueOf(form, 'email').trim(), password: valueOf(form, 'password') };

  // Step 3: send it and show the real response
  setLoading(button, true);
  try {
    const { response, body } = await postJSON(API[action], payload);
    const succeeded = response.ok && body !== null && body.success === true;

    if (succeeded) {
      onSuccess[action](body, payload);
    } else {
      const message = (body && body.message) || `Unexpected response from the server (HTTP ${response.status}).`;
      showAlert(form, 'error', message);
      toast('error', action === 'register' ? 'Could not create account' : 'Could not log in', message);
      shakeCard();
    }
  } catch (error) {
    const message = 'Cannot reach the server. Check that it is running at http://localhost:5000 and try again.';
    showAlert(form, 'error', message);
    toast('error', 'Connection problem', message);
  } finally {
    setLoading(button, false);
  }
}

loginForm.addEventListener('submit', (event) => submitForm(event, 'login'));
registerForm.addEventListener('submit', (event) => submitForm(event, 'register'));

// Log out: the backend has no session or token, so this only resets what the page shows
$('#logout-btn').addEventListener('click', () => {
  loggedIn = false;
  switchView('login');
  toast('info', 'Logged out', 'You have been logged out.');
});

// Footer year
$('#year').textContent = new Date().getFullYear();
