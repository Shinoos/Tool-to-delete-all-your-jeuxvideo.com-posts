(async function main() {
  const scriptVersion = "v1.1.1";
  checkScriptVersion();
  let scriptStatus = "En cours d'exécution";
  let scriptError = false;
  let currentUrl = window.location.href;
  let currentPageHtml = null;
  let pageCount = 0;
  let deletedStandardCount = 0;
  let deletedGtaCount = 0;
  let deletedTotalCount = 0;
  let deletedByScriptCount = 0;
  let totalMessagesCount = 0;
  let error503Count = 0;
  let waitingSeconds = 0;
  let waitingInterval = null;
  let isPaused = false;
  let isPendingRequest = false;
  let lastPageAnalyzed = false;
  const processedMessages = new Set();
  const failedMessages = new Set();
  const failedAfterRetry = new Set();
  const hash = document.querySelector('#ajax_hash_moderation_forum')?.value;
  const ui = document.createElement('div');
  ui.style.position = 'fixed';
  ui.style.bottom = '10px';
  ui.style.right = '10px';
  ui.style.padding = '15px';
  ui.style.background = 'rgba(0, 0, 0, 0.8)';
  ui.style.color = 'white';
  ui.style.borderRadius = '10px';
  ui.style.fontFamily = 'Arial, sans-serif';
  ui.style.fontSize = '12px';
  ui.style.boxShadow = '0px 0px 10px 5px rgba(0, 0, 0, 0.5)';
  ui.style.zIndex = 9999;
  document.body.appendChild(ui);

  hash || (console.error('Impossible de récupérer le hash correspondant.'), scriptError = true, scriptStatus = "Impossible de récupérer le hash correspondant", updateUI(), (() => {
    throw new Error('Arrêt du script.');
  })());

  const controls = document.createElement('div');
  controls.id = 'controls';
  controls.style.marginBottom = '10px';
  ui.appendChild(controls);

  const statusDisplay = document.createElement('div');
  statusDisplay.id = 'status-display';
  ui.appendChild(statusDisplay);

  window.pauseScript = function() {
    if (!isPaused) {
      isPaused = true;
      scriptStatus = "En pause";
      updateUI();
    }
  };

  window.resumeScript = function() {
    if (isPaused && !isPendingRequest) {
      isPaused = false;
      scriptStatus = "En cours d'exécution";
      updateUI();

      if (lastPageAnalyzed && currentPageHtml) {
        const doc = new DOMParser().parseFromString(currentPageHtml, 'text/html');
        let nextUrl = getNextPageUrl(doc);
        
        if (nextUrl) {
          navigateToNextPage(nextUrl);
        } else {
          if (failedMessages.size > 0) {
            retryFailedMessages();
          }
          scriptStatus = "Terminé";
          updateUI();
        }
      } 
      else if (currentPageHtml && !lastPageAnalyzed) {
        const doc = new DOMParser().parseFromString(currentPageHtml, 'text/html');
        analyzeMessages(doc).then(() => {
          lastPageAnalyzed = true;
          window.resumeScript();
        });
      } 
      else {
        navigateToNextPage(currentUrl);
      }
    }
  };

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
      }
    }, 1000);
  }

  function updateUI() {
    const deletedStandardPercentage = totalMessagesCount ? ((deletedStandardCount / totalMessagesCount) * 100).toFixed(2) : 0;
    const deletedGtaPercentage = totalMessagesCount ? ((deletedGtaCount / totalMessagesCount) * 100).toFixed(2) : 0;
    const deletedTotalPercentage = totalMessagesCount ? ((deletedTotalCount / totalMessagesCount) * 100).toFixed(2) : 0;
    const deletedByScriptPercentage = totalMessagesCount ? ((deletedByScriptCount / totalMessagesCount) * 100).toFixed(2) : 0;
    const spinnerHtml = waitingSeconds > 0 ? `<span style="display: inline-block; animation: spin 1s linear infinite;">⏳</span> (${waitingSeconds}s)` : '';
    const statusColor = scriptError ? 'red' : isPaused ? 'orange' : '#90EE90';

    const controlsElement = document.getElementById('controls');
    if (!controlsElement.innerHTML) {
      controlsElement.innerHTML = `
    <button onclick="pauseScript()" style="margin: 5px; padding: 4px 8px; background: #1e1f22; border: none; border-radius: 5px; color: white; cursor: ${isPaused ? 'not-allowed' : 'pointer'}; opacity: ${isPaused ? '0.5' : '1'}; box-shadow: 0 0 3px #333, 0 0 10px #1e1f22; transition: box-shadow 0.3s, background 0.3s;" ${isPaused ? 'disabled' : ''}>Pause</button>
    <button onclick="resumeScript()" style="margin: 5px; padding: 4px 8px; background: #1e1f22; border: none; border-radius: 5px; color: white; cursor: ${(isPaused && waitingSeconds <= 0) ? 'pointer' : 'not-allowed'}; opacity: ${(isPaused && waitingSeconds <= 0) ? '1' : '0.5'}; box-shadow: 0 0 3px #333, 0 0 10px #1e1f22; transition: box-shadow 0.3s, background 0.3s;" ${isPaused && waitingSeconds <= 0 ? '' : 'disabled'}>Reprendre</button>
    `;

    } else {
      const pauseButton = controlsElement.querySelector('button:first-child');
      const resumeButton = controlsElement.querySelector('button:nth-child(2)');
      pauseButton.style.cursor = isPaused ? 'not-allowed' : 'pointer';
      pauseButton.style.opacity = isPaused ? '0.5' : '1';
      pauseButton.disabled = isPaused;
      resumeButton.style.cursor = (isPaused && waitingSeconds <= 0) ? 'pointer' : 'not-allowed';
      resumeButton.style.opacity = (isPaused && waitingSeconds <= 0) ? '1' : '0.5';
      resumeButton.disabled = !(isPaused && waitingSeconds <= 0);
    }

    const statusElement = document.getElementById('status-display');
    statusElement.innerHTML = `
        <h4 style="margin: 0; font-size: 14px;">Delete-all-posts.js <span style="font-size: 10px; color: #aaa;">${scriptVersion}</span></h4>
        <p style="margin: 5px 0;">État du script : <span style="color: ${statusColor};">${scriptStatus} ${spinnerHtml}</span></p>
        <p style="margin: 5px 0;">Pages parcourues : ${pageCount}</p>
        <p style="margin: 5px 0;">Messages analysés : ${totalMessagesCount}</p>
        <p style="margin: 5px 0;">Messages déjà supprimés : ${deletedStandardCount} (${deletedStandardPercentage}%)</p>
        <p style="margin: 5px 0;">Messages déjà supprimés (GTA) : ${deletedGtaCount} (${deletedGtaPercentage}%)</p>
        <p style="margin: 5px 0;">Messages supprimés par le script : ${deletedByScriptCount} (${deletedByScriptPercentage}%)</p>
        <p style="margin: 5px 0;">Total supprimés : ${deletedTotalCount} (${deletedTotalPercentage}%)</p>
        <p style="margin: 5px 0; color: ${failedMessages.size > 0 ? 'red' : 'white'}; display: ${failedMessages.size > 0 ? '' : 'none'};">Échecs en attente : ${failedMessages.size}</p>
        <p style="margin: 5px 0; color: ${failedAfterRetry.size > 0 ? 'red' : 'white'}; display: ${failedAfterRetry.size > 0 ? '' : 'none'};">Échecs définitifs : ${failedAfterRetry.size}</p>
    `;

    if (!document.getElementById('ui-style')) {
      const style = document.createElement('style');
      style.id = 'ui-style';
      style.textContent = `
            button:not(:disabled):hover {
                background: #2c2f33 !important;
            }
            @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
        `;
      document.head.appendChild(style);
    }
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

    for (const message of messages) {
      const messageId = message.getAttribute('data-id');

      if (processedMessages.has(messageId)) {
        continue;
      }

      if (message.classList.contains('msg-supprime')) {
        deletedStandardCount++;
        deletedTotalCount++;
        processedMessages.add(messageId);
        totalMessagesCount++;
      } else if (message.classList.contains('msg-supprime-gta')) {
        deletedGtaCount++;
        deletedTotalCount++;
        processedMessages.add(messageId);
        totalMessagesCount++;
      } else {
        promises.push(deleteMessage(hash, messageId, 20).then((success) => {
          processedMessages.add(messageId);
          totalMessagesCount++;
        }));
      }
    }

    await Promise.all(promises);
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
          scriptStatus = "Erreur 403 : Veuillez résoudre le CAPTCHA Cloudflare puis cliquer sur Reprendre.";
          updateUI();
          throw error;
        }

        const delay = Math.min(2 ** attempt * 100, 5000);
        attempt++;
        await new Promise((resolve) => setTimeout(resolve, delay));
      } finally {
        isPendingRequest = false;
      }
    }

    if (success) {
      failedMessages.delete(messageId);
      failedAfterRetry.delete(messageId);
      error503dMCount = 0;
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
    if (isPaused) {
      await new Promise((resolve) => setTimeout(resolve, 100));
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
        scriptStatus = "Erreur 403 : Veuillez résoudre le CAPTCHA Cloudflare puis cliquer sur Reprendre.";
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
      lastPageAnalyzed = true;

      if (isPaused) {
        return;
      }

      let nextUrl = getNextPageUrl(doc);
      if (nextUrl) {
        await navigateToNextPage(nextUrl);
      } else {
        if (failedMessages.size > 0) {
          await retryFailedMessages();
        }
        scriptStatus = "Terminé";
        updateUI();
      }
    } catch (err) {
      if (err.message.includes('403')) {
        isPaused = true;
        scriptStatus = "Erreur 403 : Veuillez résoudre le CAPTCHA Cloudflare puis cliquer sur Reprendre.";
        updateUI();
        return;
      }

      if (attempt < 20) {
        const delay = Math.min(2 ** attempt * 100, 5000);
        await new Promise((resolve) => setTimeout(resolve, delay));
        await navigateToNextPage(url, attempt + 1);
      } else {
        scriptError = true;
        scriptStatus = "Erreur";
        updateUI();
        console.error('Échec définitif du chargement de la prochaine page.');
      }
    } finally {
      isPendingRequest = false;
      updateUI();
    }
  }

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

  updateUI();
  await navigateToNextPage(currentUrl);
})();
