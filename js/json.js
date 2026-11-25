
document.getElementById('compareExportButton')
    .addEventListener('click', async () => {

    const htmlInput = document.getElementById('compareHtmlFile');
    const jsonInput = document.getElementById('compareJsonFile');
    const status = document.getElementById('compareExportStatus');

    try {
        // 1. 파일 선택 확인
        const htmlFile = htmlInput.files[0];
        const jsonFile = jsonInput.files[0];

        if (!htmlFile || !jsonFile) {
            alert('HTML 파일과 JSON 파일을 모두 선택해주세요.');
            return;
        }

        status.textContent = '파일을 읽는 중입니다...';

        // 2. 파일 읽기
        const htmlText = await htmlFile.text();
        const jsonText = await jsonFile.text();

        // 3. JSON 파싱
        const jsonData = JSON.parse(jsonText);

        if (!Array.isArray(jsonData.messages)) {
            throw new Error('JSON에 messages 배열이 없습니다.');
        }

        // 4. HTML 파싱
        const parser = new DOMParser();
        const htmlDoc = parser.parseFromString(
            htmlText,
            'text/html'
        );

        const htmlMessages = htmlDoc.querySelectorAll(
            'article.message'
        );

        // 공백 정규화 함수
        function normalizeText(text) {
            return (text || '')
                .replace(/\s+/g, ' ')
                .trim();
        }

        // 5. HTML의 타임스탬프 수집
        const htmlTimestamps = new Set();

        // 타임스탬프가 없는 시스템 메시지 수집
        const htmlSystemMessages = new Map();

        htmlMessages.forEach(article => {

            const timeElement = article.querySelector('time');
            const messageElement = article.querySelector(
                '.message-text'
            );

            if (!messageElement) return;

            // 타임스탬프가 존재하는 메시지
            if (timeElement) {

                const timestamp = new Date(
                    timeElement.getAttribute('datetime')
                ).getTime();

                if (!Number.isNaN(timestamp)) {
                    htmlTimestamps.add(timestamp);
                }

            }

            // 타임스탬프가 없는 시스템 메시지
            else if (article.classList.contains('system')) {

                const text = normalizeText(
                    messageElement.textContent
                );

                htmlSystemMessages.set(
                    text,
                    (htmlSystemMessages.get(text) || 0) + 1
                );

            }

        });

        // 6. JSON 메시지 필터링
        const filteredMessages = jsonData.messages.filter(message => {

            // 작성 시각이 일치하면 유지
            if (
                htmlTimestamps.has(Number(message.createdAt))
            ) {
                return true;
            }

            // 타임스탬프가 없는 시스템 메시지는
            // 대사 내용과 개수를 기준으로 비교
            if (message.type === 'system') {

                const text = normalizeText(message.text);

                const count = htmlSystemMessages.get(text) || 0;

                if (count > 0) {

                    htmlSystemMessages.set(text, count - 1);

                    return true;
                }

            }

            // HTML에 존재하지 않는 메시지는 제외
            return false;

        });

        // 7. 기존 JSON 구조 유지
        const result = {
            ...jsonData,
            messages: filteredMessages
        };

        // 8. JSON 다운로드
        const blob = new Blob(
            [JSON.stringify(result, null, 2)],
            { type: 'application/json;charset=utf-8' }
        );

        const url = URL.createObjectURL(blob);

        const downloadLink = document.createElement('a');

        downloadLink.href = url;

        downloadLink.download =
            jsonFile.name.replace(/\.json$/i, '') +
            '_HTML_FILTERED.json';

        document.body.appendChild(downloadLink);

        downloadLink.click();

        downloadLink.remove();

        URL.revokeObjectURL(url);

        // 9. 결과 안내
        status.textContent =
            `추출 완료! 전체 ${jsonData.messages.length}개 중 ` +
            `${filteredMessages.length}개를 추출했습니다.`;

    } catch (error) {

        console.error('HTML 대사 추출 오류:', error);

        status.textContent =
            '오류가 발생했습니다: ' + error.message;

        alert('파일 처리 중 오류가 발생했습니다.\n' + error.message);

    }

});
