(async function main() {
  const scriptVersion = "v1.2.0";
  checkScriptVersion();
  let scriptStatus = "En attente de lancement";
  let scriptError = false;
  let currentUrl = window.location.href;
  let currentPageHtml = null;
  let pageCount = 0;
  let deletedStandardCount = 0;
  let deletedGtaCount = 0;
  let deletedTotalCount = 0;
  let deletedByScriptCount = 0;
  let ignoredByFiltersCount = 0;
  let totalMessagesCount = 0;
  let error503Count = 0;
  let waitingSeconds = 0;
  let waitingInterval = null;
  let isPaused = false;
  let isPendingRequest = false;
  let lastPageAnalyzed = false;
  let pageFullyProcessed = false;
  let isProcessingMessages = false;
  let filterOptions = {
    maxDate: null,
    noDeleteOwnTopicsAndMessages: false,
    minMessageLength: null,
  };
  let startTime = null;
  const processedMessages = new Set();
  const failedMessages = new Set();
  const failedAfterRetry = new Set();
  const hash = document.querySelector('#ajax_hash_moderation_forum')?.value;

  if (!hash) {
    console.error('Impossible de récupérer le hash correspondant.');
    scriptError = true;
    scriptStatus = "Impossible de récupérer le hash correspondant";
    updateUI();
    throw new Error('Arrêt du script.');
  }

  const ui = document.createElement('div');
  ui.style.position = 'fixed';
  ui.style.top = '50%';
  ui.style.left = '50%';
  ui.style.transform = 'translate(-50%, -50%)';
  ui.style.padding = '15px';
  ui.style.background = '#000';
  ui.style.color = 'white';
  ui.style.borderRadius = '10px';
  ui.style.fontFamily = 'Arial, sans-serif';
  ui.style.fontSize = '12px';
  ui.style.zIndex = '10000';
  ui.style.minWidth = '300px';
  document.body.appendChild(ui);

  const blurBackground = document.createElement('div');
  blurBackground.style.position = 'fixed';
  blurBackground.style.top = '0';
  blurBackground.style.left = '0';
  blurBackground.style.width = '100%';
  blurBackground.style.height = '100%';
  blurBackground.style.backdropFilter = 'blur(5px)';
  blurBackground.style.zIndex = '9999';
  blurBackground.style.background = 'rgba(0, 0, 0, 0.2)';
  document.body.appendChild(blurBackground);

  const controls = document.createElement('div');
  controls.id = 'controls';
  controls.style.position = 'fixed';
  controls.style.left = '50%';
  controls.style.display = 'flex';
  controls.style.flexDirection = 'row';
  controls.style.width = '300px';
  controls.style.gap = '10px';
  controls.style.zIndex = '10000';
  document.body.appendChild(controls);

  const statusDisplay = document.createElement('div');
  statusDisplay.id = 'status-display';
  ui.appendChild(statusDisplay);

  if (!document.getElementById('ui-style')) {
    const style = document.createElement('style');
    style.id = 'ui-style';
    style.textContent = `
      #controls {
        top: calc(50% + 200px);
        transform: translateX(-50%);
        max-width: 90vw;
        width: 400px;
        gap: 8px;
      }
      #controls button {
        flex: 1;
        margin: 0;
        padding: 10px 6px;
        background: rgba(0, 0, 0, 0.85);
        border: none;
        border-radius: 8px;
        color: white;
        font-size: 14px;
        cursor: pointer;
        box-shadow: 0 0 6px rgba(0, 0, 0, 0.4);
        transition: box-shadow 0.3s, background 0.3s, color 0.3s;
      }
      #controls button.btn-disabled {
        cursor: not-allowed;
        opacity: 0.4;
      }
      #controls button:not(.btn-disabled):hover {
        background: rgba(0, 0, 0, 0.95);
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.7);
        color: #ddd;
      }
      #status-display {
        font-family: Arial, sans-serif;
        font-size: 16px;
        line-height: 1.3;
        max-width: 90vw;
        width: 400px;
        padding: 20px 15px;
        background: rgba(0, 0, 0, 0.85);
        border-radius: 12px;
        color: white;
        user-select: none;
      }
      #status-display h4 {
        font-size: 18px;
        margin-bottom: 10px;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      #status-display p {
        margin: 4px 0;
      }
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      #status-display .progress-bar {
        position: relative;
        width: 100%;
        height: 24px;
        background: #222;
        border-radius: 12px;
        overflow: hidden;
        font-size: 14px;
        color: white;
        user-select: none;
        margin-top: 12px;
      }
      #status-display .progress-fill {
        width: 0;
        height: 100%;
        background: linear-gradient(270deg, #4caf50, #81c784, #4caf50);
        background-size: 200% 100%;
        animation: gradientMove 3s linear infinite;
        transition: width 0.6s ease-in-out;
      }
      @keyframes gradientMove {
        0% { background-position: 0% 50%; }
        100% { background-position: 200% 50%; }
      }
      #status-display .progress-label {
        position: absolute;
        top: 0; left: 0;
        width: 100%; height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        pointer-events: none;
      }
      .settings-icon {
        cursor: pointer;
        font-size: 18px;
        color: #aaa;
        transition: color 0.3s;
      }
      .settings-icon:hover {
        color: #fff;
      }
      .modal {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.9);
        padding: 20px;
        border-radius: 12px;
        z-index: 10001;
        color: white;
        font-family: Arial, sans-serif;
        min-width: 300px;
        max-width: 400px;
      }
      .modal h4 {
        margin: 0 0 15px;
        font-size: 18px;
      }
      .modal label {
        display: block;
        margin: 0;
      }
      .modal input[type="date"],
      .modal input[type="number"] {
        width: 100%;
        padding: 8px;
        border-radius: 5px;
        border: none;
        background: #333;
        color: white;
      }
      .modal label:nth-of-type(2) {
        margin-top: 10px;
      }
      .modal label:nth-of-type(3) {
        margin-top: 10px;
      }
      .modal button {
        padding: 10px;
        margin: 5px;
        border: none;
        border-radius: 8px;
        background: rgba(0, 0, 0, 0.85);
        color: white;
        cursor: pointer;
      }
      .modal button:hover {
        background: rgba(0, 0, 0, 0.95);
      }
      .modal label[title]:hover:after {
        content: attr(title);
        position: absolute;
        background: #333;
        color: white;
        padding: 5px 10px;
        border-radius: 4px;
        font-size: 12px;
        z-index: 10002;
        white-space: nowrap;
        margin-left: 10px;
        margin-top: -5px;
      }
    `;
    document.head.appendChild(style);
  }

  controls.innerHTML = `
    <button class="pause" style="display: none;">Pause</button>
    <button class="resume" style="display: none;">Reprendre</button>
    <button class="start">Lancer la suppression</button>
  `;
  const pauseButton = controls.querySelector('button.pause');
  const resumeButton = controls.querySelector('button.resume');
  const startButton = controls.querySelector('button.start');

  let estimatedRemainingTime = null;
  let totalPages = null;

  const header = document.createElement('h4');
  header.style.margin = '0';
  header.style.fontSize = '16px';
  header.innerHTML = `
    <span style="font-size: 13px; color: #aaa; margin-right: 8px;">${scriptVersion}</span>
    <span>Delete-all-posts.js</span>
    <span class="settings-icon">⚙️</span>
  `;

  statusDisplay.appendChild(header);
  const dynamicContent = document.createElement('div');
  dynamicContent.id = 'dynamic-content';
  statusDisplay.appendChild(dynamicContent);

  const settingsModal = document.createElement('div');
  settingsModal.className = 'modal';
  settingsModal.style.display = 'none';
  settingsModal.innerHTML = `
    <h4>Options de suppression</h4>
    <label>
      Supprimer uniquement les messages antérieurs à :
      <input type="date" id="max-date">
    </label>
    <label style="display: flex; align-items: center; justify-content: space-between; gap: 10px;">
    <span title="Supprime uniquement les messages de moins de X caractères (hors espaces, liens (stickers compris), monosmiley et citations).">Supprime uniquement si moins de :</span>
      <input type="number" id="min-message-length" min="0" placeholder="Caractères" style="width: 110px;">
    </label>
    <label>
      <input type="checkbox" id="no-delete-own-topics-and-messages">
      Ne pas supprimer mes topics ni leurs messages
    </label>
    <div style="text-align: right;">
      <button id="save-settings">Enregistrer</button>
      <button id="cancel-settings">Annuler</button>
    </div>
  `;
  document.body.appendChild(settingsModal);

  const maxDateInput = settingsModal.querySelector('#max-date');
  const noDeleteOwnTopicsAndMessagesCheckbox = settingsModal.querySelector('#no-delete-own-topics-and-messages');
  const minMessageLengthInput = settingsModal.querySelector('#min-message-length');
  const saveSettingsButton = settingsModal.querySelector('#save-settings');
  const cancelSettingsButton = settingsModal.querySelector('#cancel-settings');

  const settingsIcon = header.querySelector('.settings-icon');
  settingsIcon.className = 'settings-icon';
  settingsIcon.style.marginLeft = '8px';
  settingsIcon.addEventListener('click', () => {
    maxDateInput.value = filterOptions.maxDate ? filterOptions.maxDate.toISOString().split('T')[0] : '';
    noDeleteOwnTopicsAndMessagesCheckbox.checked = filterOptions.noDeleteOwnTopicsAndMessages;
    minMessageLengthInput.value = filterOptions.minMessageLength || '';
    settingsModal.style.display = 'block';
    blurBackground.style.zIndex = '10000';
    pauseButton.style.display = 'none';
    resumeButton.style.display = 'none';
    startButton.style.display = scriptStatus === "En attente de lancement" ? '' : 'none';
  });

  header.appendChild(settingsIcon);

  cancelSettingsButton.addEventListener('click', () => {
    settingsModal.style.display = 'none';
    blurBackground.style.zIndex = '9999';
    updateUI();
  });

  saveSettingsButton.addEventListener('click', () => {
    const inputDate = maxDateInput.value;
    let maxDate = null;
    if (inputDate) {
      const [year, month, day] = inputDate.split('-').map(Number);
      maxDate = new Date(Date.UTC(year, month - 1, day));
      if (isNaN(maxDate.getTime())) {
        maxDate = null;
      }
    }
    filterOptions.maxDate = maxDate;
    filterOptions.noDeleteOwnTopicsAndMessages = noDeleteOwnTopicsAndMessagesCheckbox.checked;
    const minLengthInput = minMessageLengthInput.value;
    filterOptions.minMessageLength = minLengthInput ? parseInt(minLengthInput, 10) : null;
    settingsModal.style.display = 'none';
    blurBackground.style.zIndex = '9999';
    updateUI();
  });

  startButton.addEventListener('click', async () => {
    startTime = Date.now();
    scriptStatus = "En cours d'exécution";
    startButton.style.display = 'none';
    pauseButton.style.display = '';
    resumeButton.style.display = '';
    pauseButton.classList.remove('btn-disabled');
    resumeButton.classList.add('btn-disabled');
    pauseButton.disabled = false;
    resumeButton.disabled = true;
    updateUI();
    await navigateToNextPage(currentUrl);
  });

  pauseButton.addEventListener('click', () => {
    if (!isPaused) {
      isPaused = true;
      scriptStatus = "En pause";
      updateUI();
    }
  });

  resumeButton.addEventListener('click', () => {
    if (isPaused && !isPendingRequest && waitingSeconds <= 0 && !isProcessingMessages) {
      isPaused = false;
      scriptStatus = "En cours d'exécution";
      updateUI();
      resumeScript();
    }
  });

  function extractPseudo(url) {
    const match = url.match(/\/profil\/([^\/?]+)/i);
    if (match) return match[1].toLowerCase();
    return null;
  }

  async function fetchTotalMessagesCount(pseudo, maxAttempts = 5) {
    let attempt = 0;

    const startButton = document.querySelector('button.start');
    if (startButton) startButton.style.display = 'none';

    let spinner = document.getElementById('loading-spinner');
    if (!spinner) {
      spinner = document.createElement('div');
      spinner.id = 'loading-spinner';
      spinner.style.position = 'fixed';
      spinner.style.top = '50%';
      spinner.style.left = '50%';
      spinner.style.transform = 'translate(-50%, -50%)';
      spinner.style.zIndex = '10001';
      spinner.style.display = 'none';
      spinner.innerHTML = `
        <div style="width: 48px; height: 48px; border: 5px solid rgba(255, 255, 255, 0.3); border-top: 5px solid #4caf50; border-radius: 50%; animation: spinModern 1s ease-in-out infinite; box-shadow: 0 0 10px rgba(0,0,0,0.4);"></div>`;
      document.body.appendChild(spinner);

      const style = document.createElement('style');
      style.textContent = `
        @keyframes spinModern {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }`;
      document.head.appendChild(style);
    }

    spinner.style.display = 'block';

    while (attempt < maxAttempts) {
      try {
        const infosUrl = `https://www.jeuxvideo.com/profil/${pseudo}?mode=infos`;
        const response = await fetch(infosUrl);

        if (response.status === 429) {
          console.warn(`Tentative ${attempt + 1} : Erreur 429 (trop de requêtes), attente de 10s avant de retenter.`);
          attempt++;
          await new Promise(resolve => setTimeout(resolve, 10000));
          continue;
        }

        if (!response.ok) throw new Error(`Erreur ${response.status} sur le profil.`);

        const text = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');
        const elements = [...doc.querySelectorAll('ul.display-line-lib li')];
        for (const li of elements) {
          const label = li.querySelector('.info-lib')?.textContent.trim();
          if (label === "Messages Forums :") {
            const value = li.querySelector('.info-value')?.textContent.trim();
            if (value) {
              const numStr = value.replace(/[^\d]/g, '');
              const totalMessages = parseInt(numStr, 10);
              if (!isNaN(totalMessages)) {
                spinner.style.display = 'none';
                if (startButton) startButton.style.display = '';
                return totalMessages;
              }
            }
          }
        }

        spinner.style.display = 'none';
        if (startButton) startButton.style.display = '';
        return null;
      } catch (e) {
        attempt++;
        if (attempt < maxAttempts) {
          console.warn(`Tentative ${attempt} échouée, attente de 10s avant de retenter.`, e);
          await new Promise(resolve => setTimeout(resolve, 10000));
        } else {
          console.error('Erreur lors de la récupération du nombre total de messages après plusieurs tentatives.', e);
          spinner.style.display = 'none';
          if (startButton) startButton.style.display = '';
          return null;
        }
      }
    }

    spinner.style.display = 'none';
    if (startButton) startButton.style.display = '';
    return null;
  }

  function formatTime(seconds) {
    return new Date(seconds * 1000).toISOString().substr(11, 8);
  }

  function startWaitingTimer(seconds) {
    clearInterval(waitingInterval);
    waitingSeconds = seconds;
    updateUI();
    waitingInterval = setInterval(() => {
      waitingSeconds--;
      updateUI();
      if (waitingSeconds <= 0) {
        clearInterval(waitingInterval);
        waitingInterval = null;
        updateUI();
      }
    }, 1000);
  }

  function updateUI() {
    const deletedStandardPercentage = totalMessagesCount ? ((deletedStandardCount / totalMessagesCount) * 100).toFixed(2) : 0;
    const deletedGtaPercentage = totalMessagesCount ? ((deletedGtaCount / totalMessagesCount) * 100).toFixed(2) : 0;
    const deletedTotalPercentage = totalMessagesCount ? ((deletedTotalCount / totalMessagesCount) * 100).toFixed(2) : 0;
    const deletedByScriptPercentage = totalMessagesCount ? ((deletedByScriptCount / totalMessagesCount) * 100).toFixed(2) : 0;
    const ignoredByFiltersPercentage = totalMessagesCount ? ((ignoredByFiltersCount / totalMessagesCount) * 100).toFixed(2) : 0;

    const spinnerHtml = waitingSeconds > 0 ? `<span style="display: inline-block; animation: spin 1s linear infinite;">⏳</span> (${waitingSeconds}s)` : '';
    const statusColor = scriptError ? 'red' : isPaused ? 'orange' : '#90EE90';
    const pagesTotal = totalPages || 0;
    const messageProgressPercentage = totalMessagesCount ? ((deletedTotalCount + ignoredByFiltersCount) / totalMessagesCount * 100).toFixed(2) : 0;
    const elapsedSeconds = startTime ? (Date.now() - startTime) / 1000 : 0;
    const messagesProcessed = deletedTotalCount + ignoredByFiltersCount;

    estimatedRemainingTime = (messagesProcessed && totalMessagesCount && startTime) ? (totalMessagesCount - messagesProcessed) * (elapsedSeconds / messagesProcessed) : null;

    let progressBar = '';
    if (totalMessagesCount && startTime) {
      const progressPercent = Math.min(100, messageProgressPercentage);
      const timeBar = scriptStatus === "Terminé" ? formatTime(elapsedSeconds) : (estimatedRemainingTime !== null ? formatTime(estimatedRemainingTime) : '');
      const labelBar = scriptStatus === "Terminé" ? 'Durée totale : ' : 'Durée estimée restante : ';
      progressBar = `
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${progressPercent}%"></div>
          <div class="progress-label">${labelBar}${timeBar}</div>
        </div>
      `;
    }

    dynamicContent.innerHTML = `
      <p style="margin: 5px 0;">État du script : <span style="color: ${statusColor};">${scriptStatus} ${spinnerHtml}</span></p>
      <p style="margin: 5px 0;">Pages parcourues : ${pageCount} / ${pagesTotal}</p>
      <p style="margin: 5px 0;">Messages analysés : ${deletedTotalCount + ignoredByFiltersCount} / ${totalMessagesCount}</p>
      <p style="margin: 5px 0;">Messages déjà supprimés : ${deletedStandardCount} <span style="font-size:13px;color:#aaa;">(${deletedStandardPercentage}%)</span></p>
      <p style="margin: 5px 0;">Messages déjà supprimés (GTA) : ${deletedGtaCount} <span style="font-size:13px;color:#aaa;">(${deletedGtaPercentage}%)</span></p>
      <p style="margin: 5px 0;">Messages supprimés par le script : ${deletedByScriptCount} <span style="font-size:13px;color:#aaa;">(${deletedByScriptPercentage}%)</span></p>
      <p style="margin: 5px 0;">Messages ignorés par les filtres : ${ignoredByFiltersCount} <span style="font-size:13px;color:#aaa;">(${ignoredByFiltersPercentage}%)</span></p>
      <p style="margin: 5px 0;">Total supprimés : ${deletedTotalCount} <span style="font-size:13px;color:#aaa;">(${deletedTotalPercentage}%)</span></p>
      ${progressBar}
      <p style="margin: 5px 0; color: ${failedMessages.size > 0 ? 'red' : 'white'}; display: ${failedMessages.size > 0 ? '' : 'none'};">Échecs en attente : ${failedMessages.size}</p>
      <p style="margin: 5px 0; color: ${failedAfterRetry.size > 0 ? 'red' : 'white'}; display: ${failedAfterRetry.size > 0 ? '' : 'none'};">Échecs définitifs : ${failedAfterRetry.size}</p>
    `;

    const updatedUiHeight = ui.offsetHeight || 300;
    controls.style.top = `calc(50% + ${updatedUiHeight / 2 + 8}px)`;

    if (scriptStatus === "Terminé") {
      pauseButton.style.display = 'none';
      resumeButton.style.display = 'none';
      startButton.style.display = 'none';
      return;
    }

    if (scriptStatus === "En attente de lancement") {
      pauseButton.style.display = 'none';
      resumeButton.style.display = 'none';
      startButton.style.display = '';
    } else if (settingsModal.style.display !== 'block') {
      pauseButton.style.display = '';
      resumeButton.style.display = '';
      startButton.style.display = 'none';
    }

    if (isPaused) {
      pauseButton.classList.add('btn-disabled');
      resumeButton.classList.toggle('btn-disabled', isPendingRequest || waitingSeconds > 0 || isProcessingMessages);
      pauseButton.disabled = true;
      resumeButton.disabled = isPendingRequest || waitingSeconds > 0 || isProcessingMessages;
    } else {
      pauseButton.classList.remove('btn-disabled');
      resumeButton.classList.add('btn-disabled');
      pauseButton.disabled = false;
      resumeButton.disabled = true;
    }
  }

  async function getMessageDetails(messageId) {
    const url = `https://www.jeuxvideo.com/forums/message/${messageId}`;
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Erreur ${response.status}`);
      const text = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/html');
      const topicCreatorElement = doc.querySelector('p.text-muted.mx-3.mx-lg-0 strong a, p.text-muted.mx-3.mx-lg-0 strong span.JvCare');
      let topicCreator = null;
      if (topicCreatorElement) {
        if (topicCreatorElement.tagName === 'A') {
          topicCreator = topicCreatorElement.textContent.trim().toLowerCase();
        } else if (topicCreatorElement.classList.contains('JvCare')) {
          const rawText = topicCreatorElement.textContent.trim();
          topicCreator = jvCareDecode(rawText);
          if (topicCreator) {
            topicCreator = topicCreator.toLowerCase();
          } else {
            console.warn(`Échec du décodage JvCareDecode pour le créateur du topic dans le message ${messageId}`);
          }
        }
      } else {
        //console.warn(`Aucun élément trouvé pour le message ${messageId}`);
      }
      return {
        topicCreator
      };
    } catch (error) {
      return {
        topicCreator: null
      };
    }
  }

  function jvCareDecode(encodedText) {
    const base16 = '0A12B34C56D78E9F';
    if (encodedText.match(/[a-zA-Z0-9_\-\[\]]+/)) {
      //console.log(`Le texte est déjà valide : ${encodedText}`);
      return encodedText;
    }
    let decoded = '';
    try {
      if (encodedText.length % 2 !== 0) {
        console.warn(`Longueur invalide du texte encodé : ${encodedText}`);
        return null;
      }
      for (let i = 0; i < encodedText.length; i += 2) {
        const high = base16.indexOf(encodedText.charAt(i));
        const low = base16.indexOf(encodedText.charAt(i + 1));
        if (high === -1 || low === -1) {
          console.warn(`Caractères invalides dans l'encodage : ${encodedText.substr(i, 2)}`);
          return null;
        }
        decoded += String.fromCharCode(high * 16 + low);
      }
      if (!decoded.match(/^[a-zA-Z0-9_\-\[\]]+$/)) {
        console.warn(`Le texte décodé n'est pas valide : ${decoded}`);
        return null;
      }
      //console.log(`Texte décodé : ${decoded}`);
      return decoded;
    } catch (e) {
      console.error(`Erreur de décodage : ${e.message}, ent : ${encodedText}`);
      return null;
    }
  }

  function parseMessageDate(dateStr) {
    const months = {
      'janvier': 0,
      'février': 1,
      'mars': 2,
      'avril': 3,
      'mai': 4,
      'juin': 5,
      'juillet': 6,
      'août': 7,
      'septembre': 8,
      'octobre': 9,
      'novembre': 10,
      'décembre': 11
    };
    const match = dateStr.match(/(\d{2})\s+([a-zéû]+)\s+(\d{4})(\s+à\s+\d{2}:\d{2}:\d{2})?/i);

    if (!match) {
      console.error(`Format de date invalide : ${dateStr}.`);
      return null;
    }
    const [, day, month, year] = match;
    const monthIndex = months[month.toLowerCase()];
    if (monthIndex === undefined) {
      console.error(`Mois invalide : ${month}.`);
      return null;
    }
    const date = new Date(year, monthIndex, day);
    if (isNaN(date.getTime())) {
      console.error(`Date invalide créée: ${year}-${monthIndex + 1}-${day}.`);
      return null;
    }
    date.setHours(0, 0, 0, 0);
    return date;
  }

  function getNextPageUrl(doc) {
    let nextElement = doc.querySelector('.pagi-after .pagi-suivant-actif');
    if (nextElement) {
      let nextUrl = nextElement.getAttribute('href');
      if (nextElement.classList.contains('JvCare')) {
        nextUrl = jvCake(nextElement.className);
      }
      return nextUrl;
    }
    return null;
  }

  function jvCake(classe) {
    const base16 = '0A12B34C56D78E9F';
    let link = '';
    const s = classe.split(' ')[1];
    for (let i = 0; i < s.length; i += 2) {
      link += String.fromCharCode(base16.indexOf(s.charAt(i)) * 16 + base16.indexOf(s.charAt(i + 1)));
    }
    return link;
  }

  async function analyzeMessages(doc) {
    const messages = doc.querySelectorAll('.bloc-message-forum');
    let promises = [];
    const pseudo = extractPseudo(currentUrl).toLowerCase();

    isProcessingMessages = true;
    updateUI();

    for (const message of messages) {
      const messageId = message.getAttribute('data-id');
      if (processedMessages.has(messageId)) continue;

      if (message.classList.contains('msg-supprime')) {
        deletedStandardCount++;
        deletedTotalCount++;
        processedMessages.add(messageId);
        continue;
      } else if (message.classList.contains('msg-supprime-gta')) {
        deletedGtaCount++;
        deletedTotalCount++;
        processedMessages.add(messageId);
        continue;
      }

      const dateElement = message.querySelector('.bloc-date-msg a, .bloc-date-msg span');
      let dateText = dateElement ? dateElement.textContent.trim() : null;

      let isValidDateFormat = dateText && dateText.match(/(\d{2})\s+([a-zéû]+)\s+(\d{4})\s+à\s+\d{2}:\d{2}:\d{2}/i);
      if (dateElement && dateElement.classList.contains('JvCare') && !isValidDateFormat) {
        try {
          dateText = jvCareDecode(dateText);
        } catch (e) {
          console.error(`Erreur lors du décodage JvCareDecode pour message ${messageId} : ${e.message}.`);
          dateText = null;
        }
      }

      const date = dateText ? parseMessageDate(dateText) : null;

      const contentElement = message.querySelector('.txt-msg.text-enrichi-forum');
      let messageContent = contentElement ? contentElement.textContent.trim() : '';

      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = contentElement ? contentElement.innerHTML : '';
      tempDiv.querySelectorAll('blockquote.blockquote-jv').forEach(blockquote => blockquote.remove());
      tempDiv.querySelectorAll('a').forEach(link => link.remove());
      let cleanedContent = tempDiv.textContent.trim().replace(/\s+/g, '');
      const contentLength = cleanedContent.length;

      let shouldDelete = true;

      if (filterOptions.minMessageLength !== null && contentLength >= filterOptions.minMessageLength) {
        shouldDelete = false;
        ignoredByFiltersCount++;
        processedMessages.add(messageId);
        continue;
      }

      if (filterOptions.maxDate && !isNaN(filterOptions.maxDate.getTime()) && date) {
        const filterDate = new Date(filterOptions.maxDate);
        filterDate.setHours(0, 0, 0, 0);
        if (date > filterDate) {
          shouldDelete = false;
          ignoredByFiltersCount++;
          processedMessages.add(messageId);
          continue;
        }
      } else if (!filterOptions.maxDate || isNaN(filterOptions.maxDate.getTime())) {

      } else if (!date) {
        shouldDelete = false;
        ignoredByFiltersCount++;
        processedMessages.add(messageId);
        continue;
      }

      if (shouldDelete && filterOptions.noDeleteOwnTopicsAndMessages) {
        const {
          topicCreator
        } = await getMessageDetails(messageId);
        if (topicCreator && topicCreator.toLowerCase() === pseudo) {
          shouldDelete = false;
          ignoredByFiltersCount++;
          processedMessages.add(messageId);
          continue;
        }
      }

      if (shouldDelete) {
        promises.push(
          deleteMessage(hash, messageId, 20).then(() => {
            processedMessages.add(messageId);
          }).catch((error) => {
            console.error(`Échec de la suppression du message ${messageId}: ${error.message}`);
            processedMessages.add(messageId);
          })
        );
      }
    }

    await Promise.all(promises);
    isProcessingMessages = false;
    pageFullyProcessed = true;
    updateUI();
  }

  async function deleteMessage(hash, messageId, maxAttempts) {
    let attempt = 0;
    let success = false;
    let error403 = false;
    let error503dMCount = 0;

    while (attempt < maxAttempts && !success) {
      try {
        isPendingRequest = true;
        const response = await fetch(
          `https://www.jeuxvideo.com/forums/modal_del_message.php?type=delete&ajax_hash=${hash}&tab_message[]=${messageId}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Accept': '*/*',
              'X-Requested-With': 'XMLHttpRequest',
            },
          }
        );

        if (response.status === 403) {
          error403 = true;
          throw new Error('Erreur (403).');
        }

        if (response.status === 503) {
          error503dMCount++;
          if (error503dMCount >= 5) {
            scriptError = true;
            scriptStatus = "Erreur (503) persistante";
            updateUI();
            throw new Error('Erreur (503) persistante.');
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }

        if (response.ok) {
          deletedByScriptCount++;
          deletedTotalCount++;
          success = true;
        } else {
          throw new Error(`Échec avec le code ${response.status}.`);
        }
      } catch (error) {
        if (error.message.includes('403')) {
          isPaused = true;
          scriptStatus = "Erreur 403 : Veuillez résoudre le CAPTCHA Cloudflare puis cliquer sur Reprendre";
          updateUI();
          throw error;
        }
        const delay = Math.min(2 ** attempt * 100, 5000);
        attempt++;
        await new Promise(resolve => setTimeout(resolve, delay));
      } finally {
        isPendingRequest = false;
      }
    }

    if (success) {
      failedMessages.delete(messageId);
      failedAfterRetry.delete(messageId);
      updateUI();
    } else if (maxAttempts === 20 && !error403) {
      failedMessages.add(messageId);
      updateUI();
    } else if (!error403) {
      failedAfterRetry.add(messageId);
      failedMessages.delete(messageId);
      updateUI();
    }

    return success;
  }

  async function retryFailedMessages() {
    for (const messageId of failedMessages) {
      const success = await deleteMessage(hash, messageId, 5);
      if (success) {
        failedMessages.delete(messageId);
        updateUI();
      }
    }
  }

  async function navigateToNextPage(url, attempt = 1) {
    pageFullyProcessed = false;
    if (isPaused) {
      await new Promise(resolve => setTimeout(resolve, 100));
      return;
    }

    try {
      isPendingRequest = true;
      lastPageAnalyzed = false;
      currentUrl = url;
      updateUI();

      const response = await fetch(url);

      if (response.status === 403) {
        isPaused = true;
        scriptStatus = "Erreur 403 : Veuillez résoudre le CAPTCHA Cloudflare puis cliquer sur Reprendre";
        updateUI();
        return;
      }

      if (response.status === 503) {
        error503Count++;
        if (error503Count >= 5) {
          scriptError = true;
          scriptStatus = "Erreur (503) persistante";
          updateUI();
          throw new Error('Erreur (503) persistante.');
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        return navigateToNextPage(url, attempt);
      }

      if (response.status === 429) {
        startWaitingTimer(10);
        if (attempt < 5) {
          await new Promise(resolve => setTimeout(resolve, 10000));
          lastPageAnalyzed = false;
          currentPageHtml = null;
          return navigateToNextPage(url, attempt + 1);
        } else {
          throw new Error('Échec après plusieurs tentatives (429).');
        }
      }

      error503Count = 0;
      const text = await response.text();
      currentPageHtml = text;
      pageCount++;
      updateUI();

      const doc = new DOMParser().parseFromString(text, 'text/html');
      await analyzeMessages(doc);
      pageFullyProcessed = true;
      updateUI();

      let nextUrl = getNextPageUrl(doc);
      if (nextUrl) {
        return navigateToNextPage(nextUrl);
      } else {
        lastPageAnalyzed = true;
        if (failedMessages.size > 0) {
          await retryFailedMessages();
        }
        scriptStatus = "Terminé";
        updateUI();
        return;
      }
    } catch (error) {
      scriptError = true;
      scriptStatus = "Erreur";
      updateUI();
      console.error(error);
    } finally {
      isPendingRequest = false;
      updateUI();
    }
  }

  async function resumeScript() {
    if (isPaused) return;

    if (lastPageAnalyzed && currentPageHtml) {
      const doc = new DOMParser().parseFromString(currentPageHtml, 'text/html');
      let nextUrl = getNextPageUrl(doc);
      if (nextUrl) {
        navigateToNextPage(nextUrl);
      } else {
        if (failedMessages.size > 0) {
          await retryFailedMessages();
        }
        scriptStatus = "Terminé";
        updateUI();
      }
    } else if (currentPageHtml && !lastPageAnalyzed) {
      const doc = new DOMParser().parseFromString(currentPageHtml, 'text/html');
      await analyzeMessages(doc);
      lastPageAnalyzed = true;
      if (!isPaused) resumeScript();
    } else {
      navigateToNextPage(currentUrl);
    }
  }

  window.resumeScript = resumeScript;

  const pseudo = extractPseudo(currentUrl);
  if (!pseudo) {
    console.error("Impossible d'extraire le pseudo depuis l'URL.");
    scriptError = true;
    scriptStatus = "Erreur d'extraction du pseudo";
    updateUI();
    throw new Error("Arrêt du script.");
  }
  const totalMessages = await fetchTotalMessagesCount(pseudo);
  if (totalMessages) {
    totalMessagesCount = totalMessages;
    totalPages = Math.ceil(totalMessages / 20);
  } else {
    console.warn("Impossible de déterminer le nombre de messages.");
  }

  updateUI();

  async function checkScriptVersion() {
    try {
      const response = await fetch('https://raw.githubusercontent.com/Shinoos/Tool-to-delete-all-your-jeuxvideo.com-posts/refs/heads/main/Delete-all-posts.js');
      const onlineScript = await response.text();
      const onlineScriptVersion = onlineScript.match(/const scriptVersion = "(.+)";/)[1];

      if (onlineScriptVersion !== scriptVersion) {
        console.warn(`Tool-to-delete-all-your-jeuxvideo.com-posts → Vous utilisez actuellement une ancienne version du script (${scriptVersion}). Une nouvelle version du script (${onlineScriptVersion}) est disponible : https://github.com/Shinoos/Tool-to-delete-all-your-jeuxvideo.com-posts`);
      } else {
        console.log(`Tool-to-delete-all-your-jeuxvideo.com-posts → Vous utilisez bien la dernière version du script : ${scriptVersion} 👍`);
      }
    } catch (error) {
      console.error('Tool-to-delete-all-your-jeuxvideo.com-posts → Erreur lors de la vérification de la version du script :', error);
    }
  }
})();
