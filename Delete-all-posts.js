(async function() {
    const scriptVersion = 'v1.0.3';
    let scriptStatus = "En cours d'exécution";
    let scriptError = false;
    let pageCount = 0;
    let deletedStandardCount = 0;
    let deletedGtaCount = 0;
    let deletedTotalCount = 0;
    let deletedByScriptCount = 0;
    let totalMessagesCount = 0;
    const failedMessages = new Set();
    const failedAfterRetry = new Set();
    const hash = document.querySelector('#ajax_hash_moderation_forum')?.value;

    if (!hash) {
        console.error('Impossible de récupérer le hash correspondant.');
        scriptError = true;
        updateUI();
        return;
    }

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

    function updateUI() {
    const deletedStandardPercentage = totalMessagesCount ? ((deletedStandardCount / totalMessagesCount) * 100).toFixed(2) : 0;
    const deletedGtaPercentage = totalMessagesCount ? ((deletedGtaCount / totalMessagesCount) * 100).toFixed(2) : 0;
    const deletedTotalPercentage = totalMessagesCount ? ((deletedTotalCount / totalMessagesCount) * 100).toFixed(2) : 0;
    const deletedByScriptPercentage = totalMessagesCount ? ((deletedByScriptCount / totalMessagesCount) * 100).toFixed(2) : 0;

    ui.innerHTML = `
    <h4 style="margin: 0; font-size: 14px;">Delete-all-posts.js <span style="font-size: 10px; color: #aaa;">${scriptVersion}</span></h4>
    <p style="margin: 5px 0;">État du script : <span style="color: ${scriptError ? 'red' : '#90EE90'};">${scriptError ? "Erreur" : scriptStatus}</span></p>
    <p style="margin: 5px 0;">Pages parcourues : ${pageCount}</p>
    <p style="margin: 5px 0;">Messages analysés : ${totalMessagesCount}</p>
    <p style="margin: 5px 0;">Messages supprimés (standard) : ${deletedStandardCount} (${deletedStandardPercentage}%)</p>
    <p style="margin: 5px 0;">Messages supprimés (DDB) : ${deletedGtaCount} (${deletedGtaPercentage}%)</p>
    <p style="margin: 5px 0;">Messages supprimés par le script : ${deletedByScriptCount} (${deletedByScriptPercentage}%)</p>
    <p style="margin: 5px 0;">Total supprimés : ${deletedTotalCount} (${deletedTotalPercentage}%)</p>
    <p style="margin: 5px 0; color: ${failedMessages.size > 0 ? 'red' : 'white'}; display: ${failedMessages.size > 0 ? '' : 'none'};">Échecs en attente : ${failedMessages.size}</p>
    <p style="margin: 5px 0; color: ${failedAfterRetry.size > 0 ? 'red' : 'white'}; display: ${failedAfterRetry.size > 0 ? '' : 'none'};">Échecs définitifs : ${failedAfterRetry.size}</p>
    `;
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
            totalMessagesCount++;
            if (message.classList.contains('msg-supprime')) {
                deletedStandardCount++;
                deletedTotalCount++;
            } else if (message.classList.contains('msg-supprime-gta')) {
                deletedGtaCount++;
                deletedTotalCount++;
            } else {
                const messageId = message.getAttribute('data-id');
                promises.push(deleteMessage(hash, messageId, 20));
            }
        }

        await Promise.all(promises);
        updateUI();
    }

    async function deleteMessage(hash, messageId, maxAttempts) {
        let attempt = 0;
        let success = false;

        while (attempt < maxAttempts && !success) {
            try {
                const response = await fetch(
                    `https://www.jeuxvideo.com/forums/modal_del_message.php?type=delete&ajax_hash=${hash}&tab_message[]=${messageId}`,
                    {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/x-www-form-urlencoded',
                            'Accept': '*/*',
                            'X-Requested-With': 'XMLHttpRequest',
                        },
                    }
                );

                if (response.ok) {
                    deletedByScriptCount++;
                    deletedTotalCount++;
                    success = true;
                } else {
                    throw new Error(`Échec avec le code ${response.status}.`);
                }
            } catch (error) {

                const delay = Math.min(2 ** attempt * 100, 5000);
                attempt++;
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }

        if (success) {
            failedMessages.delete(messageId);
            failedAfterRetry.delete(messageId);
            updateUI();
        } else if (maxAttempts === 20) {
            failedMessages.add(messageId);
            updateUI();
        } else {
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
        try {
            const response = await fetch(url);
            const text = await response.text();
            pageCount++;
            updateUI();

            const doc = new DOMParser().parseFromString(text, 'text/html');
            await analyzeMessages(doc);

            let nextElement = doc.querySelector('.pagi-after .pagi-suivant-actif');
            if (nextElement) {
                let nextUrl = nextElement.getAttribute('href');
                if (nextElement.classList.contains('JvCare')) {
                    nextUrl = jvCake(nextElement.className);
                }
                await navigateToNextPage(nextUrl);
            } else {
                if (failedMessages.size > 0) {
                    await retryFailedMessages();
                }
                scriptStatus = "Terminé";
                updateUI();
            }
        } catch (err) {
            if (attempt < 20) {
                const delay = Math.min(2 ** attempt * 100, 5000);
                await new Promise((resolve) => setTimeout(resolve, delay));
                await navigateToNextPage(url, attempt + 1);
            } else {
                scriptError = true;
                updateUI();
                console.error('Échec définitif du chargement.');
            }
        }
    }

    const currentUrl = window.location.href;
    await navigateToNextPage(currentUrl);
})();
