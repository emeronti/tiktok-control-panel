// ===== CONFIGURACIÓN =====
const CONFIG = {
    USERNAME: "admin",
    PASSWORD: "booster2024",
    APPS_SCRIPT_URL: "https://script.google.com/macros/s/AKfycbyrNDiK1-A3KSKr8phSQS796h_jx327LacPZkdSwKSnYtQFZaOOmE-IDa1iJNnzRNnX9w/exec"
};

// ===== ELEMENTOS DOM =====
const loginScreen = document.getElementById('login-screen');
const mainPanel = document.getElementById('main-panel');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');

// Tarea
const taskAction = document.getElementById('task-action');
const commentsSection = document.getElementById('comments-section');
const sendTaskBtn = document.getElementById('send-task-btn');
const taskStatus = document.getElementById('task-status');
const durationInput = document.getElementById('task-duration');
const durationBtns = document.querySelectorAll('.dur-btn');
const taskComments = document.getElementById('task-comments');
const btnAiGenerate = document.getElementById('btn-ai-generate');

// Historial y Estado
const historyList = document.getElementById('history-list');
const refreshBtn = document.getElementById('refresh-btn');
const clearHistoryBtn = document.getElementById('clear-history-btn');
const devicesGrid = document.getElementById('devices-grid');
const devicesActive = document.getElementById('devices-active');
const devicesFree = document.getElementById('devices-free');

// Botones de control
const btnUnlock = document.getElementById('btn-unlock');
const btnPause = document.getElementById('btn-pause');
const btnResume = document.getElementById('btn-resume');
const btnStop = document.getElementById('btn-stop');

// ===== AUTENTICACIÓN =====
function hashPassword(pass) {
    let hash = 0;
    for (let i = 0; i < pass.length; i++) {
        const char = pass.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString();
}

function checkAuth() {
    const storedAuth = localStorage.getItem('tiktok_booster_auth');
    if (storedAuth === hashPassword(CONFIG.USERNAME + CONFIG.PASSWORD)) {
        showPanel();
    } else {
        showLogin();
    }
}

function login(username, password) {
    if (username === CONFIG.USERNAME && password === CONFIG.PASSWORD) {
        localStorage.setItem('tiktok_booster_auth', hashPassword(username + password));
        showPanel();
        return true;
    }
    return false;
}

function logout() {
    localStorage.removeItem('tiktok_booster_auth');
    showLogin();
}

function showLogin() {
    loginScreen.classList.add('active');
    mainPanel.classList.remove('active');
}

function showPanel() {
    loginScreen.classList.remove('active');
    mainPanel.classList.add('active');
    loadHistory();
    updateStatus();
    if (!window.statusInterval) {
        window.statusInterval = setInterval(updateStatus, 10000);
    }
}

// ===== EVENT LISTENERS =====
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    if (login(document.getElementById('username').value, document.getElementById('password').value)) {
        loginError.textContent = '';
    } else {
        loginError.textContent = '❌ Credenciales incorrectas';
    }
});

logoutBtn.addEventListener('click', logout);

const durationContainer = document.querySelector('.duration-options');

taskAction.addEventListener('change', () => {
    const action = taskAction.value;

    // 1. Mostrar/Ocultar Comentarios
    const showComments = (action === 'comentarios' || action === 'interaccion'); // Interacción a veces usa
    commentsSection.style.display = action === 'comentarios' ? 'block' : 'none'; // Solo estricto para comentarios masivos

    // 2. Bloquear/Desbloquear Duración
    const allowDuration = (action === 'granja' || action === 'calentar' || action === 'granja_autolink');

    if (allowDuration) {
        durationContainer.classList.remove('disabled');
        durationBtns.forEach(b => b.disabled = false);
        if (!durationInput.value || durationInput.value === '-') {
            // Restaurar default
            durationBtns[0].click();
        }
    } else {
        durationContainer.classList.add('disabled');
        durationBtns.forEach(b => {
            b.classList.remove('active');
            b.disabled = true;
        });
        durationInput.value = '-'; // Valor nulo para el Sheet
    }
    // 3. Bloquear Dispositivos si es Share (Combo permite elegir cantidad para reacciones)
    const devicesInput = document.getElementById('task-devices');
    const isSharePuro = (action === 'share_apoyo' || action === 'share_ataque' || action === 'share_noticiero');

    if (isSharePuro) {
        devicesInput.value = '';
        devicesInput.placeholder = 'Predefinidos';
        devicesInput.disabled = true;
    } else {
        devicesInput.disabled = false;
        if (!devicesInput.value) devicesInput.value = '10';
        devicesInput.placeholder = '';
    }

    // 4. Bloquear Link si es Calentar
    const linkInput = document.getElementById('task-link');
    if (action === 'calentar') {
        linkInput.value = '';
        linkInput.placeholder = 'No necesario para calentar';
        linkInput.disabled = true;
    } else {
        linkInput.disabled = false;
        linkInput.placeholder = '🔗 Links de TikTok (pega varios aquí)...';
    }
});

// Inicializar estado al cargar
taskAction.dispatchEvent(new Event('change'));

// Botones de duración
durationBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        durationBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        durationInput.value = btn.dataset.val;
    });
});

// GENERAR IA (Función Global)
window.generarIA = function () {
    const promptText = prompt("✨ Describe qué comentarios quieres (ej: apoyo a manfred):");
    if (promptText) {
        taskComments.value = `[IA_PROMPT]: ${promptText}`;
        taskComments.focus();
        showStatus('✨ Prompt de IA listo. Se generará al procesar.', 'success');
    }
};

sendTaskBtn.addEventListener('click', sendTask);
refreshBtn.addEventListener('click', loadHistory);

// Limpiar Historial (Local + Visual)
clearHistoryBtn.addEventListener('click', () => {
    if (confirm('¿Borrar historial visual? (No borra del Sheet)')) {
        historyList.innerHTML = '<p class="empty-state">Historial limpio</p>';
    }
});

// Controles
btnUnlock.addEventListener('click', () => sendCommand('desbloquear'));
btnPause.addEventListener('click', () => sendCommand('pausar_todo'));
btnResume.addEventListener('click', () => sendCommand('reanudar_todo'));
btnStop.addEventListener('click', () => {
    if (confirm('⚠️ ¿Detener todo?')) sendCommand('detener_todo');
});

// ===== API & LOGIC =====
async function sendTask() {
    const link = document.getElementById('task-link').value.trim();
    const action = document.getElementById('task-action').value;
    const devices = document.getElementById('task-devices').value;
    const duration = document.getElementById('task-duration').value;
    const comments = document.getElementById('task-comments').value.trim();

    if (!link || !link.startsWith('http')) {
        showStatus('❌ Link inválido', 'error');
        return;
    }

    sendTaskBtn.disabled = true;
    sendTaskBtn.innerHTML = '<span>⏳...</span>';

    try {
        await postData({
            link, accion: action, dispositivos: devices, duracion: duration, comentarios: comments, estado: 'Pendiente'
        });
        showStatus('✅ Enviado', 'success');
        document.getElementById('task-link').value = '';
        setTimeout(loadHistory, 2000);
    } catch (error) {
        showStatus('❌ Error', 'error');
    } finally {
        sendTaskBtn.disabled = false;
        sendTaskBtn.innerHTML = '<span>🚀 ENVIAR</span>';
    }
}

async function sendCommand(command) {
    try {
        showStatus(`⏳...`, 'running');
        await postData({
            link: "CMD", accion: "comando_" + command, dispositivos: "todos", duracion: "-", comentarios: "-", estado: 'Pendiente'
        });
        showStatus(`✅ Comando OK`, 'success');
    } catch (error) {
        showStatus('❌ Error', 'error');
    }
}

async function postData(data) {
    await fetch(CONFIG.APPS_SCRIPT_URL, {
        method: 'POST', mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
}

async function loadHistory() {
    try {
        const response = await fetch(CONFIG.APPS_SCRIPT_URL + '?action=getHistory');
        const data = await response.json();
        if (data && data.length > 0) {
            historyList.innerHTML = data.reverse().slice(0, 20).map(item => {
                const action = item.accion.toLowerCase();
                const icon = getActionEmoji(action);
                const countStr = item.dispositivos ? `${item.dispositivos}C` : '?C';
                const durStr = item.duracion && item.duracion !== '-' ? item.duracion.replace(' horas', 'H').replace(' hora', 'H').toUpperCase() : '1H';

                let tipoDesc = "";
                let showDur = false;

                if (action.includes('combo')) {
                    tipoDesc = "Share, repost, guardado y Like";
                } else if (action.includes('share')) {
                    tipoDesc = "Share";
                } else if (action.includes('interaccion') || action.includes('likes')) {
                    tipoDesc = "repost, guardado y Like";
                } else if (action.includes('comentarios')) {
                    tipoDesc = `${item.dispositivos || '?'} comentarios`;
                } else if (action.includes('granja')) {
                    tipoDesc = "Loop";
                    showDur = true;
                } else if (action.includes('calentar')) {
                    tipoDesc = "Loop FYP";
                    showDur = true;
                } else {
                    tipoDesc = action.toUpperCase();
                }

                const linkLabel = item.link.split('?')[0].slice(0, 30) + (item.link.length > 30 ? '...' : '');

                // Formato de copia según pedido (2 líneas) - Link completo
                const copyLink = item.link.split('?')[0];
                let copyText = showDur
                    ? `${copyLink}\n${tipoDesc} - ${countStr} - ${durStr}`
                    : `${copyLink}\n${tipoDesc} - ${countStr}`;

                return `
                <div class="history-item">
                    <div class="history-icon">${icon}</div>
                    <div class="info">
                        <div class="action-row">
                            <span class="action-name">${action.replace('comando_', '').toUpperCase()}</span>
                            <span class="action-details">📱 ${countStr}${showDur ? ' | ⏱️ ' + durStr : ''}</span>
                        </div>
                        <div class="link-row">
                            <span class="link-text" onclick="copyToClipboard('${item.link}')">${linkLabel}</span>
                            <span style="font-size: 9px; color: var(--text-secondary); display: block; margin-top: 2px;">${tipoDesc}</span>
                        </div>
                    </div>
                    <div class="history-actions-row">
                        <button class="btn-copy-mini" onclick="copyToClipboard(\`${copyText}\`)">📋</button>
                        <span class="status-icon" title="${item.estado}">${getStatusIcon(item.estado)}</span>
                    </div>
                </div>
            `;
            }).join('');
        }
    } catch (e) {
        console.error(e);
    }
}

async function updateStatus() {
    try {
        const response = await fetch(CONFIG.APPS_SCRIPT_URL + '?action=getStatus');
        const data = await response.json();

        if (data && Array.isArray(data)) {
            let activeCount = 0;
            let freeCount = 0;

            const devices = data.map(d => {
                const match = d.dispositivo.match(/\.(\d+):/);
                const num = match ? parseInt(match[1]) : d.dispositivo.slice(-4);
                return { ...d, num, raw: d.dispositivo };
            }).sort((a, b) => a.num - b.num);

            devicesGrid.innerHTML = devices.map(d => {
                const isActive = d.estado && d.estado.includes('En uso');
                if (isActive) activeCount++; else freeCount++;

                return `
                    <div class="device-dot ${isActive ? 'active' : ''}">
                        ${d.num}
                    </div>
                `;
            }).join('');

            devicesActive.textContent = activeCount;
            devicesFree.textContent = freeCount;
        }
    } catch (e) { console.error(e); }
}

function showStatus(msg, type) {
    taskStatus.textContent = msg;
    taskStatus.style.color = type === 'error' ? '#ff1744' : '#00e676';
    setTimeout(() => taskStatus.textContent = '', 3000);
}

function getStatusIcon(st) {
    if (st.toLowerCase().includes('completado')) return '✅';
    if (st.toLowerCase().includes('pendiente')) return '⏳';
    if (st.toLowerCase().includes('curso')) return '⚙️';
    if (st.toLowerCase().includes('error')) return '❌';
    return '❓';
}

function getActionEmoji(a) {
    if (a.includes('combo')) return '🥊';
    if (a.includes('share')) return '🔄';
    if (a.includes('interaccion')) return '❤️';
    if (a.includes('granja')) return '🌾';
    if (a.includes('calentar')) return '🔥';
    if (a.includes('comentarios')) return '💬';
    if (a.includes('comando')) return '⚡';
    if (a.includes('noticiero')) return '📡';
    return '📱';
}

// Util para copiar
window.copyToClipboard = (text) => {
    if (text === 'CMD') return;
    navigator.clipboard.writeText(text).then(() => {
        showStatus('📋 Link copiado', 'success');
    });
};

document.addEventListener('DOMContentLoaded', checkAuth);
