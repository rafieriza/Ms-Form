// Tunggu hingga halaman Microsoft Forms benar-benar siap dan termuat
window.addEventListener("load", () => {
  setTimeout(initAutoFillAndTimer, 1500);
});

function initAutoFillAndTimer() {
  const currentUrl = window.location.href;
  const now = Date.now();

  // 1. Ambil data tugas aktif dari chrome.storage.local
  chrome.storage.local.get(null, (items) => {
    let activeTask = null;
    const matchedTasks = [];

    // Kumpulkan semua task yang URL-nya cocok dengan halaman saat ini
    for (let key in items) {
      if (key === "projects") continue; // Abaikan data master project
      
      const task = items[key];
      if (task && task.formUrl) {
        if (currentUrl.includes(task.formUrl) || task.formUrl.includes(currentUrl)) {
          matchedTasks.push(task);
        }
      }
    }

    if (matchedTasks.length === 0) return;

    // Prioritaskan task yang waktu 'now' sedang berada di dalam rentang startTime & endTime-nya
    for (let task of matchedTasks) {
      if (task.startTime && task.endTime) {
        const start = new Date(task.startTime).getTime();
        const end = new Date(task.endTime).getTime();

        if (!isNaN(start) && !isNaN(end) && now >= start && now <= end) {
          activeTask = task;
          break;
        }
      }
    }

    // Jika belum masuk rentang waktu atau pas-pasan, ambil task berdasarkan urutan waktu mulai terdekat
    if (!activeTask) {
      matchedTasks.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
      activeTask = matchedTasks[0];
    }

    if (!activeTask) return;

    // 2. Jika tugas ini menggunakan Project Autofill, jalankan mesin pengisi form
    if (activeTask.selectedProject) {
      const selectedProjectName = activeTask.selectedProject;
      const projects = items.projects || {};
      const projectData = projects[selectedProjectName];

      if (projectData && projectData.rules && projectData.rules.length > 0) {
        console.log(`[Autofill] Menjalankan autofill untuk project: "${selectedProjectName}"`);
        setTimeout(() => executeAutofill(projectData.rules), 800);
      }
    }

    // 3. Jalankan Floating Timer sesuai target end time task aktif tersebut
    if (activeTask.endTime) {
      const targetEnd = new Date(activeTask.endTime).getTime();
      if (!isNaN(targetEnd)) {
        createFloatingTimer(targetEnd, activeTask.name);
      }
    }
  });
}

// ==========================================
// MESIN AUTOFILL MICROSOFT FORMS
// ==========================================
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

// Handler Tipe Teks (Nama & NIM)
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

// Handler Tipe Pilihan Ganda / Checkbox
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

// Handler Tipe Tanggal (Mensimulasikan pengetikan karakter nyata satu-persatu untuk melumpuhkan state React ms-DatePicker)
function fillDateInput(block, value) {
  let dateVal = value ? value.trim() : "";
  
  if (!dateVal || dateVal.toLowerCase() === "today" || dateVal.toLowerCase() === "<now>") {
    const today = new Date();
    const mm = today.getMonth() + 1;
    const dd = today.getDate();
    const yyyy = today.getFullYear();
    dateVal = `${mm}/${dd}/${yyyy}`;
  }

  // Targetkan secara persis combobox input tanggal di MS Forms sesuai struktur HTML lu
  const dateInput = block.querySelector('input[role="combobox"], [data-automation-id="dateContainer"] input, input[type="text"]');
  
  if (dateInput) {
    // 1. Fokuskan dan klik untuk membuka interaksi
    dateInput.focus();
    dateInput.click();
    dateInput.value = '';

    // 2. Set nilai via native setter agar React mendeteksi perubahan awal
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(dateInput, dateVal);
    } else {
      dateInput.value = dateVal;
    }

    // 3. Tembakkan event input standar
    dateInput.dispatchEvent(new Event('focus', { bubbles: true }));
    dateInput.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: dateVal }));
    dateInput.dispatchEvent(new Event('change', { bubbles: true }));

    // 4. Simulasi ketikan keyboard per karakter (supaya state combobox React Forms "menerima" ketikan tersebut)
    for (let i = 0; i < dateVal.length; i++) {
      const char = dateVal[i];
      dateInput.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: char, char: char }));
      dateInput.dispatchEvent(new KeyboardEvent('keypress', { bubbles: true, key: char, char: char }));
      dateInput.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: char, char: char }));
    }

    // 5. Kunci dengan tombol Enter agar popup kalender tertutup dan nilai tersimpan
    dateInput.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter', code: 'Enter', keyCode: 13 }));
    dateInput.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'Enter', code: 'Enter', keyCode: 13 }));
    
    dateInput.dispatchEvent(new Event('blur', { bubbles: true }));
    console.log(`[Autofill] Berhasil menyuntikkan tanggal via keystroke: ${dateVal}`);
  } else {
    console.warn("[Autofiktif] Kotak input tanggal combobox tidak ditemukan!");
  }
}

// ==========================================
// FLOATING TIMER & AUTO-SUBMIT
// ==========================================
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

  // Tombol STOP: Membersihkan timer sekaligus menghapus data alarm dari storage secara tuntas
  document.getElementById('stopTimerBtn').addEventListener('click', () => {
    clearInterval(interval);
    timerBox.remove();
    
    if (taskName) {
      chrome.runtime.sendMessage({ action: "cleanupTask", taskName: taskName }, (response) => {
        console.log("Task stopped and cleaned up:", response);
      });
    }
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
