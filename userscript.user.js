// ==UserScript==
// @name         Tool-to-delete-all-your-jeuxvideo.com-posts
// @description  Tool to delete all your posts on the jeuxvideo.com forums.
// @author       Shinoos
// @version      1.0.3
// @match        https://www.jeuxvideo.com/profil/*?mode=historique_forum
// @connect      raw.githubusercontent.com
// @updateURL    https://raw.githubusercontent.com/Shinoos/Tool-to-delete-all-your-jeuxvideo.com-posts/refs/heads/main/userscript.user.js
// @downloadURL  https://raw.githubusercontent.com/Shinoos/Tool-to-delete-all-your-jeuxvideo.com-posts/refs/heads/main/userscript.user.js
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    function addDeleteButton() {
        const pageInfo = document.querySelector('.bloc-pagi-default');
        if (!pageInfo) return;

        const headerPseudo = document.querySelector('.headerAccount__pseudo')?.textContent.trim();
        const urlParams = new URLSearchParams(window.location.search);
        const urlPseudo = urlParams.get('mode') === 'historique_forum' ? window.location.pathname.split('/')[2] : '';

        if (headerPseudo && urlPseudo && headerPseudo.toLowerCase() === urlPseudo.toLowerCase()) {
            const buttonDiv = document.createElement('div');
            const button = document.createElement('button');
            button.textContent = "Supprimer tous mes messages";
            button.style.padding = "8px 16px";
            button.style.fontSize = "14px";
            button.style.cursor = "pointer";
            button.style.fontWeight = "bold";
            button.style.backgroundColor = "#2e3238";
            button.style.color = "white";
            button.style.border = "none";
            button.style.borderRadius = "5px";
            button.style.fontFamily = "Arial, sans-serif";
            button.style.transition = "background-color 0.3s ease, transform 0.5s ease";
            buttonDiv.appendChild(button);
            pageInfo.insertBefore(buttonDiv, pageInfo.firstChild);

            button.addEventListener('mouseover', function() {
                button.style.backgroundColor = "#353a42";
                button.style.transform = "scale(1.05)";
            });

            button.addEventListener('mouseout', function() {
                button.style.backgroundColor = "#2e3238";
                button.style.transform = "scale(1)";
            });

            button.addEventListener('mousedown', function() {
                button.style.transform = "scale(0.95)";
            });

            button.addEventListener('mouseup', function() {
                button.style.transform = "scale(1)";
            });

            button.addEventListener('click', function() {
    		executeDeleteScript();
    		button.style.display = 'none';
	    });
        }
    }

    function executeDeleteScript() {
        GM_xmlhttpRequest({
            method: "GET",
            url: "https://raw.githubusercontent.com/Shinoos/Tool-to-delete-all-your-jeuxvideo.com-posts/refs/heads/main/Delete-all-posts.js",
            onload: function(response) {
                const script = document.createElement('script');
                script.textContent = response.responseText;
                document.body.appendChild(script);
            },
            onerror: function() {
                alert("Tool-to-delete-all-your-jeuxvideo.com-posts → Impossible de charger le script.");
            }
        });
    }

    window.addEventListener('load', addDeleteButton);

})();
