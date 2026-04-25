import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');
const publicDir = join(rootDir, 'public');
const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || 'task-tracker-dev-secret';

const demoPasswordHash = bcrypt.hashSync('demo123', 10);
const store = {
  users: [
    {
      id: 1,
      name: 'Demo User',
      email: 'demo@tasktracker.dev',
      passwordHash: demoPasswordHash,
    },
  ],
  tasks: [
    {
      id: 1,
      userId: 1,
      title: 'Build auth flow',
      project: 'Playground',
      status: 'in-progress',
      dueDate: '2026-04-30',
      notes: 'Mirror the guided tutorial.',
    },
    {
      id: 2,
      userId: 1,
      title: 'Wire dashboard filters',
      project: 'Playground',
      status: 'todo',
      dueDate: '2026-05-02',
      notes: 'Keep the URL in sync with the filter state.',
    },
  ],
  nextUserId: 2,
  nextTaskId: 3,
};

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(publicDir));

function sanitizeUser(user) {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

function createToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}

function getBearerToken(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  return scheme === 'Bearer' ? token : null;
}

function authRequired(req, res, next) {
  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({ error: 'Missing bearer token.' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = store.users.find(item => item.id === payload.sub);
    if (!user) {
      return res.status(401).json({ error: 'User not found.' });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

function normalizeTaskInput(input) {
  const title = String(input?.title || '').trim();
  if (!title) {
    throw new Error('Title is required.');
  }

  const project = String(input?.project || 'General').trim() || 'General';
  const status = ['todo', 'in-progress', 'done'].includes(input?.status) ? input.status : 'todo';
  const dueDate = String(input?.dueDate || '').trim();
  const notes = String(input?.notes || '').trim();

  return { title, project, status, dueDate, notes };
}

function mergeTask(task, input) {
  if (Object.prototype.hasOwnProperty.call(input, 'title')) {
    const nextTitle = String(input.title || '').trim();
    if (nextTitle) task.title = nextTitle;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'project')) {
    const nextProject = String(input.project || '').trim();
    if (nextProject) task.project = nextProject;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'status') && ['todo', 'in-progress', 'done'].includes(input.status)) {
    task.status = input.status;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'dueDate')) {
    task.dueDate = String(input.dueDate || '').trim();
  }
  if (Object.prototype.hasOwnProperty.call(input, 'notes')) {
    task.notes = String(input.notes || '').trim();
  }
  return task;
}

function publicTask(task) {
  const { userId, ...safeTask } = task;
  return safeTask;
}

function sortTasks(tasks) {
  return [...tasks].sort((left, right) => {
    const leftDate = left.dueDate || '9999-12-31';
    const rightDate = right.dueDate || '9999-12-31';
    return leftDate.localeCompare(rightDate) || left.title.localeCompare(right.title);
  });
}

function tasksForUser(userId) {
  return sortTasks(store.tasks.filter(task => task.userId === userId)).map(publicTask);
}

function projectsForUser(userId) {
  return [...new Set(store.tasks.filter(task => task.userId === userId).map(task => task.project).filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/register', (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '').trim();

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    if (store.users.some(user => user.email === email)) {
      return res.status(409).json({ error: 'Email already exists.' });
    }

    const user = {
      id: store.nextUserId++,
      name,
      email,
      passwordHash: bcrypt.hashSync(password, 10),
    };
    store.users.push(user);

    return res.status(201).json({ token: createToken(user), user: sanitizeUser(user) });
  } catch (error) {
    return res.status(500).json({ error: 'Unable to register user.' });
  }
});

app.post('/api/login', (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '').trim();

    const user = store.users.find(entry => entry.email === email);
    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    return res.json({ token: createToken(user), user: sanitizeUser(user) });
  } catch (error) {
    return res.status(500).json({ error: 'Unable to log in.' });
  }
});

app.get('/api/me', authRequired, (req, res) => {
  res.json({ user: sanitizeUser(req.user) });
});

app.get('/api/projects', authRequired, (req, res) => {
  res.json({ projects: projectsForUser(req.user.id) });
});

app.get('/api/tasks', authRequired, (req, res) => {
  res.json({ tasks: tasksForUser(req.user.id) });
});

app.post('/api/tasks', authRequired, (req, res) => {
  try {
    const task = {
      id: store.nextTaskId++,
      userId: req.user.id,
      ...normalizeTaskInput(req.body),
    };
    store.tasks.push(task);
    res.status(201).json({ task: publicTask(task) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.patch('/api/tasks/:id', authRequired, (req, res) => {
  const taskId = Number(req.params.id);
  const task = store.tasks.find(item => item.id === taskId && item.userId === req.user.id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found.' });
  }

  try {
    mergeTask(task, req.body || {});
    return res.json({ task: publicTask(task) });
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});

app.delete('/api/tasks/:id', authRequired, (req, res) => {
  const taskId = Number(req.params.id);
  const index = store.tasks.findIndex(item => item.id === taskId && item.userId === req.user.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Task not found.' });
  }

  store.tasks.splice(index, 1);
  res.status(204).end();
});

app.get('*', (_req, res) => {
  res.sendFile(join(publicDir, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Task tracker running at http://localhost:${PORT}`);
});