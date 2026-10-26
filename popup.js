document.addEventListener('DOMContentLoaded', () => {
  const navHome = document.getElementById('navHome');
  const navProjects = document.getElementById('navProjects');
  const navAlarms = document.getElementById('navAlarms');

  const homeView = document.getElementById('homeView');
  const projectsView = document.getElementById('projectsView');
  const alarmsView = document.getElementById('alarmsView');

  const projectListView = document.getElementById('projectListView');
  const projectEditorView = document.getElementById('projectEditorView');
  const newProjectBtn = document.getElementById('newProjectBtn');
  const backToProjectsBtn = document.getElementById('backToProjectsBtn');

  function switchTab(activeNav, activeSection) {
    [navHome, navProjects, navAlarms].forEach(n => n.classList.remove('active'));
    [homeView, projectsView, alarmsView].forEach(v => v.style.display = 'none');

    activeNav.classList.add('active');
    activeSection.style.display = 'block';

    if (activeSection === homeView) loadProjectDropdown();
    if (activeSection === projectsView) {
      projectListView.style.display = 'block';
      projectEditorView.style.display = 'none';
      loadProjectList();
    }
    if (activeSection === alarmsView) loadAlarmsList();
  }

  navHome.addEventListener('click', () => switchTab(navHome, homeView));
  navProjects.addEventListener('click', () => switchTab(navProjects, projectsView));
  navAlarms.addEventListener('click', () => switchTab(navAlarms, alarmsView));

  newProjectBtn.addEventListener('click', () => {
    projectListView.style.display = 'none';
    projectEditorView.style.display = 'block';
    editProjectNameInput.value = '';
    rulesContainer.innerHTML = '';
    addRuleRow();
  });

  backToProjectsBtn.addEventListener('click', () => {
    projectEditorView.style.display = 'none';
    projectListView.style.display = 'block';
    loadProjectList();
  });

  const startTimeInput = document.getElementById('startTime');
  const endTimeInput = document.getElementById('endTime');

  function validateTimes() {
    const startVal = new Date(startTimeInput.value).getTime();
    const endVal = new Date(endTimeInput.value).getTime();
    const now = Date.now();

    if (startTimeInput.value) {
      if (startVal < now) {
        startTimeInput.classList.add('error-border');
      } else {
        startTimeInput.classList.remove('error-border');
      }
    }

    if (startTimeInput.value && endTimeInput.value) {
      if (endVal <= startVal) {
        endTimeInput.classList.add('error-border');
      } else {
        endTimeInput.classList.remove('error-border');
      }
    }
  }

  startTimeInput.addEventListener('input', validateTimes);
  endTimeInput.addEventListener('input', validateTimes);

  const projectSelect = document.getElementById('selectedProject');
  const submitBtn = document.getElementById('submitBtn');
  const resetBtn = document.getElementById('resetBtn');

  function loadProjectDropdown() {
    chrome.storage.local.get(['projects'], (data) => {
      const projects = data.projects || {};
      projectSelect.innerHTML = '<option value="">-- Tanpa Autofill (Manual) --</option>';
      
      Object.keys(projects).forEach(projName => {
        const opt = document.createElement('option');
        opt.value = projName;
        opt.textContent = projName;
        projectSelect.appendChild(opt);
      });
    });
  }

  submitBtn.addEventListener('click', () => {
    const taskName = document.getElementById('taskName').value.trim();
    const formUrl = document.getElementById('formUrl').value.trim();
    const selectedProject = projectSelect.value;
    const startTime = startTimeInput.value;
    const endTime = endTimeInput.value;

    if (!taskName || !formUrl || !startTime || !endTime) {
      alert("Semua field wajib diisi!");
      return;
    }

    chrome.runtime.sendMessage({
      action: "setAlarm",
      taskName,
      formUrl,
      selectedProject,
      startTime,
      endTime
    }, (response) => {
      if (response && response.status === "success") {
        alert(response.message);
        document.getElementById('taskName').value = '';
        document.getElementById('formUrl').value = '';
        startTimeInput.value = '';
        endTimeInput.value = '';
        startTimeInput.classList.remove('error-border');
        endTimeInput.classList.remove('error-border');
        projectSelect.value = '';
        switchTab(navAlarms, alarmsView);
      } else {
        alert(response?.message || "Gagal menyetel alarm.");
      }
    });
  });

  resetBtn.addEventListener('click', () => {
    document.getElementById('taskName').value = '';
    document.getElementById('formUrl').value = '';
    startTimeInput.value = '';
    endTimeInput.value = '';
    startTimeInput.classList.remove('error-border');
    endTimeInput.classList.remove('error-border');
    projectSelect.value = '';
  });

  const saveProjectBtn = document.getElementById('saveProjectBtn');
  const addRuleBtn = document.getElementById('addRuleBtn');
  const rulesContainer = document.getElementById('rulesContainer');
  const projectListContainer = document.getElementById('projectList');
  const editProjectNameInput = document.getElementById('editProjectName');

  addRuleBtn.addEventListener('click', () => addRuleRow());

  function addRuleRow(type = "Text", question = "", value = "") {
    const row = document.createElement('div');
    row.className = 'rule-row';

    const getValueInputHTML = (currentType, val) => {
      // Jika tipe Date, gunakan input text bebas agar user bisa ketik "today" atau format manual "M/d/yyyy"
      if (currentType === 'Date') {
        return `<input type="text" class="rule-value" placeholder="today or M/d/yyyy" value="${val}">`;
      }
      return `<input type="text" class="rule-value" placeholder="Value or today" value="${val}">`;
    };

    row.innerHTML = `
      <select class="rule-type">
        <option value="Text" ${type === 'Text' ? 'selected' : ''}>Text</option>
        <option value="Choice" ${type === 'Choice' ? 'selected' : ''}>Choice</option>
        <option value="Date" ${type === 'Date' ? 'selected' : ''}>Date</option>
      </select>
      <input type="text" class="rule-question" placeholder="Title Question" value="${question}">
      <div class="value-container">
        ${getValueInputHTML(type, value)}
      </div>
      <button type="button" class="delete-rule-btn" style="background: #e74c3c; color: white; border: none; padding: 5px 8px; border-radius: 4px; cursor: pointer;">-</button>
    `;

    const typeSelect = row.querySelector('.rule-type');
    const valueContainer = row.querySelector('.value-container');

    typeSelect.addEventListener('change', (e) => {
      const selectedType = e.target.value;
      const currentVal = row.querySelector('.rule-value') ? row.querySelector('.rule-value').value : '';
      valueContainer.innerHTML = getValueInputHTML(selectedType, currentVal);
    });

    row.querySelector('.delete-rule-btn').addEventListener('click', () => row.remove());
    rulesContainer.appendChild(row);
  }

  saveProjectBtn.addEventListener('click', () => {
    const projectName = editProjectNameInput.value.trim();
    if (!projectName) {
      alert("Nama project wajib diisi!");
      return;
    }

    const rows = rulesContainer.querySelectorAll('.rule-row');
    const rules = [];

    rows.forEach(r => {
      const valInput = r.querySelector('.rule-value');
      rules.push({
        type: r.querySelector('.rule-type').value,
        question: r.querySelector('.rule-question').value.trim(),
        value: valInput ? valInput.value.trim() : ""
      });
    });

    chrome.storage.local.get(['projects'], (data) => {
      const projects = data.projects || {};
      projects[projectName] = { rules };

      chrome.storage.local.set({ projects }, () => {
        alert(`Project "${projectName}" berhasil disimpan!`);
        projectEditorView.style.display = 'none';
        projectListView.style.display = 'block';
        loadProjectList();
      });
    });
  });

  function loadProjectList() {
    chrome.storage.local.get(['projects'], (data) => {
      const projects = data.projects || {};
      projectListContainer.innerHTML = '';

      if (Object.keys(projects).length === 0) {
        projectListContainer.innerHTML = '<p class="no-data">Belum ada project autofill.</p>';
        return;
      }

      Object.keys(projects).forEach(projName => {
        const card = document.createElement('div');
        card.className = 'card-item';
        
        card.innerHTML = `
          <div class="card-info">
            <p class="card-title">${projName}</p>
            <p class="card-subtitle">${projects[projName].rules.length} aturan isian</p>
          </div>
          <div>
            <button class="edit-btn" data-name="${projName}">Edit</button>
            <button class="delete-btn" data-name="${projName}" style="font-size: 14px;">🗑️</button>
          </div>
        `;

        card.querySelector('.edit-btn').addEventListener('click', () => {
          editProjectNameInput.value = projName;
          rulesContainer.innerHTML = '';
          projectListView.style.display = 'none';
          projectEditorView.style.display = 'block';

          const rules = projects[projName].rules || [];
          if (rules.length > 0) {
            rules.forEach(rule => addRuleRow(rule.type, rule.question, rule.value));
          } else {
            addRuleRow();
          }
        });

        card.querySelector('.delete-btn').addEventListener('click', () => {
          if (confirm(`Hapus project "${projName}"?`)) {
            delete projects[projName];
            chrome.storage.local.set({ projects }, () => loadProjectList());
          }
        });

        projectListContainer.appendChild(card);
      });
    });
  }

  const alarmListContainer = document.getElementById('alarmList');

  function loadAlarmsList() {
    chrome.storage.local.get(null, (items) => {
      alarmListContainer.innerHTML = '';
      let hasAlarm = false;

      Object.keys(items).forEach(key => {
        if (key === 'projects') return;
        const task = items[key];

        if (task && task.endTime) {
          hasAlarm = true;
          const card = document.createElement('div');
          card.className = 'card-item';

          const formatDateTime = (ms) => {
            if (!ms) return '-';
            const d = new Date(ms);
            return `${d.toLocaleDateString('id-ID')}, ${d.toTimeString().split(' ')[0]}`;
          };

          card.innerHTML = `
            <div class="card-info" style="max-width: 210px;">
              <p class="card-title">⏰ ${task.name}</p>
              <p class="card-subtitle"><strong>Mulai:</strong> ${formatDateTime(task.startTime)}</p>
              <p class="card-subtitle" style="color: #d9534f;"><strong>Berakhir:</strong> ${formatDateTime(task.endTime)}</p>
              <p class="card-subtitle" style="color: #0078d4;">Project: ${task.selectedProject || 'Manual'}</p>
            </div>
            <button class="delete-btn" data-name="${task.name}">🗑️</button>
          `;

          card.querySelector('.delete-btn').addEventListener('click', () => {
            chrome.runtime.sendMessage({ action: "cleanupTask", taskName: task.name }, () => {
              loadAlarmsList();
            });
          });

          alarmListContainer.appendChild(card);
        }
      });

      if (!hasAlarm) {
        alarmListContainer.innerHTML = '<p class="no-data">Belum ada alarm tersimpan.</p>';
      }
    });
  }

  loadProjectDropdown();
});
