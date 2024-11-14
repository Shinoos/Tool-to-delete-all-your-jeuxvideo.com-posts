(async function() {
    let pageCount = 0;
    let deletedStandardCount = 0;
    let deletedGtaCount = 0;
    let deletedTotalCount = 0;
    let deletedByScriptCount = 0;
    let totalMessagesCount = 0;

    function jvCake(classe) {
        const base16 = '0A12B34C56D78E9F';
        let lien = '';
        const s = classe.split(' ')[1];
        for (let i = 0; i < s.length; i += 2) {
            lien += String.fromCharCode(base16.indexOf(s.charAt(i)) * 16 + base16.indexOf(s.charAt(i + 1)));
        }
        return lien;
    }

    async function analyzeMessages(doc) {
        const messages = doc.querySelectorAll('.bloc-message-forum');
        const hash = doc.querySelector('#ajax_hash_moderation_forum')?.value;

        if (!hash) {
            console.log("Impossible de récupérer le hash correspondant.");
            return;
        }

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
                console.log(`Tentative de suppression du message avec ID: ${messageId}`);
                deletionPromises.push(deleteMessage(hash, messageId));
            }
        }

        await Promise.all(deletionPromises);
    }

    async function deleteMessage(hash, messageId) {
        try {
            const response = await fetch(`https://www.jeuxvideo.com/forums/modal_del_message.php?type=delete&ajax_hash=${hash}&tab_message[]=${messageId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': '*/*',
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });

            if (response.ok) {
                deletedByScriptCount++;
                console.log(`Message supprimé avec succès : (ID: ${messageId})`);
            } else {
                console.log(`Échec de la suppression du message : (ID: ${messageId})`);
            }
        } catch (error) {
            console.log(`Erreur lors de la suppression du message (ID: ${messageId}):`, error);
        }
    }

    async function processCurrentPage(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        await analyzeMessages(doc);
    }

    async function navigateToNextPage(url, attempt = 1, delay = 1000) {
        pageCount++;
        console.log(`Chargement de la page ${pageCount} : ${url}`);
        
        try {
            const response = await fetch(url);
            const text = await response.text();
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
                summarizeResults();
            }
        } catch (err) {
            if (attempt < 100) {
                console.log(`Erreur ${attempt}/100 lors du chargement de la page : ${err}. Nouvelle tentative dans ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                await navigateToNextPage(url, attempt + 1, delay + 1000);
            } else {
                console.log('Échec malgré 100 tentatives de chargement de la page.');
            }
        }
    }

    function summarizeResults() {
        const deletedStandardPercentage = ((deletedStandardCount / totalMessagesCount) * 100).toFixed(2);
        const deletedGtaPercentage = ((deletedGtaCount / totalMessagesCount) * 100).toFixed(2);
        const deletedTotalPercentage = ((deletedTotalCount / totalMessagesCount) * 100).toFixed(2);
        const deletedByScriptPercentage = ((deletedByScriptCount / totalMessagesCount) * 100).toFixed(2);

        console.log(`Analyse terminée. Total de pages parcourues : ${pageCount}\n` +
                    `Total de messages postés par le compte : ${totalMessagesCount}\n` +
                    `Messages qui étaient déjà supprimés (standard) : ${deletedStandardCount} (${deletedStandardPercentage}%)\n` +
                    `Messages qui étaient déjà supprimés (DDB) : ${deletedGtaCount} (${deletedGtaPercentage}%)\n` +
                    `Messages supprimés par le script : ${deletedByScriptCount} (${deletedByScriptPercentage}%)\n` +
                    `Messages supprimés (global) : ${deletedTotalCount} (${deletedTotalPercentage}%)`);
    }

    await navigateToNextPage(window.location.href);
})();
