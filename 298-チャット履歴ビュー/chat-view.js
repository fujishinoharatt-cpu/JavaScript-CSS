(function () {
    'use strict';

    // =========================================================
    // 設定: アプリIDとフィールドコード
    // =========================================================
    const CONFIG = {
        // 表示場所のスペース要素ID
        VIEW_ID: 'chat_space',

        // 各アプリのID (環境に合わせて書き換えてください)
        APP_ID: {
            CHAT_LOG: 298,   // チャット履歴
            SENDING: 299,    // メッセージ送信
            RECURRING: 300   // 定期配信
        },

        // フィールドコード定義
        FIELDS: {
            // アプリ286 (この画面のレコード)
            LINE_ID: 'line_id',
            USER_NAME: 'user_name',
            RECORD_NUMBER: 'レコード番号',

            // アプリ298 (チャット履歴)
            LOG_MESSAGE: 'message_content',
            LOG_DIRECTION: 'direction',
            LOG_TYPE: 'message_type',
            LOG_TIMESTAMP: 'timestamp',
            LOG_ATTACHMENT: 'attachment',
            LOG_URL: 'URL',

            // アプリ299 (送信)
            SEND_RECIPIENT: 'recipient',  // サブテーブル or 文字列? 今までのコードだと recipient はテーブルではないかも？ -> 要確認。とりあえず文字列として扱う
            SEND_LINE_ID: 'line_id',
            SEND_TEXT: 'message_text',
            SEND_ATTACHMENT: 'attachment_image',
            SEND_STATUS: 'status',

            // アプリ300 (定期配信)
            REC_DATE: 'delivery_date',
            REC_CYCLE: 'cycle',
            REC_STATUS: 'delivery_status',
            REC_MESSAGE: 'message_text',
            REC_ATTACHMENT: 'attachment_image',
            REC_TABLE: 'recipient_table', // テーブル
            REC_TABLE_LINE_ID: 'line_id'  // テーブル内のLineID
        },

        DIRECTION_VALUES: {
            USER: 'USER',
            BOT: 'BOT'
        }
    };

    // =========================================================
    // メイン起動
    // =========================================================
    kintone.events.on('app.record.detail.show', function (event) {
        initChatView(event);
        return event;
    });

    async function initChatView(event) {
        const spaceEl = kintone.app.record.getSpaceElement(CONFIG.VIEW_ID);
        if (!spaceEl) {
            console.warn('[ChatView] Space Element not found:', CONFIG.VIEW_ID);
            return;
        }

        const record = event.record;
        const lineId = (record[CONFIG.FIELDS.LINE_ID] && record[CONFIG.FIELDS.LINE_ID].value) || '';

        // コンテナ初期化
        spaceEl.innerHTML = '';
        spaceEl.classList.add('kintone-chat-container');

        // カラム枠作成
        const colHistory = createColumn('チャット履歴 (298)');
        colHistory.classList.add('column-history');
        const listHistory = colHistory.querySelector('.chat-body-area');
        listHistory.id = 'list-history';

        const colSend = createColumn('メッセージ送信 (299)');
        colSend.classList.add('column-send');
        const listSend = colSend.querySelector('.chat-body-area');
        listSend.id = 'list-send'; // 送信履歴もここに表示
        // 送信フォーム追加
        const formArea = createSendForm(lineId);
        colSend.appendChild(formArea);

        const colRecurring = createColumn('定期配信予約 (300)');
        colRecurring.classList.add('column-recurring');
        const listRecurring = colRecurring.querySelector('.chat-body-area');
        listRecurring.id = 'list-recurring';

        spaceEl.appendChild(colHistory);
        spaceEl.appendChild(colSend);
        spaceEl.appendChild(colRecurring);

        if (!lineId) {
            listHistory.innerHTML = '<div style="padding:20px; color:#fff;">LINE ID未設定</div>';
            return;
        }

        // データ読み込み & 描画
        loadHistory(lineId, listHistory);
        loadSendHistory(lineId, listSend);
        loadRecurring(lineId, listRecurring);
    }

    function createColumn(titleText) {
        const col = document.createElement('div');
        col.classList.add('chat-column');

        const header = document.createElement('div');
        header.classList.add('chat-header-area');
        const title = document.createElement('span');
        title.classList.add('chat-header-title');
        title.innerText = titleText;
        header.appendChild(title);

        // リロードボタン
        // const reloadBtn = document.createElement('button');
        // reloadBtn.innerText = '↺';
        // reloadBtn.onclick = () => { /* 実装省略 */ };
        // header.appendChild(reloadBtn);

        const body = document.createElement('div');
        body.classList.add('chat-body-area');

        col.appendChild(header);
        col.appendChild(body);
        return col;
    }

    // =========================================================
    // 1. チャット履歴 (App 298)
    // =========================================================
    async function loadHistory(lineId, container) {
        container.innerHTML = 'Loading...';
        try {
            const query = `${CONFIG.FIELDS.LINE_ID} = "${lineId}" order by $id asc limit 500`;
            const resp = await kintone.api(kintone.api.url('/k/v1/records', true), 'GET', {
                app: CONFIG.APP_ID.CHAT_LOG,
                query: query
            });

            renderMessageList(container, resp.records, {
                fieldContent: CONFIG.FIELDS.LOG_MESSAGE,
                fieldTime: CONFIG.FIELDS.LOG_TIMESTAMP,
                fieldDirection: CONFIG.FIELDS.LOG_DIRECTION,
                fieldType: CONFIG.FIELDS.LOG_TYPE,
                fieldUrl: CONFIG.FIELDS.LOG_URL,
                fieldAttach: CONFIG.FIELDS.LOG_ATTACHMENT
            });
        } catch (e) {
            container.innerText = 'Error: ' + e.message;
        }
    }

    // =========================================================
    // 2. 送信履歴 (App 299)
    // =========================================================
    async function loadSendHistory(lineId, container) {
        container.innerHTML = 'Loading...';
        try {
            // App 299には「送信方向」フィールドがないため、全て「自分(右側)」として表示する
            // 検索: line_id = "..."
            const query = `${CONFIG.FIELDS.SEND_LINE_ID} = "${lineId}" order by $id asc limit 100`;
            const resp = await kintone.api(kintone.api.url('/k/v1/records', true), 'GET', {
                app: CONFIG.APP_ID.SENDING,
                query: query
            });

            // 描画関数を再利用するが、Directionは固定
            renderMessageList(container, resp.records, {
                fieldContent: CONFIG.FIELDS.SEND_TEXT,
                fieldTime: 'Created_datetime', // 作成日時 (標準)
                fieldDirection: null, // 強制Right
                fieldType: 'text',
                fieldUrl: null, // 画像URLフィールドがない場合は添付ファイルのみ
                fieldAttach: CONFIG.FIELDS.SEND_ATTACHMENT
            }, true); // isSendingApp = true
        } catch (e) {
            container.innerText = 'Error: ' + e.message;
        }
    }

    function createSendForm(lineId) {
        const area = document.createElement('div');
        area.classList.add('chat-input-area');

        const input = document.createElement('textarea');
        input.classList.add('chat-input-textarea');
        input.placeholder = 'メッセージを入力...';

        const toolbar = document.createElement('div');
        toolbar.classList.add('chat-input-toolbar');

        // 簡易添付ボタン（実際はKintoneのUIでは難しいので今回はダミーか、input type=file）
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.style.display = 'block';
        fileInput.style.fontSize = '12px';

        const sendBtn = document.createElement('button');
        sendBtn.classList.add('chat-send-btn');
        sendBtn.innerText = '送信';

        sendBtn.onclick = async () => {
            if (!input.value && !fileInput.files[0]) return;
            const text = input.value;

            // UIロック
            sendBtn.disabled = true;
            sendBtn.innerText = '送信中...';

            try {
                // ファイルアップロード
                let fileKey = null;
                if (fileInput.files.length > 0) {
                    const file = fileInput.files[0];
                    const blob = new Blob([file], { type: file.type });
                    const formData = new FormData();
                    formData.append('__REQUEST_TOKEN__', kintone.getRequestToken());
                    formData.append('file', blob, file.name);

                    const uploadRes = await fetch('/k/v1/file.json', {
                        method: 'POST',
                        headers: { 'X-Requested-With': 'XMLHttpRequest' },
                        body: formData
                    }).then(r => r.json());

                    if (uploadRes.fileKey) {
                        fileKey = uploadRes.fileKey;
                    }
                }

                // レコード登録 (App 299)
                const postBody = {
                    app: CONFIG.APP_ID.SENDING,
                    record: {
                        [CONFIG.FIELDS.SEND_LINE_ID]: { value: lineId },
                        [CONFIG.FIELDS.SEND_TEXT]: { value: text },
                        [CONFIG.FIELDS.SEND_STATUS]: { value: '送信待ち' } // トリガー用
                    }
                };
                if (fileKey) {
                    postBody.record[CONFIG.FIELDS.SEND_ATTACHMENT] = { value: [{ fileKey: fileKey }] };
                }

                await kintone.api(kintone.api.url('/k/v1/record', true), 'POST', postBody);

                // 完了
                alert('送信キューに追加しました。');
                input.value = '';
                fileInput.value = '';

                // 履歴リロード
                const container = document.getElementById('list-send');
                loadSendHistory(lineId, container);

            } catch (e) {
                alert('送信エラー: ' + e.message);
                console.error(e);
            } finally {
                sendBtn.disabled = false;
                sendBtn.innerText = '送信';
            }
        };

        toolbar.appendChild(fileInput);
        toolbar.appendChild(sendBtn);
        area.appendChild(input);
        area.appendChild(toolbar);
        return area;
    }

    // =========================================================
    // 3. 定期配信 (App 300)
    // =========================================================
    async function loadRecurring(lineId, container) {
        container.innerHTML = 'Loading...';
        try {
            // App 300 のサブテーブル (recipient_table) 内の line_id を検索条件にしたいが
            // Kintoneの標準クエリでは "Table.Field = Value" が使える
            const query = `${CONFIG.FIELDS.REC_TABLE}.${CONFIG.FIELDS.REC_TABLE_LINE_ID} = "${lineId}" order by ${CONFIG.FIELDS.REC_DATE} desc limit 20`;
            const resp = await kintone.api(kintone.api.url('/k/v1/records', true), 'GET', {
                app: CONFIG.APP_ID.RECURRING,
                query: query
            });

            renderRecurringList(container, resp.records);
        } catch (e) {
            container.innerText = 'Error: ' + e.message;
        }
    }

    function renderRecurringList(container, records) {
        container.innerHTML = '';
        if (!records || records.length === 0) {
            container.innerHTML = '<div style="color:#fff; padding:10px;">予定はありません</div>';
            return;
        }

        records.forEach(rec => {
            const date = rec[CONFIG.FIELDS.REC_DATE].value;
            const message = rec[CONFIG.FIELDS.REC_MESSAGE].value;
            const cycle = rec[CONFIG.FIELDS.REC_CYCLE].value;
            const status = rec[CONFIG.FIELDS.REC_STATUS].value;

            // 画像
            let imgHtml = '';
            if (rec[CONFIG.FIELDS.REC_ATTACHMENT] && rec[CONFIG.FIELDS.REC_ATTACHMENT].value.length > 0) {
                const fk = rec[CONFIG.FIELDS.REC_ATTACHMENT].value[0].fileKey;
                imgHtml = `<div style="margin-top:5px; font-size:12px; color:#555;">[画像あり]</div>`;
            }

            const el = document.createElement('div');
            el.classList.add('recurring-item');
            el.innerHTML = `
                <div class="recurring-header">
                    <span>${date} (${cycle})</span>
                    <span class="recurring-status" style="color: ${status === '配信完了' ? '#999' : '#28a745'}">${status}</span>
                </div>
                <div class="recurring-body">
                    ${escapeHtml(message)}
                    ${imgHtml}
                </div>
            `;
            container.appendChild(el);
        });
    }


    // =========================================================
    // 共通: メッセージレンダラー (History & Send)
    // =========================================================
    function renderMessageList(container, records, fieldMap, isSendingApp = false) {
        container.innerHTML = '';
        if (!records || records.length === 0) {
            container.innerHTML = '<div style="color:#fff; padding:10px;">履歴なし</div>';
            return;
        }

        let lastDateStr = '';

        records.forEach(rec => {
            const content = (rec[fieldMap.fieldContent] && rec[fieldMap.fieldContent].value) || '';
            const timestamp = (rec[fieldMap.fieldTime] && rec[fieldMap.fieldTime].value) || '';

            // 画像URL (298のみ)
            const urlVal = fieldMap.fieldUrl ? (rec[fieldMap.fieldUrl] && rec[fieldMap.fieldUrl].value) : '';
            // 添付 (298 or 299)
            const attachVal = (rec[fieldMap.fieldAttach] && rec[fieldMap.fieldAttach].value) || [];

            // 方向
            let direction = 'BOT'; // Default
            if (isSendingApp) {
                direction = 'BOT'; // 299は常に送信側(BOT/自分扱い)
            } else if (fieldMap.fieldDirection) {
                direction = (rec[fieldMap.fieldDirection] && rec[fieldMap.fieldDirection].value) || 'BOT';
            }

            const dateObj = new Date(timestamp);
            const dateStr = dateObj.toLocaleDateString();
            const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            // 日付区切り
            if (dateStr !== lastDateStr) {
                const div = document.createElement('div');
                div.classList.add('chat-date-divider');
                div.innerHTML = `<span class="chat-date-label">${dateStr}</span>`;
                container.appendChild(div);
                lastDateStr = dateStr;
            }

            // 行
            const row = document.createElement('div');
            row.classList.add('chat-row');
            if (direction === CONFIG.DIRECTION_VALUES.USER) {
                row.classList.add('chat-row-left');
            } else {
                row.classList.add('chat-row-right');
            }

            // メッセージ行
            const msgRow = document.createElement('div');
            msgRow.classList.add('chat-message-row');

            // Bubble
            const bubble = document.createElement('div');
            bubble.classList.add('chat-bubble');
            if (direction === CONFIG.DIRECTION_VALUES.USER) {
                bubble.classList.add('chat-bubble-white');
            } else {
                bubble.classList.add('chat-bubble-green');
            }

            // 中身
            // 画像優先
            let innerHtml = '';
            if (urlVal) {
                // URLがあるなら画像 (クリックリンク)
                innerHtml += `<a href="${urlVal}" target="_blank"><img src="${urlVal}" style="max-height:150px;"></a>`;
            } else if (attachVal.length > 0) {
                // Kintone添付 (API経由は面倒なので簡易リンク)
                innerHtml += `<div><a href="/k/v1/file.json?fileKey=${attachVal[0].fileKey}" style="color:inherit">[添付ファイル]</a></div>`;
            }

            if (content) {
                innerHtml += `<div>${escapeHtml(content).replace(/\n/g, '<br>')}</div>`;
            }

            bubble.innerHTML = innerHtml || '(内容なし)';

            // 時間
            const timeLabel = document.createElement('div');
            timeLabel.classList.add('chat-time-label');
            timeLabel.innerText = timeStr;

            if (direction === CONFIG.DIRECTION_VALUES.USER) {
                msgRow.appendChild(bubble);
                msgRow.appendChild(timeLabel);
            } else {
                msgRow.appendChild(timeLabel);
                msgRow.appendChild(bubble);
            }

            row.appendChild(msgRow);
            container.appendChild(row);
        });

        // 最下部スクロール
        container.scrollTop = container.scrollHeight;
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>"']/g, function (m) {
            return {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            }[m];
        });
    }

})();
