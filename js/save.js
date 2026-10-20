/* =========================================================
   CCVN Editor - save.js
   HTML 파일 저장 기능
   ========================================================= */

(() => {
    "use strict";

    const saveButton = document.getElementById("saveHtmlButton");
    const statusMessage = document.getElementById("statusMessage");

    if (!saveButton) {
        console.error(
            "CCVN Editor: 저장 버튼(#saveHtmlButton)을 찾을 수 없습니다."
        );
        return;
    }

    saveButton.addEventListener("click", () => {
        // app.js에서 내보내기 함수가 준비되었는지 확인
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

            // HTML 파일 다운로드 준비
            const blob = new Blob(
                [html],
                { type: "text/html;charset=utf-8" }
            );

            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");

            link.href = url;
            link.download = "CCVN-logs.html";

            document.body.appendChild(link);
            link.click();
            link.remove();

            // 다운로드 주소 정리
            setTimeout(() => {
                URL.revokeObjectURL(url);
            }, 1000);

            if (statusMessage) {
                statusMessage.textContent =
                    "HTML 파일 저장을 시작했습니다.";
            }
        } catch (error) {
            console.error("HTML 저장 오류:", error);

            if (statusMessage) {
                statusMessage.textContent =
                    "HTML 저장 중 오류가 발생했습니다. 개발자 콘솔을 확인해 주세요.";
            }
        }
    });
})();
