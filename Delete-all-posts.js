(async function() {
    let pageCount = 0;
    let deletedStandardCount = 0;
    let deletedGtaCount = 0;
    let deletedTotalCount = 0;
    let deletedByScriptCount = 0;
    let totalMessagesCount = 0;

    async function analyzeMessages(doc) {
        const messages = doc.querySelectorAll('.bloc-message-forum');
        let deletionAttemptCount = 0;

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
                const messageLink = `https://www.jeuxvideo.com/forums/message/${messageId}`;
                deletionAttemptCount++;
                console.log(`#${deletionAttemptCount} Tentative de suppression du message avec ID: ${messageId}`);
                deletionPromises.push(deleteMessageInHiddenIframe(messageLink, deletionAttemptCount, messageId));
            }
        }

        await Promise.all(deletionPromises);
    }

    async function deleteMessageInHiddenIframe(messageLink, attemptNumber, messageId) {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = messageLink;
        document.body.appendChild(iframe);

        await new Promise(resolve => {
            iframe.addEventListener('load', resolve, { once: true });
        });

        const deleteButton = iframe.contentWindow.document.querySelector('.picto-msg-croix[data-type="delete"]');
        if (deleteButton) {
            deleteButton.click();
            await waitForButtonToDisappear(iframe, messageLink, attemptNumber, messageId);
        }
    }

    async function waitForButtonToDisappear(iframe, messageLink, attemptNumber, messageId) {
        return new Promise((resolve) => {
            let buttonDisappeared = false;

            const checkButtonInterval = setInterval(() => {
                const deleteButton = iframe.contentWindow.document.querySelector('.picto-msg-croix[data-type="delete"]');
                if (!deleteButton && !buttonDisappeared) {
                    buttonDisappeared = true;
                    deletedByScriptCount++;
                    console.log(`#${attemptNumber} Message supprimé avec succès: (ID: ${messageId})`);
                    clearInterval(checkButtonInterval);
                    resolve();
                }
            }, 200);
        });
    }

    async function processCurrentPage() {
        const doc = document;
        await analyzeMessages(doc);
    }

    async function navigateToNextPage() {
        const nextLink = document.querySelector('.xXx.pagi-suivant-actif');
        
        if (nextLink) {
            pageCount++;
            console.log(`Navigation vers la page ${pageCount}: ${nextLink.href}`);

            const response = await fetch(nextLink.href);
            const text = await response.text();

            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/html');

            await analyzeMessages(doc);

            document.open();
            document.write(doc.documentElement.outerHTML);
            document.close();

            window.addEventListener('load', () => {
                navigateToNextPage();
            }, { once: true });
        } else {
            const deletedStandardPercentage = ((deletedStandardCount / totalMessagesCount) * 100).toFixed(2);
            const deletedGtaPercentage = ((deletedGtaCount / totalMessagesCount) * 100).toFixed(2);
            const deletedTotalPercentage = ((deletedTotalCount / totalMessagesCount) * 100).toFixed(2);
            const deletedByScriptPercentage = ((deletedByScriptCount / totalMessagesCount) * 100).toFixed(2);

            console.log(`Aucune page suivante. Total de pages visitées: ${pageCount}`);
            console.log(`Total de messages: ${totalMessagesCount}`);
            console.log(`Total de messages qui étaient déjà supprimés (suppression): ${deletedStandardCount}`);
            console.log(`Total de messages qui étaient déjà supprimés (DDB): ${deletedGtaCount}`);
            console.log(`Total de messages supprimés par le script: ${deletedByScriptCount}`);
            console.log(`Total de messages supprimés (global): ${deletedTotalCount}`);
            console.log(`Pourcentage de messages qui étaient déjà supprimés (suppression): ${deletedStandardPercentage}%`);
            console.log(`Pourcentage de messages qui étaient déjà supprimés (DDB): ${deletedGtaPercentage}%`);
            console.log(`Pourcentage de messages supprimés par le script: ${deletedByScriptPercentage}%`);
            console.log(`Pourcentage de messages supprimés (global): ${deletedTotalPercentage}%`);
        }
    }

    await processCurrentPage();
    await navigateToNextPage();
})();
