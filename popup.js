// 生成唯一ID
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// 格式化时间
function formatTime(dateStr) {
  const date = new Date(dateStr);
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

// 从Storage加载数据
function loadTodos() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['todos'], (result) => {
      resolve(result.todos || []);
    });
  });
}

// 保存数据到Storage
function saveTodos(todos) {
  chrome.storage.local.set({ todos });
}

// 添加待办
async function addTodo(content) {
  const todos = await loadTodos();
  const newTodo = {
    id: generateId(),
    content: content.trim(),
    isUrgent: false,
    isDone: false,
    createdAt: new Date().toISOString(),
    completedAt: null
  };
  todos.unshift(newTodo);
  saveTodos(todos);
  return newTodo;
}

// 切换紧急状态
async function toggleUrgent(id) {
  const todos = await loadTodos();
  const todo = todos.find(t => t.id === id);
  if (todo) {
    todo.isUrgent = !todo.isUrgent;
    saveTodos(todos);
  }
  return todo;
}

// 标记完成
async function markDone(id) {
  const todos = await loadTodos();
  const todo = todos.find(t => t.id === id);
  if (todo) {
    todo.isDone = true;
    todo.completedAt = new Date().toISOString();
    saveTodos(todos);
  }
  return todo;
}

// 删除单个待办
async function deleteTodo(id) {
  const todos = await loadTodos();
  const filtered = todos.filter(t => t.id !== id);
  saveTodos(filtered);
}

// 清除所有已完成
async function clearDone() {
  const todos = await loadTodos();
  const remaining = todos.filter(t => !t.isDone);
  saveTodos(remaining);
  return remaining;
}

// 当前Tab状态
let currentTab = 'all';

// 渲染列表
function render() {
  loadTodos().then(todos => {
    const allList = document.getElementById('todoList');
    const doneList = document.getElementById('doneList');
    const inputArea = document.getElementById('inputArea');
    const clearArea = document.getElementById('clearArea');

    // 清空列表
    allList.innerHTML = '';
    doneList.innerHTML = '';

    // 根据Tab显示/隐藏元素
    const showDone = currentTab === 'done';
    allList.classList.toggle('hidden', showDone);
    doneList.classList.toggle('hidden', !showDone);
    inputArea.classList.toggle('hidden', showDone);
    clearArea.classList.toggle('hidden', !showDone);

    // 分类
    const activeTodos = todos.filter(t => !t.isDone);
    const doneTodos = todos.filter(t => t.isDone);

    // 渲染全部/紧急列表
    const renderActive = (currentTab === 'urgent')
      ? activeTodos.filter(t => t.isUrgent)
      : activeTodos;

    renderActive.forEach(todo => {
      allList.appendChild(createTodoElement(todo));
    });

    // 渲染已完成列表
    doneTodos.forEach(todo => {
      doneList.appendChild(createDoneElement(todo));
    });
  });
}

// 创建待办项DOM
function createTodoElement(todo) {
  const li = document.createElement('li');
  li.className = 'todo-item' + (todo.isUrgent ? ' urgent' : '');
  li.dataset.id = todo.id;

  li.innerHTML = `
    <input type="checkbox" class="todo-checkbox" ${todo.isDone ? 'checked' : ''}>
    <span class="todo-content">${escapeHtml(todo.content)}</span>
    <div class="todo-meta">
      <span>${formatTime(todo.createdAt)}</span>
      <button class="urgent-btn ${todo.isUrgent ? 'active' : ''}">
        ${todo.isUrgent ? '取消紧急' : '标记紧急'}
      </button>
    </div>
  `;

  // 复选框点击 - 完成
  li.querySelector('.todo-checkbox').addEventListener('click', async () => {
    await markDone(todo.id);
    render();
  });

  // 紧急按钮点击
  li.querySelector('.urgent-btn').addEventListener('click', async () => {
    await toggleUrgent(todo.id);
    render();
  });

  return li;
}

// 创建已完成项DOM
function createDoneElement(todo) {
  const li = document.createElement('li');
  li.className = 'todo-item done';
  li.dataset.id = todo.id;

  const completedTime = todo.completedAt ? formatTime(todo.completedAt) : '';

  li.innerHTML = `
    <input type="checkbox" class="todo-checkbox" checked>
    <span class="todo-content">${escapeHtml(todo.content)}</span>
    <div class="todo-meta">
      <span>完成于 ${completedTime}</span>
    </div>
  `;

  return li;
}

// HTML转义
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 事件绑定
function bindEvents() {
  // 添加按钮
  document.getElementById('addBtn').addEventListener('click', async () => {
    const input = document.getElementById('todoInput');
    const content = input.value.trim();
    if (content) {
      await addTodo(content);
      input.value = '';
      render();
    }
  });

  // 输入框Enter键
  document.getElementById('todoInput').addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
      const content = e.target.value.trim();
      if (content) {
        await addTodo(content);
        e.target.value = '';
        render();
      }
    }
  });

  // Tab切换
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentTab = tab.dataset.tab;
      render();
    });
  });

  // 清除已完成
  document.getElementById('clearDoneBtn').addEventListener('click', () => {
    showConfirm('确定要清除所有已完成项吗？', async () => {
      await clearDone();
      render();
    });
  });
}

// 显示确认弹窗
function showConfirm(message, onConfirm) {
  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';

  overlay.innerHTML = `
    <div class="confirm-box">
      <p>${message}</p>
      <div class="btn-group">
        <button class="cancel-btn">取消</button>
        <button class="confirm-btn">确定</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector('.cancel-btn').addEventListener('click', () => {
    overlay.remove();
  });

  overlay.querySelector('.confirm-btn').addEventListener('click', () => {
    overlay.remove();
    onConfirm();
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.remove();
    }
  });
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  bindEvents();
  render();
});
