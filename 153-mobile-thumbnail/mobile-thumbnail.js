(function () {
    'use strict';

    // 画面のはみ出しを防ぎ、ラベルと値の幅を綺麗に調整する機能（※制限するCSSは撤廃）
    function injectMobileStyles() {
        if (document.getElementById('custom-mobile-fix-style')) return;
        var style = document.createElement('style');
        style.id = 'custom-mobile-fix-style';
        style.innerHTML = `
            /* Kintoneの標準のラベル（工程名などのタイトル）の幅を縮め、データ表示の幅を広げる */
            .gaia-mobile-v2-reclist-item-label {
                width: 35% !important;
                min-width: unset !important;
                white-space: normal !important;
                word-wrap: break-word !important;
            }
            .gaia-mobile-v2-reclist-item-value {
                width: 65% !important;
                white-space: normal !important;
                word-wrap: break-word !important;
            }
            /* サムネイルの親コンテナは100%幅で配置 */
            .custom-m-thumbnail {
                width: 100%;
                margin-top: 8px;
            }
        `;
        document.head.appendChild(style);
    }

    // モバイル版のレコード一覧画面が表示された時のイベント
    kintone.events.on('mobile.app.record.index.show', function (event) {
        // スタイルを注入して文字の横への見切れを防止
        injectMobileStyles();

        var records = event.records;
        if (!records || records.length === 0) return event;

        // Kintoneの「スクロールするとDOMが再構築されて画像が消える・高さがおかしくなる」問題への対策
        // 1秒に1回、画像が消えてしまっていないか定期チェックして自動で再描写する
        setInterval(function () {
            var fieldElements = kintone.mobile.app.getFieldElements('現象') || kintone.mobile.app.getFieldElements('工程部署');

            if (!fieldElements || fieldElements.length === 0) return;

            // スクロール時に件数がズレる可能性があるため、recordsとDOMの少ない方に合わせる
            var maxLen = Math.min(records.length, fieldElements.length);

            for (var i = 0; i < maxLen; i++) {
                var record = records[i];
                var images = record['不適合画像'] ? record['不適合画像'].value : [];
                if (images.length === 0) continue;

                var baseEl = fieldElements[i];
                if (!baseEl) continue;

                // すでにその行（現象の枠）にサムネイルが挿入されている場合はスキップ
                if (baseEl.querySelector('.custom-m-thumbnail')) continue;

                // 画像を並べるための箱を作成
                var imgArea = document.createElement('div');
                imgArea.className = 'custom-m-thumbnail';
                imgArea.style.display = 'flex';
                imgArea.style.flexWrap = 'wrap';
                imgArea.style.gap = '8px';

                // 画像の枚数分ループ
                images.forEach(function (imgInfo) {
                    var img = document.createElement('img');
                    img.style.width = '60px';  // すこしスリムにしてはみ出しを確実に防止
                    img.style.height = '60px';
                    img.style.objectFit = 'cover';
                    img.style.borderRadius = '6px';
                    img.style.border = '1px solid #ddd';

                    var apiUri = kintone.api.url('/k/v1/file.json', true) + '?fileKey=' + imgInfo.fileKey;
                    var xhr = new XMLHttpRequest();
                    xhr.open('GET', apiUri, true);
                    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
                    xhr.responseType = 'blob'; // 画像取得

                    xhr.onload = function () {
                        if (xhr.status === 200) {
                            var blobUrl = window.URL.createObjectURL(xhr.response);
                            img.src = blobUrl;
                            img.onclick = function (e) {
                                e.stopPropagation();
                                window.open(blobUrl, '_blank');
                            };
                        }
                    };
                    xhr.send();

                    imgArea.appendChild(img);
                });

                // 【超重要】カードの「下」ではなく、「現象」の文字が入っているセルの中に直接挿入する
                // こうすることで、Kintone側がセルの高さを自動で伸ばしてくれて、はみ出し（クリッピング）を防ぐことができる
                baseEl.appendChild(imgArea);
            }
        }, 1000); // スクロールや再描画負けを防ぐために1秒間隔でチェック

        return event;
    });

})();
