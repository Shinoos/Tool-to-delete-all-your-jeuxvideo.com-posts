(async function main() {
  const scriptVersion = "v1.2.4";
  checkScriptVersion();
  let scriptStatus = "En attente de lancement";
  let scriptError = false;
  let currentUrl = window.location.href;
  let currentPageHtml = null;
  let pseudo = null;
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
    minDate: null,
    maxDate: null,
    noDeleteOwnTopicsAndMessages: false,
    minMessageLength: null,
    excludeForums: [],
    dryRun: false
  };
  let startTime = null;
  let journal = [];
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
      #status-display .journal-icon {
        display: inline-block;
        font-size: 16px;
        margin-right: 8px;
        cursor: pointer;
        text-align: center;
        vertical-align: middle;
      }
      #status-display .journal-icon:hover {
        color: #4caf50;
      }
      .settings-icon {
        cursor: pointer;
        font-size: 18px;
        color: #aaa;
        transition: color 0.3s;
      }
      .modal-journal {
        display: none;
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0, 0, 0, 0.9);
        padding: 20px;
        border-radius: 12px;
        z-index: 10002;
        color: white;
        font-family: Arial, sans-serif;
        width: 75vw;
        height: 75vh;
        min-width: 300px;
        max-width: 900px;
        max-height: 80vh;
        overflow-y: auto;
      }
      .modal-journal h4 {
        margin: 0 0 15px;
        font-size: 18px;
      }
      .modal-journal pre {
        white-space: pre-wrap;
        word-wrap: break-word;
      }
      .modal-journal button {
        padding: 10px;
        margin: 10px auto 0;
        border: none;
        border-radius: 8px;
        background: rgba(0, 0, 0, 0.85);
        color: white;
        cursor: pointer;
        width: 120px;
        position: sticky;
        bottom: 10px;
      }
      .modal-journal button:hover {
        background: rgba(0, 0, 0, 0.95);
      }
      .modal-journal th.sorted-asc::after,
      .modal-journal th.sorted-desc::after {
        content: '';
        position: absolute;
        right: 8px;
        border: 6px solid transparent;
      }
      .modal-journal th.sorted-asc::after {
        border-bottom-color: #333;
        top: 50%;
        margin-top: -3px;
      }
      .modal-journal th.sorted-desc::after {
        border-top-color: #333;
        top: 50%;
        margin-top: -3px;
      }
      .modal-journal th {
        position: relative;
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
      .modal input[type="text"] {
        width: 100%;
        padding: 8px;
        border-radius: 5px;
        border: none;
        background: #333;
        color: white;
      }
      .modal-confirmation {
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
      .modal-confirmation h4 {
        margin: 0 0 15px;
        font-size: 18px;
        text-align: center;
      }
      .modal-confirmation ul {
        margin: 0 0 15px;
        padding-left: 20px;
      }
      .modal-confirmation li {
        margin: 5px 0;
      }
      .modal-confirmation .buttons {
        text-align: right;
        margin-top: 10px;
      }
      .modal-confirmation button {
        padding: 10px;
        margin: 5px;
        border: none;
        border-radius: 8px;
        background: rgba(0, 0, 0, 0.85);
        color: white;
        cursor: pointer;
      }
      .modal-confirmation button:hover {
        background: rgba(0, 0, 0, 0.95);
      }
      .icon-disabled {
        filter: grayscale(100%);
        pointer-events: none;
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
    <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
      <span style="font-size: 13px; color: #aaa;">${scriptVersion}</span>
      <span style="flex: 1; text-align: center;">Delete-all-posts.js</span>
      <div style="display: flex; align-items: center;">
        <span class="journal-icon" onclick="showJournal()" title="Afficher le journal">📰</span>
        <span class="settings-icon">⚙️</span>
      </div>
    </div>
  `;

  statusDisplay.appendChild(header);
  const dynamicContent = document.createElement('div');
  dynamicContent.id = 'dynamic-content';
  statusDisplay.appendChild(dynamicContent);

  const settingsModal = document.createElement('div');
  settingsModal.className = 'modal';
  settingsModal.style.display = 'none';
  settingsModal.innerHTML = `
    <h4 style="text-align: center;">Options de suppression</h4>
    <label>
      Supprime uniquement les messages postérieurs à :
      <input type="date" id="min-date">
    </label>
    <label>
      Supprime uniquement les messages antérieurs à :
      <input type="date" id="max-date">
    </label>
    <label title="Entre les numéros des forums à exclure (ex : 36,51,1000021 pour Guerre des Consoles, Blabla 18-25 et Communauté).">
      Forums à exclure (séparés par des virgules) :
      <input type="text" id="exclude-forums" placeholder="36,51,1000021">
    </label>
    <label style="display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 15px;">
      <span title="Supprime uniquement les messages de moins de X caractères (hors espaces, liens (stickers compris), monosmiley et citations).">Supprime uniquement si moins de :</span>
      <input type="number" id="min-message-length" min="0" placeholder="Caractères" style="width: 110px;" title="Supprime uniquement les messages de moins de X caractères (hors espaces, liens (stickers compris), monosmiley et citations).">
    </label>
    <div style="display: flex; align-items: center; gap: 10px; margin-top: 10px;">
      <input type="checkbox" id="no-delete-own-topics-and-messages">
      <label for="no-delete-own-topics-and-messages" title="Vos topics et les messages présents dans vos topics ne seront pas supprimés." style="cursor: pointer;">
        Ne pas supprimer mes topics ni leurs messages
      </label>
    </div>
    <div style="display: flex; align-items: center; gap: 10px; margin-top: 10px;">
      <input type="checkbox" id="dry-run-mode">
      <label for="dry-run-mode" title="Active le mode simulation pour tester la suppression des messages sans effectuer de requêtes réelles. Le script simulera les suppressions, mettra à jour les compteurs et enregistrera les actions dans le journal pour vérifier les messages qui seraient supprimés selon les filtres configurés." style="cursor: pointer;">
        Mode simulation
      </label>
    </div>
    <div style="text-align: right; margin-top: 10px;">
      <button id="save-settings">Enregistrer</button>
      <button id="cancel-settings">Annuler</button>
    </div>
  `;
  document.body.appendChild(settingsModal);

  const confirmationModal = document.createElement('div');
  confirmationModal.className = 'modal-confirmation';
  confirmationModal.style.display = 'none';
  confirmationModal.innerHTML = `
      <h4>Confirmer la suppression</h4>
      <p>Filtres actifs :</p>
      <ul id="active-filters"></ul>
      <div class="buttons">
        <button id="confirm-delete">Confirmer</button>
        <button id="cancel-delete">Annuler</button>
      </div>
    `;
  document.body.appendChild(confirmationModal);

  function displayActiveFilters() {
    const formattedMinDate = filterOptions.minDate ? filterOptions.minDate.toLocaleDateString('fr-FR') : null;
    const formattedMaxDate = filterOptions.maxDate ? filterOptions.maxDate.toLocaleDateString('fr-FR') : null;
    const activeFiltersList = confirmationModal.querySelector('#active-filters');
    activeFiltersList.innerHTML = '';

    const filters = [];

    if (filterOptions.minDate && filterOptions.maxDate) {
      filters.push(`Seuls les messages entre le ${formattedMinDate} et le ${formattedMaxDate} seront supprimés.`);
    } else {
      if (filterOptions.maxDate) {
        filters.push(`Supprimer uniquement les messages antérieurs au ${formattedMaxDate}.`);
      }
      if (filterOptions.minDate) {
        filters.push(`Supprimer uniquement les messages postérieurs au ${formattedMinDate}.`);
      }
    }

    if (filterOptions.noDeleteOwnTopicsAndMessages) {
      filters.push("Ne pas supprimer mes topics ni leurs messages.");
    }
    if (filterOptions.minMessageLength !== null) {
      filters.push(`Supprimer uniquement les messages de moins de ${filterOptions.minMessageLength} caractères.`);
    }
    if (filterOptions.excludeForums.length > 0) {
      filters.push(`Forums exclus : ${filterOptions.excludeForums.join(', ')}.`);
    }
    if (filterOptions.dryRun) {
      filters.push("Mode simulation.");
    }

    if (filters.length === 0) {
      filters.push("Aucun filtre actif (tous les messages seront supprimés).");
    }

    filters.forEach(filter => {
      const li = document.createElement('li');
      li.textContent = filter;
      activeFiltersList.appendChild(li);
    });
  }

  const minDateInput = settingsModal.querySelector('#min-date');
  minDateInput.addEventListener('keydown', e => e.preventDefault());
  minDateInput.addEventListener('keypress', e => e.preventDefault());
  minDateInput.addEventListener('paste', e => e.preventDefault());
  const maxDateInput = settingsModal.querySelector('#max-date');
  maxDateInput.addEventListener('keydown', e => e.preventDefault());
  maxDateInput.addEventListener('keypress', e => e.preventDefault());
  maxDateInput.addEventListener('paste', e => e.preventDefault());
  const noDeleteOwnTopicsAndMessagesCheckbox = settingsModal.querySelector('#no-delete-own-topics-and-messages');
  const minMessageLengthInput = settingsModal.querySelector('#min-message-length');
  const saveSettingsButton = settingsModal.querySelector('#save-settings');
  const cancelSettingsButton = settingsModal.querySelector('#cancel-settings');
  const settingsIcon = header.querySelector('.settings-icon');
  settingsIcon.className = 'settings-icon';
  settingsIcon.style.marginLeft = '8px';
  settingsIcon.addEventListener('click', () => {
    minDateInput.value = filterOptions.minDate ? filterOptions.minDate.toISOString().split('T')[0] : '';
    maxDateInput.value = filterOptions.maxDate ? filterOptions.maxDate.toISOString().split('T')[0] : '';
    noDeleteOwnTopicsAndMessagesCheckbox.checked = filterOptions.noDeleteOwnTopicsAndMessages;
    minMessageLengthInput.value = filterOptions.minMessageLength || '';
    settingsModal.querySelector('#dry-run-mode').checked = filterOptions.dryRun;
    settingsModal.querySelector('#exclude-forums').value = filterOptions.excludeForums.join(', ');
    settingsModal.style.display = 'block';
    blurBackground.style.zIndex = '10000';
    pauseButton.style.display = 'none';
    resumeButton.style.display = 'none';
    startButton.style.display = 'none';
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

    const minDateInputValue = minDateInput.value;
    let minDate = null;
    if (minDateInputValue) {
      const [year, month, day] = minDateInputValue.split('-').map(Number);
      minDate = new Date(Date.UTC(year, month - 1, day));
      if (isNaN(minDate.getTime())) {
        minDate = null;
      }
    }

    if (minDate && maxDate && minDate > maxDate) {
      alert("Erreur : La date minimale ne peut pas être postérieure à la date maximale.");
      return;
    }

    filterOptions.maxDate = maxDate;
    filterOptions.minDate = minDate;
    filterOptions.noDeleteOwnTopicsAndMessages = noDeleteOwnTopicsAndMessagesCheckbox.checked;
    filterOptions.dryRun = settingsModal.querySelector('#dry-run-mode').checked;

    const minLengthInput = minMessageLengthInput.value;
    filterOptions.minMessageLength = minLengthInput ? parseInt(minLengthInput, 10) : null;

    const excludeForumsInput = settingsModal.querySelector('#exclude-forums').value;
    filterOptions.excludeForums = excludeForumsInput ? excludeForumsInput.split(',').map(id => id.trim()).filter(id => /^\d+$/.test(id)) : [];

    settingsModal.style.display = 'none';
    blurBackground.style.zIndex = '9999';
    updateUI();
  });

  startButton.addEventListener('click', async () => {
    displayActiveFilters();
    confirmationModal.style.display = 'block';
    blurBackground.style.zIndex = '10000';
    pauseButton.style.display = 'none';
    resumeButton.style.display = 'none';
    startButton.style.display = 'none';
  });

  const confirmDeleteButton = confirmationModal.querySelector('#confirm-delete');
  const cancelDeleteButton = confirmationModal.querySelector('#cancel-delete');

  confirmDeleteButton.addEventListener('click', async () => {
    confirmationModal.style.display = 'none';
    blurBackground.style.zIndex = '9999';
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

  cancelDeleteButton.addEventListener('click', () => {
    confirmationModal.style.display = 'none';
    blurBackground.style.zIndex = '9999';
    updateUI();
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

  function formatTime(seconds) {
    return new Date(seconds * 1000).toISOString().substr(11, 8);
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
      <p style="margin: 5px 0; display: ${filterOptions.dryRun ? 'block' : 'none'};">Mode simulation : <span style="color: #FFD700;">Activé</span></p>
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

    switch (scriptStatus) {
      case "Terminé":
        pauseButton.style.display = 'none';
        resumeButton.style.display = 'none';
        startButton.style.display = 'none';
        break;

      case "En attente de lancement":
        pauseButton.style.display = 'none';
        resumeButton.style.display = 'none';
        startButton.style.display = settingsModal.style.display === 'block' || confirmationModal.style.display === 'block' ? 'none' : '';
        break;

      default:
        if (settingsModal.style.display !== 'block') {
          pauseButton.style.display = '';
          resumeButton.style.display = '';
          startButton.style.display = 'none';
        }
        break;
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
    const maxAttempts = 5;
    let attempt = 0;

    while (attempt < maxAttempts) {
      try {
        const response = await fetch(url);

        if (response.status === 503) {
          attempt++;
          console.warn(`Tentative ${attempt}/${maxAttempts} : Erreur 503 (Service indisponible), attente de 10s avant de retenter.`);
          await new Promise(resolve => setTimeout(resolve, 10000));
          continue;
        }

        if (!response.ok) throw new Error(`Erreur ${response.status}`);

        const text = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(text, 'text/html');
        const topicCreatorElement = doc.querySelector('p.text-muted.mx-3.mx-lg-0 strong a, p.text-muted.mx-3.mx-lg-0 strong span.JvCare');
        const topicCreator = topicCreatorElement ? topicCreatorElement.textContent.trim().toLowerCase() : null;

        const forumLink = doc.querySelector('nav.breadcrumb a.breadcrumb__item[href*="/forums/"]');
        let forumId = null;
        if (forumLink) {
          const href = forumLink.getAttribute('href');
          const match = href.match(/\/forums\/(?:42|0)-(\d+)-/);
          if (match) {
            forumId = match[1];
          }
        }

        return {
          topicCreator,
          forumId
        };

      } catch (error) {
        attempt++;
        console.warn(`Tentative ${attempt}/${maxAttempts} : ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, 10000));
      }
    }

    return {
      topicCreator: null,
      forumId: null
    };
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
      console.error(`Date invalide créée : ${year}-${monthIndex + 1}-${day}.`);
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

  function jvCake(encodedText) {
    const base16 = '0A12B34C56D78E9F';
    let decodedText = '';
    const s = encodedText.split(' ')[1];
    for (let i = 0; i < s.length; i += 2) {
      decodedText += String.fromCharCode(base16.indexOf(s.charAt(i)) * 16 + base16.indexOf(s.charAt(i + 1)));
    }
    return decodedText;
  }

  function logEvent(messageId, action, reason = null) {
    const nowMs = Date.now();
    const date = new Date(nowMs);
    const options = {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    };

    const label = date.toLocaleString('fr-FR', options);
    const millis = (nowMs % 1000).toString().padStart(3, '0');
    const timestamp = `${label}:${millis}`;

    journal.push({
      timestamp,
      messageId,
      action,
      reason
    });

    console.log("Événement ajouté au journal :", {
      timestamp,
      messageId,
      action,
      reason
    });
  }

  function enableSorting(table) {
    const tbody = table.querySelector('tbody');
    table.querySelectorAll('th').forEach((th, colIndex) => {
      th.addEventListener('click', () => {
        const isAsc = th.classList.toggle('sorted-asc');
        th.classList.toggle('sorted-desc', !isAsc);
        table.querySelectorAll('th').forEach(other => {
          if (other !== th) other.classList.remove('sorted-asc', 'sorted-desc');
        });

        const rows = Array.from(tbody.querySelectorAll('tr'));
        const type = th.dataset.type;
        rows.sort((a, b) => {
          let aT = a.children[colIndex].textContent.trim();
          let bT = b.children[colIndex].textContent.trim();
          if (type === 'number') return isAsc ? aT - bT : bT - aT;
          if (type === 'date') return isAsc ? new Date(aT) - new Date(bT) :
            new Date(bT) - new Date(aT);
          return isAsc ?
            aT.localeCompare(bT) :
            bT.localeCompare(aT);
        });
        rows.forEach(r => tbody.appendChild(r));
      });
    });
  }

  function showJournal() {
    const batchSize = 500;
    let displayedEvents = 0;
    let isLoading = false;
    let updateBtnInterval;

    const modal = document.createElement('div');
    modal.className = 'modal-journal';
    modal.style.display = 'block';

    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
    `;
    const title = document.createElement('h4');
    title.textContent = 'Journal des événements';
    title.style.margin = 0;
    title.style.flex = '1';
    header.appendChild(title);

    const loadAllBtn = document.createElement('button');
    loadAllBtn.textContent = 'Tout charger';
    loadAllBtn.style.cssText = `
      display:block;
      margin:8px auto 0;
      padding:6px 14px;
      font-size:14px;
      border-radius:6px;
      cursor:pointer;
    `;
    header.appendChild(loadAllBtn);
    modal.appendChild(header);

    const table = document.createElement('table');
    table.style.cssText = 'border-collapse:collapse;width:100%;';
    table.innerHTML = `
      <thead>
        <tr>
          <th data-type="date" style="border:1px solid#999;padding:5px;cursor:pointer;">Horodatage</th>
          <th data-type="number" style="border:1px solid#999;padding:5px;cursor:pointer;">Message ID</th>
          <th data-type="string" style="border:1px solid#999;padding:5px;cursor:pointer;">Action</th>
          <th data-type="string" style="border:1px solid#999;padding:5px;cursor:pointer;">Raison</th>
        </tr>
      </thead>
    `;
    const tbody = document.createElement('tbody');
    table.appendChild(tbody);
    modal.appendChild(table);

    function resortTable() {
      const sortedTh = table.querySelector('th.sorted-asc, th.sorted-desc');
      if (!sortedTh) return;

      const colIndex = Array.from(sortedTh.parentNode.children).indexOf(sortedTh);
      const isAsc = sortedTh.classList.contains('sorted-asc');
      const type = sortedTh.dataset.type;
      const rows = Array.from(tbody.querySelectorAll('tr'));

      rows.sort((a, b) => {
        let aT = a.children[colIndex].textContent.trim();
        let bT = b.children[colIndex].textContent.trim();
        if (type === 'number') return isAsc ? aT - bT : bT - aT;
        if (type === 'date') return isAsc ?
          new Date(aT) - new Date(bT) :
          new Date(bT) - new Date(aT);
        return isAsc ? aT.localeCompare(bT) : bT.localeCompare(aT);
      });

      rows.forEach(r => tbody.appendChild(r));
    }

    function loadMoreEvents() {
      if (isLoading || displayedEvents >= journal.length) return;
      isLoading = true;

      const start = displayedEvents;
      const end = Math.min(start + batchSize, journal.length);
      const batch = journal.slice(start, end);

      batch.forEach(entry => {
        const tr = document.createElement('tr');
        [entry.timestamp, entry.messageId, entry.action, entry.reason || 'N/A']
        .forEach((val, i) => {
          const td = document.createElement('td');
          td.style.cssText = 'border:1px solid#999;padding:5px;';
          if (i === 1) {
            const a = document.createElement('a');
            a.href = `https://www.jeuxvideo.com/forums/message/${val}`;
            a.target = '_blank';
            a.textContent = val;
            a.style.color = '#90EE90';
            td.appendChild(a);
          } else {
            td.textContent = val;
          }
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });

      displayedEvents = end;
      isLoading = false;

      resortTable();
      updateLoadAllBtn();
    }

    function updateLoadAllBtn() {
      const remaining = journal.length - displayedEvents;
      loadAllBtn.disabled = remaining <= 0;
      loadAllBtn.style.opacity = remaining > 0 ? '1' : '0.4';
      loadAllBtn.style.cursor = remaining > 0 ? 'pointer' : 'not-allowed';
    }

    loadMoreEvents();
    updateLoadAllBtn();

    modal.addEventListener('scroll', () => {
      if (isLoading) return;
      const pos = modal.scrollTop + modal.clientHeight;
      if (pos > modal.scrollHeight - 100 && displayedEvents < journal.length) {
        loadMoreEvents();
      }
    });

    loadAllBtn.addEventListener('click', () => {
      while (displayedEvents < journal.length) {
        loadMoreEvents();
      }
    });

    updateBtnInterval = setInterval(updateLoadAllBtn, 500);

    const closeBtn = document.createElement('button');
    closeBtn.textContent = 'Fermer';
    closeBtn.style.cssText = `
      display:block;
      margin:8px auto 0;
      padding:6px 14px;
      font-size:14px;
      border-radius:6px;
      cursor:pointer;
    `;
    closeBtn.onclick = () => {
      clearInterval(updateBtnInterval);
      modal.remove();
    };
    modal.appendChild(closeBtn);

    document.body.appendChild(modal);

    enableSorting(table);
  }

  window.showJournal = showJournal;

  async function analyzeMessages(doc) {
    const messages = doc.querySelectorAll('.bloc-message-forum');
    let promises = [];

    isProcessingMessages = true;
    updateUI();

    for (const message of messages) {
      const messageId = message.getAttribute('data-id');
      if (processedMessages.has(messageId)) continue;

      if (message.classList.contains('msg-supprime')) {
        deletedStandardCount++;
        deletedTotalCount++;
        processedMessages.add(messageId);
        logEvent(messageId, "Ignoré.", "Message déjà supprimé.");
        continue;
      } else if (message.classList.contains('msg-supprime-gta')) {
        deletedGtaCount++;
        deletedTotalCount++;
        processedMessages.add(messageId);
        logEvent(messageId, "Ignoré.", "Message déjà supprimé GTA.");
        continue;
      }

      const dateElement = message.querySelector('.bloc-date-msg a, .bloc-date-msg span');
      let dateText = dateElement ? dateElement.textContent.trim() : null;
      const date = dateText ? parseMessageDate(dateText) : null;

      if (!date) {
        ignoredByFiltersCount++;
        processedMessages.add(messageId);
        logEvent(messageId, "Ignoré.", "Aucune date trouvée.");
        continue;
      }

      if (filterOptions.maxDate && !isNaN(filterOptions.maxDate.getTime())) {
        const filterMaxDate = new Date(filterOptions.maxDate);
        filterMaxDate.setHours(0, 0, 0, 0);
        if (date > filterMaxDate) {
          ignoredByFiltersCount++;
          processedMessages.add(messageId);
          logEvent(messageId, "Ignoré.", "Date supérieure à la date maximale.");
          continue;
        }
      }

      if (filterOptions.minDate && !isNaN(filterOptions.minDate.getTime())) {
        const filterMinDate = new Date(filterOptions.minDate);
        filterMinDate.setHours(0, 0, 0, 0);
        if (date < filterMinDate) {
          ignoredByFiltersCount++;
          processedMessages.add(messageId);
          logEvent(messageId, "Ignoré.", "Date inférieure à la date minimale.");
          continue;
        }
      }

      let msgLength = null;
      if (filterOptions.minMessageLength !== null) {
        const contentElement = message.querySelector('.txt-msg.text-enrichi-forum');
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = contentElement ? contentElement.innerHTML : '';
        tempDiv.querySelectorAll('blockquote.blockquote-jv').forEach(blockquote => blockquote.remove());
        tempDiv.querySelectorAll('a').forEach(link => link.remove());
        msgLength = tempDiv.textContent.trim().replace(/\s+/g, '').length;

        if (msgLength >= filterOptions.minMessageLength) {
          ignoredByFiltersCount++;
          processedMessages.add(messageId);
          logEvent(messageId, "Ignoré.", "Message trop long pour être supprimé.");
          continue;
        }
      }

      if (filterOptions.noDeleteOwnTopicsAndMessages || filterOptions.excludeForums.length > 0) {
        const {
          topicCreator,
          forumId
        } = await getMessageDetails(messageId);

        if (filterOptions.noDeleteOwnTopicsAndMessages && topicCreator && topicCreator.toLowerCase() === pseudo) {
          ignoredByFiltersCount++;
          processedMessages.add(messageId);
          logEvent(messageId, "Ignoré.", "Message posté sur un topic m'appartenant.");
          updateUI();
          continue;
        }

        if (forumId && filterOptions.excludeForums.includes(forumId)) {
          ignoredByFiltersCount++;
          processedMessages.add(messageId);
          logEvent(messageId, "Ignoré.", "Message posté sur un forum listé comme exclu.");
          updateUI();
          continue;
        }
      }

      promises.push(
        deleteMessage(hash, messageId, 20).then(() => {
          if (!filterOptions.dryRun) {
            logEvent(messageId, "Supprimé.");
          }
          processedMessages.add(messageId);
        }).catch((error) => {
          console.error(`Échec de la suppression du message ${messageId}: ${error.message}`);
          processedMessages.add(messageId);
        })
      );
    }

    await Promise.all(promises);
    isProcessingMessages = false;
    pageFullyProcessed = true;
    updateUI();
  }

  async function deleteMessage(hash, messageId, maxAttempts) {
    if (filterOptions.dryRun) {
      logEvent(messageId, "Supprimé.", "Mode simulation activé.");
      deletedByScriptCount++;
      deletedTotalCount++;
      processedMessages.add(messageId);
      failedMessages.delete(messageId);
      failedAfterRetry.delete(messageId);
      updateUI();
      return true;
    }

    let attempt = 0;
    let error503dCount = 0;
    let error403 = false;
    let success = false;

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

        switch (response.status) {
          case 403:
            error403 = true;
            isPaused = true;
            scriptStatus = "Erreur 403 : Veuillez résoudre le CAPTCHA Cloudflare puis cliquer sur Reprendre";
            failedMessages.add(messageId);
            updateUI();
            return false;

          case 503:
            error503dCount++;
            if (error503dCount >= 5) {
              scriptError = true;
              scriptStatus = "Erreur 503 persistante";
              updateUI();
              throw new Error('Erreur (503) persistante.');
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;

          default:
            if (response.ok) {
              deletedByScriptCount++;
              deletedTotalCount++;
              success = true;
            } else {
              throw new Error(`Échec avec le code ${response.status}.`);
            }
            break;
        }

      } catch (error) {
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
    } else if (!error403) {
      if (maxAttempts === 20) {
        failedMessages.add(messageId);
      } else {
        failedAfterRetry.add(messageId);
        failedMessages.delete(messageId);
      }
    }

    updateUI();
    return success;
  }

  async function retryFailedMessages() {
    for (const messageId of failedMessages) {
      const success = await deleteMessage(hash, messageId, 5);
      if (success) {
        failedMessages.delete(messageId);
        logEvent(messageId, "Supprimé.", "Supprimé après retry.");
        updateUI();
      }
    }
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

      switch (response.status) {
        case 200:
          break;

        case 403:
          isPaused = true;
          scriptStatus = "Erreur 403 : Veuillez résoudre le CAPTCHA Cloudflare puis cliquer sur Reprendre";
          updateUI();
          return;

        case 503:
          error503Count++;
          if (error503Count >= 5) {
            scriptStatus = "Erreur (503) persistante";
            updateUI();
            throw new Error('Erreur (503) persistante.');
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
          return navigateToNextPage(url, attempt);

        case 429:
          startWaitingTimer(10);
          if (attempt < 5) {
            await new Promise(resolve => setTimeout(resolve, 10000));
            lastPageAnalyzed = false;
            currentPageHtml = null;
            return navigateToNextPage(url, attempt + 1);
          } else {
            scriptStatus = "Erreur (429) persistante";
            throw new Error('Échec après plusieurs tentatives (429).');
          }

        default:
          scriptStatus = `Erreur HTTP ${response.status}`;
          updateUI();
          throw new Error(`Erreur HTTP ${response.status}`);
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

      const nextUrl = getNextPageUrl(doc);
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
      console.error(error);
      updateUI();
    } finally {
      isPendingRequest = false;
      updateUI();
    }
  }

  async function resumeScript() {
    if (isPaused) return;

    if (!currentPageHtml) {
      navigateToNextPage(currentUrl);
      return;
    }

    if (!lastPageAnalyzed) {
      const doc = new DOMParser().parseFromString(currentPageHtml, 'text/html');
      await analyzeMessages(doc);
      lastPageAnalyzed = true;
      if (!isPaused) await resumeScript();
      return;
    }

    const doc = new DOMParser().parseFromString(currentPageHtml, 'text/html');
    const nextUrl = getNextPageUrl(doc);

    if (nextUrl) {
      navigateToNextPage(nextUrl);
    } else {
      if (failedMessages.size > 0) {
        await retryFailedMessages();
      }
      scriptStatus = "Terminé";
      updateUI();
    }
  }

  window.resumeScript = resumeScript;

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
      spinner.innerHTML = `<div style="width: 48px; height: 48px; border: 5px solid rgba(255, 255, 255, 0.3); border-top: 5px solid #4caf50; border-radius: 50%; animation: spinModern 1s ease-in-out infinite; box-shadow: 0 0 10px rgba(0,0,0,0.4);"></div>`;
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

        if (response.status === 429 || response.status === 503) {
          console.warn(`Tentative ${attempt + 1}/${maxAttempts} : Erreur ${response.status}, attente de 10s avant de retenter.`);
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
          console.warn(`Tentative ${attempt}/${maxAttempts} échouée, attente de 10s avant de retenter.`, e);
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

  function extractPseudo(url) {
    const match = url.match(/\/profil\/([^\/?]+)/i);
    if (match) return match[1].toLowerCase();
    return null;
  }

  pseudo = extractPseudo(currentUrl);
  if (!pseudo) {
    console.error("Impossible d'extraire le pseudo depuis l'URL.");
    scriptError = true;
    scriptStatus = "Erreur d'extraction du pseudo";
    updateUI();
    throw new Error("Arrêt du script.");
  }

  const icons = document.querySelectorAll('.settings-icon, .journal-icon');
  icons.forEach(i => i.classList.add('icon-disabled'));
  const totalMessages = await fetchTotalMessagesCount(pseudo);
  icons.forEach(i => i.classList.remove('icon-disabled'));
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
