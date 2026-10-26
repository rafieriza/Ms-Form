window.addEventListener("load", () => {
  setTimeout(initAutoFillAndTimer, 1500);
});

function initAutoFillAndTimer() {
  const currentUrl = window.location.href;

  chrome.storage.local.get(null, (items) => {
    let activeTask = null;

    for (let key in items) {
      if (key === "projects") continue;
      
      const task = items[key];
      if (task && task.formUrl) {
        if (currentUrl.includes(task.formUrl) || task.formUrl.includes(currentUrl)) {
          activeTask = task;
          break;
        }
      }
    }

    if (!activeTask) {
      const keys = Object.keys(items).filter(k => k !== 'projects' && items[k] && items[k].endTime);
      if (keys.length > 0) {
        activeTask = items[keys[keys.length - 1]];
      }
    }

    if (!activeTask) return;

    if (activeTask.selectedProject) {
      const selectedProjectName = activeTask.selectedProject;
      const projects = items.projects || {};
      const projectData = projects[selectedProjectName];

      if (projectData && projectData.rules && projectData.rules.length > 0) {
        console.log(`[Autofill] Menjalankan autofill untuk project: "${selectedProjectName}"`);
        setTimeout(() => executeAutofill(projectData.rules), 800);
      }
    }

    if (activeTask.endTime) {
      const targetEnd = new Date(activeTask.endTime).getTime();
      createFloatingTimer(targetEnd, activeTask.name);
    }
  });
}

function executeAutofill(rules) {
  const questionBlocks = document.querySelectorAll('[data-automation-id="questionItem"]');

  if (questionBlocks.length === 0) {
    console.warn("[Autofill] Tidak ditemukan blok pertanyaan standar.");
    return;
  }

  questionBlocks.forEach((block) => {
    const titleEl = block.querySelector('[data-automation-id="questionTitle"]');
    if (!titleEl) return;

    const questionText = titleEl.innerText.trim();

    rules.forEach((rule) => {
      if (questionText.toLowerCase().includes(rule.question.toLowerCase())) {
        console.log(`[Autofill] Cocok: "${rule.question}" (Tipe: ${rule.type})`);

        if (rule.type === "Text") {
          fillTextInput(block, rule.value);
        } else if (rule.type === "Choice") {
          fillChoiceInput(block, rule.value);
        } else if (rule.type === "Date") {
          fillDateInput(block, rule.value);
        }
      }
    });
  });
}

function fillTextInput(block, value) {
  const inputEl = block.querySelector('input[data-automation-id="textInput"], textarea');
  if (inputEl) {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    const nativeTextareaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;

    if (inputEl.tagName === 'TEXTAREA' && nativeTextareaValueSetter) {
      nativeTextareaValueSetter.call(inputEl, value);
    } else if (nativeInputValueSetter) {
      nativeInputValueSetter.call(inputEl, value);
    } else {
      inputEl.value = value;
    }

    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    inputEl.dispatchEvent(new Event('blur', { bubbles: true }));
  }
}

function fillChoiceInput(block, targetValue) {
  const options = block.querySelectorAll('input[type="radio"], input[type="checkbox"], [role="radio"], [role="checkbox"]');
  
  options.forEach((opt) => {
    const parentLabel = opt.closest('label') || opt.parentElement;
    const labelText = parentLabel ? parentLabel.innerText.trim() : "";

    if (labelText.toLowerCase().includes(targetValue.toLowerCase())) {
      if (!opt.checked) {
        opt.click();
      }
    }
  });
}

// Handler Tanggal: Mengubah format YYYY-MM-DD menjadi MM/DD/YYYY atau keyword "today"
function fillDateInput(block, value) {
  let dateVal = value;
  
  if (!dateVal || dateVal.toLowerCase() === "today") {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    dateVal = `${mm}/${dd}/${yyyy}`;
  } else if (dateVal.includes('-')) {
    // Ubah dari YYYY-MM-DD (bawaan date picker HTML) ke MM/DD/YYYY (standar MS Forms)
    const parts = dateVal.split('-');
    if (parts.length === 3) {
      const yyyy = parts[0];
      const mm = parts[1];
      const dd = parts[2];
      dateVal = `${mm}/${dd}/${yyyy}`;
    }
  }

  const dateInput = block.querySelector('[data-automation-id="dateContainer"] input, input[role="combobox"]');
  
  if (dateInput) {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(dateInput, dateVal);
    } else {
      dateInput.value = dateVal;
    }

    dateInput.dispatchEvent(new Event('input', { bubbles: true }));
    dateInput.dispatchEvent(new Event('change', { bubbles: true }));
    dateInput.dispatchEvent(new Event('blur', { bubbles: true }));
  }
}

function createFloatingTimer(targetEndTime, taskName) {
  if (document.getElementById('autoSubmitTimerBox')) return;

  const timerBox = document.createElement('div');
  timerBox.id = 'autoSubmitTimerBox';
  timerBox.style.cssText = `
    position: fixed;
    top: 20px;
    left: 20px;
    z-index: 999999;
    background: white;
    padding: 10px 15px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    font-family: Arial, sans-serif;
    text-align: center;
    border: 2px solid #0078d4;
    max-width: 220px;
  `;

  timerBox.innerHTML = `
    <div style="font-weight: bold; font-size: 14px; color: #333;">Auto-Submit Timer</div>
    <div style="font-size: 12px; color: #0078d4; font-weight: bold; margin: 3px 0 6px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${taskName || 'Tugas Form'}">${taskName || 'Tugas Form'}</div>
    <div id="countdownDisplay" style="font-size: 16px; font-weight: bold; color: #d9534f; margin-bottom: 8px;">00:00:00</div>
    <div>
      <button id="stopTimerBtn" style="background: #d9534f; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px;">STOP</button>
    </div>
  `;

  document.body.appendChild(timerBox);

  const display = document.getElementById('countdownDisplay');

  const interval = setInterval(() => {
    const now = Date.now();
    const distance = targetEndTime - now;

    if (distance <= 0) {
      clearInterval(interval);
      display.innerText = "00:00:00";
      triggerSubmit(taskName);
      return;
    }

    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    display.innerText = 
      String(hours).padStart(2, '0') + ":" + 
      String(minutes).padStart(2, '0') + ":" + 
      String(seconds).padStart(2, '0');
  }, 1000);

  document.getElementById('stopTimerBtn').addEventListener('click', () => {
    clearInterval(interval);
    timerBox.remove();
  });
}

function triggerSubmit(taskName) {
  let submitBtn = document.querySelector('button[data-automation-id="submitButton"]');

  if (!submitBtn) {
    const buttons = document.querySelectorAll('button');
    for (let btn of buttons) {
      if (btn.innerText.includes('Kirim') || btn.innerText.includes('Submit')) {
        submitBtn = btn;
        break;
      }
    }
  }

  if (submitBtn) {
    submitBtn.click();
    console.log("Auto-submit berhasil dieksekusi!");

    if (taskName) {
      chrome.runtime.sendMessage({ action: "cleanupTask", taskName: taskName }, (response) => {
        console.log("Cleanup status:", response);
      });
    }
  } else {
    console.log("Tombol submit tidak ditemukan.");
  }
}
