/* =========================================================
   CCVN Editor - vngo.js
   비주얼 노벨 실행 및 HTML 세션 전달
   ========================================================= */

(() => {
    "use strict";

    const startButton = document.getElementById("ccvnButton");
    const statusMessage = document.getElementById("statusMessage");

    if (!startButton) {
        console.error(
            "CCVN Editor: 비주얼 노벨 버튼(#ccvnButton)을 찾을 수 없습니다."
        );
        return;
    }

    startButton.addEventListener("click", () => {
        if (
            !window.CCVNEditor ||
            typeof window.CCVNEditor.createExportHtml !== "function"
        ) {
            if (statusMessage) {
                statusMessage.textContent =
                    "HTML 생성 기능을 찾을 수 없습니다. app.js를 확인해 주세요.";
            }
            return;
        }

        try {
            // 기존 내보내기 기능으로 완성된 HTML 생성
            const html = window.CCVNEditor.createExportHtml();

            if (!html || !html.trim()) {
                throw new Error("생성된 HTML이 비어 있습니다.");
            }

            // 파일 다운로드 대신 세션에 HTML 저장
            sessionStorage.setItem("ccvnVisualNovelHtml", html);

            // 비주얼 노벨 페이지로 이동
            window.location.href = "ccvn.html";

        } catch (error) {
            console.error("비주얼 노벨 실행 오류:", error);

            if (statusMessage) {
                statusMessage.textContent =
                    "비주얼 노벨을 실행하지 못했습니다. 콘솔을 확인해 주세요.";
            }
        }
    });
})();
