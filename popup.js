document.addEventListener('DOMContentLoaded', () => {
  // --- NAVIGASI TAB ---
  const navHome = document.getElementById('navHome');
  const navProjects = document.getElementById('navProjects');
  const navAlarms = document.getElementById('navAlarms');

  const tabHome = document.getElementById('tabHome');
  const tabProjects = document.getElementById('tabProjects');
  const tabAlarms = document.getElementById('tabAlarms');

  function switchTab(activeTab, activeContent) {
    [navHome, navProjects, navAlarms].forEach(n => n.classList.remove('active'));
    [tabHome, tabProjects, tabAlarms].forEach(c => c.classList.remove('active'));

    activeTab.classList.add('active');
    activeContent.classList.add('active');

    if (activeContent === tabHome) loadProjectDropdown();
    if (activeContent === tabProjects) loadProjectList();
    if (activeContent === tabAlarms) loadAlarmsList();
  }

  navHome.addEventListener('click', () => switchTab(navHome, tabHome));
  navProjects.addEventListener('click', () => switchTab(navProjects, tabProjects));
  navAlarms.addEventListener('click', () => switchTab(navAlarms, tabAlarms));

  // --- HOME / JADWAL FORM ---
  const taskForm = document.getElementById('taskForm');
  const projectSelect = document.getElementById('selectedProject');

  function loadProjectDropdown() {
    chrome.storage.local.get(['projects'], (data) => {
      const projects = data.projects || {};
      projectSelect.innerHTML = '<option value="">-- Tanpa Project (Manual) --</option>';
      
      Object.keys(projects).forEach(projName => {
        const opt = document.createElement('option');
        opt.value = projName;
        opt.textContent = projName;
        projectSelect.appendChild(opt);
      });
    });
  }

  taskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const taskName = document.getElementById('taskName').value.trim();
    const formUrl = document.getElementById('formUrl').value.trim();
    const selectedProject = projectSelect.value;
    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;

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
        taskForm.reset();
        switchTab(navAlarms, tabAlarms);
      } else {
        alert(response?.message || "Gagal menyetel alarm.");
      }
    });
  });

  // --- PROJECTS MANAGEMENT ---
  const saveProjectBtn = document.getElementById('saveProjectBtn');
  const addRuleBtn = document.getElementById('addRuleBtn');
  const rulesContainer = document.getElementById('rulesContainer');
  const existingProjectsList = document.getElementById('existingProjectsList');
  const newProjectNameInput = document.getElementById('newProjectName');

  addRuleBtn.addEventListener('click', () => addRuleRow());

  // Fungsi dinamis untuk membuat baris rule (mendukung input date picker jika tipe Date dipilih)
  function addRuleRow(type = "Text", question = "", value = "") {
    const row = document.createElement('div');
    row.className = 'rule-row';
    row.style.cssText = "display: flex; gap: 8px; margin-bottom: 8px; align-items: center;";

    // Menentukan jenis elemen input value berdasarkan tipe rule
    const getValueInputHTML = (currentType, val) => {
      if (currentType === 'Date') {
        return `<input type="date" class="rule-value" value="${val}" style="flex: 2; padding: 6px;">`;
      }
      return `<input type="text" class="rule-value" placeholder="Value or <now>" value="${val}" style="flex: 2; padding: 6px;">`;
    };

    row.innerHTML = `
      <select class="rule-type" style="flex: 1; padding: 6px;">
        <option value="Text" ${type === 'Text' ? 'selected' : ''}>Text</option>
        <option value="Choice" ${type === 'Choice' ? 'selected' : ''}>Choice</option>
        <option value="Date" ${type === 'Date' ? 'selected' : ''}>Date</option>
      </select>
      <input type="text" class="rule-question" placeholder="Title Question" value="${question}" style="flex: 2; padding: 6px;">
      <div class="value-container" style="flex: 2; display: flex;">
        ${getValueInputHTML(type, value)}
      </div>
      <button type="button" class="delete-rule-btn" style="background: #e74c3c; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer;">-</button>
    `;

    // Event listener untuk mengubah input value secara dinamis saat dropdown tipe rule diubah
    const typeSelect = row.querySelector('.rule-type');
    const valueContainer = row.querySelector('.value-container');

    typeSelect.addEventListener('change', (e) => {
      const selectedType = e.target.value;
      const currentVal = row.querySelector('.rule-value').value;
      valueContainer.innerHTML = getValueInputHTML(selectedType, selectedType === 'Date' ? '' : currentVal);
    });

    row.querySelector('.delete-rule-btn').addEventListener('click', () => row.remove());
    rulesContainer.appendChild(row);
  }

  saveProjectBtn.addEventListener('click', () => {
    const projectName = newProjectNameInput.value.trim();
    if (!projectName) {
      alert("Nama project wajib diisi!");
      return;
    }

    const rows = rulesContainer.querySelectorAll('.rule-row');
    const rules = [];

    rows.forEach(r => {
      rules.push({
        type: r.querySelector('.rule-type').value,
        question: r.querySelector('.rule-question').value.trim(),
        value: r.querySelector('.rule-value').value.trim()
      });
    });

    chrome.storage.local.get(['projects'], (data) => {
      const projects = data.projects || {};
      projects[projectName] = { rules };

      chrome.storage.local.set({ projects }, () => {
        alert(`Project "${projectName}" berhasil disimpan!`);
        newProjectNameInput.value = '';
        rulesContainer.innerHTML = '';
        loadProjectList();
      });
    });
  });

  function loadProjectList() {
    chrome.storage.local.get(['projects'], (data) => {
      const projects = data.projects || {};
      existingProjectsList.innerHTML = '';

      if (Object.keys(projects).length === 0) {
        existingProjectsList.innerHTML = '<p style="color: #666; font-size: 13px;">Belum ada project tersimpan.</p>';
        return;
      }

      Object.keys(projects).forEach(projName => {
        const div = document.createElement('div');
        div.style.cssText = "background: #f9f9f9; border: 1px solid #ddd; padding: 8px; border-radius: 6px; margin-bottom: 6px; display: flex; justify-content: space-between; align-items: center;";
        
        div.innerHTML = `
          <div>
            <strong>${projName}</strong> (${projects[projName].rules.length} rules)
          </div>
          <button class="del-proj" data-name="${projName}" style="background: #e74c3c; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px;">Hapus</button>
        `;

        div.querySelector('.del-proj').addEventListener('click', () => {
          if (confirm(`Hapus project "${projName}"?`)) {
            delete projects[projName];
            chrome.storage.local.set({ projects }, () => loadProjectList());
          }
        });

        existingProjectsList.appendChild(div);
      });
    });
  }

  // --- ALARMS LIST ---
  const alarmsListContainer = document.getElementById('alarmsList');

  function loadAlarmsList() {
    chrome.storage.local.get(null, (items) => {
      alarmsListContainer.innerHTML = '';
      let hasAlarm = false;

      Object.keys(items).forEach(key => {
        if (key === 'projects') return;
        const task = items[key];

        if (task && task.endTime) {
          hasAlarm = true;
          const card = document.createElement('div');
          card.className = 'alarm-card';
          card.style.cssText = "background: #fff; border: 1px solid #ddd; border-left: 4px solid #0078d4; padding: 10px; border-radius: 6px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;";

          const formatDateTime = (ms) => {
            if (!ms) return '-';
            const d = new Date(ms);
            const dateStr = d.toLocaleDateString('id-ID');
            const timeStr = d.toTimeString().split(' ')[0];
            return `${dateStr}, ${timeStr}`;
          };

          const startFormatted = formatDateTime(task.startTime);
          const endFormatted = formatDateTime(task.endTime);

          card.innerHTML = `
            <div>
              <div style="font-weight: bold; color: #333; font-size: 14px;">⏰ ${task.name}</div>
              <div style="font-size: 12px; color: #555; margin-top: 3px;"><strong>Mulai:</strong> ${startFormatted}</div>
              <div style="font-size: 12px; color: #d9534f; margin-top: 1px;"><strong>Berakhir:</strong> ${endFormatted}</div>
              <div style="font-size: 12px; color: #0078d4; margin-top: 3px;">Project: ${task.selectedProject || 'Manual'}</div>
            </div>
            <button class="delete-task-btn" data-name="${task.name}" style="background: #e74c3c; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer;">🗑️</button>
          `;

          card.querySelector('.delete-task-btn').addEventListener('click', () => {
            const taskName = task.name;
            chrome.runtime.sendMessage({ action: "cleanupTask", taskName }, () => {
              loadAlarmsList();
            });
          });

          alarmsListContainer.appendChild(card);
        }
      });

      if (!hasAlarm) {
        alarmsListContainer.innerHTML = '<p style="color: #666; font-size: 13px; text-align: center;">Tidak ada jadwal alarm aktif.</p>';
      }
    });
  }

  // Initial load
  loadProjectDropdown();
});
