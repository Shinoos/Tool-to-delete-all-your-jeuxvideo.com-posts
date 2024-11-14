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
            console.error("Impossible de récupérer le hash correspondant.");
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
            console.error(`Erreur lors de la suppression du message (ID: ${messageId}):`, error);
        }
    }

    async function processCurrentPage(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        await analyzeMessages(doc);
    }

    async function navigateToNextPage(url) {
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
            console.error('Erreur lors du chargement de la page :', err);
        }
    }

    function summarizeResults() {
        const deletedStandardPercentage = ((deletedStandardCount / totalMessagesCount) * 100).toFixed(2);
        const deletedGtaPercentage = ((deletedGtaCount / totalMessagesCount) * 100).toFixed(2);
        const deletedTotalPercentage = ((deletedTotalCount / totalMessagesCount) * 100).toFixed(2);
        const deletedByScriptPercentage = ((deletedByScriptCount / totalMessagesCount) * 100).toFixed(2);

        console.log(`Analyse terminée. Total de pages parcourues : ${pageCount}`);
        console.log(`Total de messages postés : ${totalMessagesCount}`);
        console.log(`Messages qui étaient déjà supprimés (standard) : ${deletedStandardCount} (${deletedStandardPercentage}%)`);
        console.log(`Messages qui étaient déjà supprimés (DDB) : ${deletedGtaCount} (${deletedGtaPercentage}%)`);
        console.log(`Messages supprimés par le script : ${deletedByScriptCount} (${deletedByScriptPercentage}%)`);
        console.log(`Messages supprimés (global) : ${deletedTotalCount} (${deletedTotalPercentage}%)`);
    }

    await navigateToNextPage(window.location.href);
})();
