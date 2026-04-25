const TOKEN_KEY = 'task-tracker.token';

const els = {
  authPanel: document.getElementById('auth-panel'),
  appPanel: document.getElementById('app-panel'),
  loginForm: document.getElementById('login-form'),
  registerForm: document.getElementById('register-form'),
  loginEmail: document.getElementById('login-email'),
  loginPassword: document.getElementById('login-password'),
  registerName: document.getElementById('register-name'),
  registerEmail: document.getElementById('register-email'),
  registerPassword: document.getElementById('register-password'),
  logoutBtn: document.getElementById('logout-btn'),
  welcome: document.getElementById('welcome'),
  userMeta: document.getElementById('user-meta'),
  taskForm: document.getElementById('task-form'),
  taskFormTitle: document.getElementById('task-form-title'),
  taskFormState: document.getElementById('task-form-state'),
  taskTitle: document.getElementById('task-title'),
  taskProject: document.getElementById('task-project'),
  taskStatus: document.getElementById('task-status'),
  taskDue: document.getElementById('task-due'),
  taskNotes: document.getElementById('task-notes'),
  taskSubmit: document.getElementById('task-submit'),
  taskClear: document.getElementById('task-clear'),
  statusFilter: document.getElementById('status-filter'),
  projectFilter: document.getElementById('project-filter'),
  taskCount: document.getElementById('task-count'),
  taskListCount: document.getElementById('task-list-count'),
  taskList: document.getElementById('task-list'),
  overdueCount: document.getElementById('overdue-count'),
  soonCount: document.getElementById('soon-count'),
  message: document.getElementById('message'),
};

const state = {
  token: localStorage.getItem(TOKEN_KEY) || '',
  user: null,
  tasks: [],
  projects: [],
  filters: {
    status: 'all',
    project: 'all',
  },
};

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function saveToken(token) {
  state.token = token;
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

function flash(message, tone = 'info') {
  if (!message) {
    els.message.hidden = true;
    els.message.textContent = '';
    delete els.message.dataset.tone;
    return;
  }
  els.message.hidden = false;
  els.message.textContent = message;
  els.message.dataset.tone = tone;
}

function setAuthView(isAuthVisible) {
  els.authPanel.hidden = !isAuthVisible;
  els.appPanel.hidden = isAuthVisible;
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = {
    'Content-Type': 'application/json',
  };
  if (auth && state.token) {
    headers.Authorization = `Bearer ${state.token}`;
  }

  const response = await fetch(`/api${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `Request failed (${response.status})`);
  }
  return payload;
}

const api = {
  health: () => request('/health', { auth: false }),
  register: body => request('/register', { method: 'POST', auth: false, body }),
  login: body => request('/login', { method: 'POST', auth: false, body }),
  me: () => request('/me'),
  projects: () => request('/projects'),
  tasks: () => request('/tasks'),
  createTask: body => request('/tasks', { method: 'POST', body }),
  updateTask: (id, body) => request(`/tasks/${id}`, { method: 'PATCH', body }),
  deleteTask: id => request(`/tasks/${id}`, { method: 'DELETE' }),
};

function applyFiltersFromUrl() {
  const params = new URLSearchParams(location.search);
  state.filters.status = params.get('status') || 'all';
  state.filters.project = params.get('project') || 'all';
}

function syncFiltersToUrl() {
  const params = new URLSearchParams();
  if (state.filters.status !== 'all') params.set('status', state.filters.status);
  if (state.filters.project !== 'all') params.set('project', state.filters.project);
  const nextUrl = params.toString() ? `?${params.toString()}` : location.pathname;
  history.replaceState({}, '', nextUrl);
}

function isOverdue(task) {
  if (!task.dueDate || task.status === 'done') return false;
  return new Date(task.dueDate) < new Date();
}

function isDueSoon(task) {
  if (!task.dueDate || task.status === 'done') return false;
  const diffMs = new Date(task.dueDate) - new Date();
  return diffMs >= 0 && diffMs <= 1000 * 60 * 60 * 24 * 3;
}

function filteredTasks() {
  return state.tasks.filter(task => {
    const statusMatch = state.filters.status === 'all' || task.status === state.filters.status;
    const projectMatch = state.filters.project === 'all' || task.project === state.filters.project;
    return statusMatch && projectMatch;
  });
}

function renderProjectOptions() {
  const projects = ['all', ...new Set(state.projects.concat(state.tasks.map(task => task.project)).filter(Boolean))].sort((left, right) => {
    if (left === 'all') return -1;
    if (right === 'all') return 1;
    return left.localeCompare(right);
  });
  els.projectFilter.innerHTML = '';
  projects.forEach(project => {
    const label = project === 'all' ? 'All projects' : project;
    const option = new Option(label, project);
    if (project === state.filters.project) option.selected = true;
    els.projectFilter.appendChild(option);
  });
  els.statusFilter.value = state.filters.status;
}

function renderSummary() {
  const visible = filteredTasks();
  els.taskCount.textContent = `${visible.length} task${visible.length === 1 ? '' : 's'}`;
  els.taskListCount.textContent = `${visible.length} visible`;
  els.overdueCount.textContent = `${state.tasks.filter(isOverdue).length}`;
  els.soonCount.textContent = `${state.tasks.filter(isDueSoon).length}`;
  els.welcome.textContent = state.user ? `Welcome, ${state.user.name}` : 'Task dashboard';
  els.userMeta.textContent = state.user ? `${state.user.email} · ${state.projects.length} project${state.projects.length === 1 ? '' : 's'}` : '';
}

function renderTaskList() {
  const tasks = filteredTasks();
  els.taskList.innerHTML = '';

  if (!tasks.length) {
    const empty = document.createElement('div');
    empty.className = 'task-card';
    empty.innerHTML = '<p class="task-notes">No tasks match the current filters yet. Create one or adjust the filters to keep learning the API flow.</p>';
    els.taskList.appendChild(empty);
    return;
  }

  tasks.forEach(task => {
    const card = document.createElement('article');
    card.className = `task-card${isOverdue(task) ? ' overdue' : ''}`;
    const dueLabel = task.dueDate ? new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'No due date';
    card.innerHTML = `
      <div class="task-top">
        <div>
          <p class="task-project">${escapeHtml(task.project)}</p>
          <h4>${escapeHtml(task.title)}</h4>
        </div>
        <span class="badge ${escapeHtml(task.status)}">${escapeHtml(task.status.replace('-', ' '))}</span>
      </div>
      <p class="task-notes">${escapeHtml(task.notes || 'No notes yet.')}</p>
      <div class="task-meta">
        <span>Due ${escapeHtml(dueLabel)}</span>
        ${isOverdue(task) ? '<span class="badge danger">Overdue</span>' : ''}
      </div>
      <div class="task-actions">
        <button type="button" class="ghost edit-btn" data-id="${task.id}">Edit</button>
        <button type="button" class="ghost delete-btn" data-id="${task.id}">Delete</button>
      </div>
    `;

    card.querySelector('.edit-btn').addEventListener('click', () => loadTaskIntoForm(task));
    card.querySelector('.delete-btn').addEventListener('click', () => removeTask(task.id));
    els.taskList.appendChild(card);
  });
}

function renderDashboard() {
  renderProjectOptions();
  renderSummary();
  renderTaskList();
}

function resetTaskForm() {
  els.taskForm.reset();
  els.taskForm.dataset.editId = '';
  els.taskFormTitle.textContent = 'Create task';
  els.taskFormState.textContent = 'New';
  els.taskSubmit.textContent = 'Add task';
}

function loadTaskIntoForm(task) {
  els.taskForm.dataset.editId = String(task.id);
  els.taskFormTitle.textContent = 'Edit task';
  els.taskFormState.textContent = `Editing #${task.id}`;
  els.taskSubmit.textContent = 'Update task';
  els.taskTitle.value = task.title;
  els.taskProject.value = task.project || '';
  els.taskStatus.value = task.status || 'todo';
  els.taskDue.value = task.dueDate || '';
  els.taskNotes.value = task.notes || '';
  els.taskTitle.focus();
}

function toTaskPayload() {
  return {
    title: els.taskTitle.value.trim(),
    project: els.taskProject.value.trim(),
    status: els.taskStatus.value,
    dueDate: els.taskDue.value,
    notes: els.taskNotes.value.trim(),
  };
}

async function refreshData() {
  const [tasksPayload, projectsPayload] = await Promise.all([api.tasks(), api.projects()]);
  state.tasks = tasksPayload.tasks || [];
  state.projects = projectsPayload.projects || [];
  renderDashboard();
}

async function loadSession() {
  if (!state.token) {
    setAuthView(true);
    flash('Log in or register to begin.', 'info');
    return;
  }

  try {
    const profile = await api.me();
    state.user = profile.user;
    await refreshData();
    setAuthView(false);
    flash(`Signed in as ${state.user.name}.`, 'success');
  } catch (error) {
    saveToken('');
    state.user = null;
    setAuthView(true);
    flash('Your session expired. Please log in again.', 'warning');
  }
}

async function handleLogin(event) {
  event.preventDefault();
  try {
    const response = await api.login({
      email: els.loginEmail.value,
      password: els.loginPassword.value,
    });
    saveToken(response.token);
    state.user = response.user;
    await refreshData();
    setAuthView(false);
    flash(`Welcome back, ${response.user.name}.`, 'success');
    els.loginForm.reset();
  } catch (error) {
    flash(error.message, 'error');
  }
}

async function handleRegister(event) {
  event.preventDefault();
  try {
    const response = await api.register({
      name: els.registerName.value,
      email: els.registerEmail.value,
      password: els.registerPassword.value,
    });
    saveToken(response.token);
    state.user = response.user;
    await refreshData();
    setAuthView(false);
    flash(`Account created for ${response.user.name}.`, 'success');
    els.registerForm.reset();
  } catch (error) {
    flash(error.message, 'error');
  }
}

async function handleTaskSubmit(event) {
  event.preventDefault();
  const payload = toTaskPayload();
  if (!payload.title) {
    flash('A task title is required.', 'warning');
    return;
  }

  try {
    const editId = els.taskForm.dataset.editId;
    if (editId) {
      await api.updateTask(editId, payload);
      flash('Task updated.', 'success');
    } else {
      await api.createTask(payload);
      flash('Task created.', 'success');
    }
    await refreshData();
    resetTaskForm();
  } catch (error) {
    flash(error.message, 'error');
  }
}

async function removeTask(id) {
  if (!confirm('Delete this task?')) return;
  try {
    await api.deleteTask(id);
    await refreshData();
    flash('Task deleted.', 'success');
  } catch (error) {
    flash(error.message, 'error');
  }
}

function bindEvents() {
  els.loginForm.addEventListener('submit', handleLogin);
  els.registerForm.addEventListener('submit', handleRegister);
  els.taskForm.addEventListener('submit', handleTaskSubmit);
  els.taskClear.addEventListener('click', () => {
    resetTaskForm();
  });
  els.logoutBtn.addEventListener('click', () => {
    saveToken('');
    state.user = null;
    state.tasks = [];
    state.projects = [];
    resetTaskForm();
    setAuthView(true);
    flash('Logged out.', 'info');
  });
  els.statusFilter.addEventListener('change', event => {
    state.filters.status = event.target.value;
    syncFiltersToUrl();
    renderDashboard();
  });
  els.projectFilter.addEventListener('change', event => {
    state.filters.project = event.target.value;
    syncFiltersToUrl();
    renderDashboard();
  });
}

async function start() {
  applyFiltersFromUrl();
  bindEvents();
  renderDashboard();
  updateFilterControls();
  setAuthView(Boolean(state.token));
  await loadSession();
}

function updateFilterControls() {
  els.statusFilter.value = state.filters.status;
  els.projectFilter.value = state.filters.project;
}

start();