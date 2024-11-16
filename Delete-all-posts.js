(async function() {
    let pageCount = 0;
    let deletedStandardCount = 0;
    let deletedGtaCount = 0;
    let deletedTotalCount = 0;
    let deletedByScriptCount = 0;
    let totalMessagesCount = 0;
    let failedMessages = [];
    let failedAfterRetry = [];
    const hash = document.querySelector('#ajax_hash_moderation_forum')?.value;

    if (!hash) {
        console.error('Impossible de récupérer le hash correspondant.');
        return;
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
        const deletionPromises = [];

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
                console.log(`Tentative de suppression du message avec ID : ${messageId}.`);
                deletionPromises.push(deleteMessage(hash, messageId, 20));
            }
        }

        await Promise.all(deletionPromises);
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
                    console.log(`Message supprimé avec succès : (ID : ${messageId}).`);
                    success = true;
                } else {
                    throw new Error(`Échec avec le code ${response.status}.`);
                }
            } catch (error) {
                const delay = Math.min(2 ** attempt * 100, 5000);
                console.error(`Tentative ${attempt + 1}/${maxAttempts} pour le message ID : ${messageId} échouée : ${error}, nouvelle tentative dans ${delay} ms.`);
                attempt++;
                await new Promise((resolve) => setTimeout(resolve, delay));
            }
        }

        if (!success && maxAttempts === 20) {
            console.error(`Échec de la suppression du message après ${maxAttempts} tentatives. Le message (ID : ${messageId}) sera réessayé plus tard.`);
            failedMessages.push(messageId);
        } else if (!success) {
            console.error(`Échec définitif de la suppression du message (ID : ${messageId}).`);
            failedAfterRetry.push(messageId);
        }

        return success;
    }

    async function retryFailedMessages() {
        for (const messageId of [...failedMessages]) {
            const success = await deleteMessage(hash, messageId, 5);
            if (success) {
                failedMessages = failedMessages.filter(id => id !== messageId);
            }
        }
    }

    async function processCurrentPage(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        await analyzeMessages(doc);
    }

    async function navigateToNextPage(url, attempt = 1) {
        console.log(`Chargement de la page ${pageCount + 1} : ${url}`);

        try {
            const response = await fetch(url);
            const text = await response.text();
            pageCount++;
            await processCurrentPage(text);

            const doc = new DOMParser().parseFromString(text, 'text/html');
            let nextElement = doc.querySelector('.pagi-after .pagi-suivant-actif');
            if (nextElement) {
                let nextUrl = nextElement.getAttribute('href');
                if (nextElement.classList.contains('JvCare')) {
                    nextUrl = jvCake(nextElement.className);
                }
                await navigateToNextPage(nextUrl);
            } else {
                if (failedMessages.length > 0) {
                    console.log('Tentative de suppression des messages échoués précédemment...');
                    await retryFailedMessages();
                }
                summarizeResults();
            }
        } catch (err) {
            if (attempt < 100) {
                const delay = Math.min(2 ** attempt * 100, 5000);
                console.error(`Réessai de la page en cours (${pageCount + 1}) : ${err}. Nouvelle tentative dans ${delay} ms.`);
                await new Promise(resolve => setTimeout(resolve, delay));
                await navigateToNextPage(url, attempt + 1);
            } else {
                console.error('Échec malgré 100 tentatives de chargement de la page. Arrêt du script.');
                return;
            }
        }
    }

    function summarizeResults() {
        const deletedStandardPercentage = ((deletedStandardCount / totalMessagesCount) * 100).toFixed(2);
        const deletedGtaPercentage = ((deletedGtaCount / totalMessagesCount) * 100).toFixed(2);
        const deletedTotalPercentage = ((deletedTotalCount / totalMessagesCount) * 100).toFixed(2);
        const deletedByScriptPercentage = ((deletedByScriptCount / totalMessagesCount) * 100).toFixed(2);
        const failedMessagesCount = failedMessages.length;
        const failedAfterRetryCount = failedAfterRetry.length;

        console.log(
            `Analyse terminée. Total de pages parcourues : ${pageCount}\n` +
            `Total de messages postés par le compte : ${totalMessagesCount}\n` +
            `Messages déjà supprimés (standard) : ${deletedStandardCount} (${deletedStandardPercentage}%)\n` +
            `Messages déjà supprimés (DDB) : ${deletedGtaCount} (${deletedGtaPercentage}%)\n` +
            `Messages supprimés par le script : ${deletedByScriptCount} (${deletedByScriptPercentage}%)\n` +
            `Messages supprimés (global) : ${deletedTotalCount} (${deletedTotalPercentage}%)`
        );

        if (failedMessagesCount > 0 || failedAfterRetryCount > 0) {
            console.log(
                `Messages échoués en premier essai : ${failedMessagesCount} (${((failedMessagesCount / totalMessagesCount) * 100).toFixed(2)}%)` +
                (failedAfterRetryCount > 0 ? `, Messages échoués malgré réessais : ${failedAfterRetryCount} (${((failedAfterRetryCount / totalMessagesCount) * 100).toFixed(2)}%)` : '')
            );
        }
    }

    await navigateToNextPage(window.location.href);
})();
