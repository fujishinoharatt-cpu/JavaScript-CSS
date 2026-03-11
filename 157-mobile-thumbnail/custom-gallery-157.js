(function () {
    'use strict';

    var events = [
        'app.record.index.show',
        'mobile.app.record.index.show'
    ];

    kintone.events.on(events, function (event) {
        var container = document.getElementById('custom-gallery-container');
        if (!container) return event;

        container.innerHTML = '';
        container.style.padding = '15px';
        container.style.backgroundColor = '#fff';
        container.style.fontFamily = 'sans-serif';

        // --- 現在の検索条件（URLのquery）から選択状態を取得して復元 ---
        var condition = kintone.app.getQueryCondition() || '';
        var initialDept = '';
        var initialIncident = '';

        // Kintoneの「query=」の文字列から、どの課やインシデントが選ばれているかを抽出する
        var mDept = condition.match(/課名\s*=\s*"([^"]+)"/);
        if (mDept) initialDept = mDept[1];

        var mIncident = condition.match(/インシデント名\s*(?:=|in)\s*(?:\(?\s*"([^"]+)"\s*\)?)/);
        if (mIncident) initialIncident = mIncident[1];

        // --- ドロップダウンUI（マスタ全件表示対応版）を作成 ---
        var filterArea = document.createElement('div');
        filterArea.style.display = 'flex';
        filterArea.style.flexWrap = 'wrap';
        filterArea.style.gap = '10px';
        filterArea.style.marginBottom = '20px';
        filterArea.style.padding = '15px';
        filterArea.style.backgroundColor = '#f4f5f9';
        filterArea.style.borderRadius = '8px';
        filterArea.style.border = '1px solid #d3d5d9';
        filterArea.style.alignItems = 'center';

        var selDept = document.createElement('select');
        var selIncident = document.createElement('select');
        var searchBtn = document.createElement('button');

        function setupSelectStyle(sel, defaultLabel) {
            sel.style.padding = '8px 12px';
            sel.style.borderRadius = '4px';
            sel.style.border = '1px solid #ccc';
            sel.style.fontSize = '14px';
            sel.style.maxWidth = '100%';
            sel.innerHTML = '<option value="">' + defaultLabel + '</option>';
            return sel;
        }

        setupSelectStyle(selDept, 'すべての課 (読込中...)');
        setupSelectStyle(selIncident, 'すべてのインシデント (読込中...)');

        // 検索ボタン
        searchBtn.innerText = '検索して絞り込む';
        searchBtn.style.padding = '8px 24px';
        searchBtn.style.backgroundColor = '#3498db';
        searchBtn.style.color = '#fff';
        searchBtn.style.border = 'none';
        searchBtn.style.borderRadius = '4px';
        searchBtn.style.cursor = 'pointer';
        searchBtn.style.fontWeight = 'bold';
        searchBtn.style.fontSize = '14px';
        searchBtn.onclick = function () {
            var q = [];
            if (selDept.value) q.push('課名 = "' + selDept.value + '"');
            if (selIncident.value) q.push('インシデント名 in ("' + selIncident.value + '")');

            var url = window.location.pathname + '?view=' + event.viewId;
            if (q.length > 0) {
                url += '&query=' + encodeURIComponent(q.join(' and '));
            }
            window.location.href = url; // 画面遷移して検索発動

            searchBtn.innerText = '検索中...';
            searchBtn.disabled = true;
            searchBtn.style.backgroundColor = '#999';
        };

        filterArea.appendChild(selDept);
        filterArea.appendChild(selIncident);
        filterArea.appendChild(searchBtn);
        container.appendChild(filterArea);

        // --- APIからマスタ全件を取得してドロップダウンに入れる ---

        // 1. 課マスタは「アプリID:92」から取得 (以前教えていただいたトークンを使用)
        var xhrApp92 = new XMLHttpRequest();
        xhrApp92.open('GET', '/k/v1/records.json?app=92&query=' + encodeURIComponent('利用区分 in ("利用する") order by 順 asc'), true);
        xhrApp92.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
        xhrApp92.setRequestHeader('X-Cybozu-API-Token', 'grt3LJb0VeSMDIUmvoraZVswynPHx1q67uBmnZoR');
        xhrApp92.onload = function () {
            selDept.innerHTML = '<option value="">すべての課</option>';
            if (xhrApp92.status === 200) {
                var res = JSON.parse(xhrApp92.responseText);
                var optionsCount = 0;
                res.records.forEach(function (r) {
                    var o = r['課名'].value;
                    var opt = document.createElement('option');
                    opt.value = o; opt.innerText = o;
                    selDept.appendChild(opt);
                    optionsCount++;
                });
                if (optionsCount === 1) selDept.value = res.records[0]['課名'].value;
            } else {
                selDept.innerHTML = '<option value="">(読込失敗)</option>';
            }
            if (initialDept) selDept.value = initialDept;
        };
        xhrApp92.send();

        // 2. インシデントマスタは「アプリID:158」からkintone.apiを利用して全件取得
        kintone.api(kintone.api.url('/k/v1/records', true), 'GET', { app: 158, query: 'order by インシデントコード asc' }).then(function (resp) {
            selIncident.innerHTML = '<option value="">すべてのインシデント</option>';
            var optionsCount = resp.records.length;
            resp.records.forEach(function (r) {
                var val = r['インシデント名'] ? r['インシデント名'].value : '';
                if (val) {
                    var opt = document.createElement('option');
                    opt.value = val;
                    opt.innerText = val;
                    selIncident.appendChild(opt);
                }
            });
            if (optionsCount === 1 && resp.records[0]['インシデント名']) {
                selIncident.value = resp.records[0]['インシデント名'].value;
            }
            if (initialIncident) selIncident.value = initialIncident;
        }).catch(function (err) {
            console.error('インシデントマスタの取得に失敗しました', err);
            selIncident.innerHTML = '<option value="">(インシデント読込失敗)</option>';
        });


        // --- 画像描画エリアの準備とデータの描画 ---
        var galleryArea = document.createElement('div');
        container.appendChild(galleryArea);

        var records = event.records;
        if (!records || records.length === 0) {
            galleryArea.innerHTML = '<div style="padding: 20px; color:#666; font-size:16px;">この検索条件に一致する画像データはありません。<br>上のプルダウンを変更して「検索して絞り込む」を押してください。</div>';
            return event;
        }

        // --- データを「課名 ＞ インシデント名」の2階層でグループ化 ---
        var grouped = {};
        records.forEach(function (record) {
            var kName = record['課名'] ? record['課名'].value : '（課未入力）';
            var incident = record['インシデント名'] ? record['インシデント名'].value : '（現象未入力）';
            var images = record['不安全画像'] ? record['不安全画像'].value : [];
            var recId = record['$id'] ? record['$id'].value : '';

            if (images.length === 0) return;

            if (!grouped[kName]) grouped[kName] = {};
            if (!grouped[kName][incident]) grouped[kName][incident] = [];

            images.forEach(function (img) {
                // 画像データに元のレコードIDを持たせる
                img.recordId = recId;
                grouped[kName][incident].push(img);
            });
        });

        // 遅延読み込みとポップアップ制御のObserver
        var lazyImageObserver = new IntersectionObserver(function (entries, observer) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    var containerEl = entry.target;
                    var fileKey = containerEl.dataset.fileKey;
                    var recId = containerEl.dataset.recordId;

                    if (fileKey) {
                        containerEl.dataset.fileKey = '';
                        containerEl.innerHTML = '<div style="font-size:10px; color:#999; margin-top:35px; text-align:center;">読込中...</div>';

                        var apiUri = kintone.api.url('/k/v1/file.json', true) + '?fileKey=' + fileKey;
                        var xhr = new XMLHttpRequest();
                        xhr.open('GET', apiUri, true);
                        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
                        xhr.responseType = 'blob';

                        xhr.onload = function () {
                            if (xhr.status === 200) {
                                var blobUrl = window.URL.createObjectURL(xhr.response);
                                var tempImg = new Image();
                                tempImg.onload = function () {
                                    var canvas = document.createElement('canvas');
                                    var ctx = canvas.getContext('2d');
                                    var ratio = Math.min(200 / tempImg.width, 200 / tempImg.height);
                                    canvas.width = tempImg.width * ratio;
                                    canvas.height = tempImg.height * ratio;
                                    ctx.drawImage(tempImg, 0, 0, canvas.width, canvas.height);
                                    var thumbDataUrl = canvas.toDataURL('image/jpeg', 0.8);

                                    var finalImg = document.createElement('img');
                                    finalImg.style.width = '100px';
                                    finalImg.style.height = '100px';
                                    finalImg.style.objectFit = 'cover';
                                    finalImg.style.borderRadius = '8px';
                                    finalImg.src = thumbDataUrl;

                                    containerEl.innerHTML = '';
                                    containerEl.appendChild(finalImg);

                                    containerEl.onclick = function () {
                                        var overlay = document.createElement('div');
                                        overlay.style.position = 'fixed';
                                        overlay.style.top = '0';
                                        overlay.style.left = '0';
                                        overlay.style.width = '100vw';
                                        overlay.style.height = '100vh';
                                        overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
                                        overlay.style.zIndex = '999999';
                                        overlay.style.display = 'flex';
                                        overlay.style.flexDirection = 'column';
                                        overlay.style.justifyContent = 'center';
                                        overlay.style.alignItems = 'center';

                                        var largeImg = document.createElement('img');
                                        largeImg.src = blobUrl;
                                        largeImg.style.maxWidth = '95%';
                                        largeImg.style.maxHeight = '75%';
                                        largeImg.style.objectFit = 'contain';
                                        largeImg.style.borderRadius = '8px';
                                        largeImg.style.boxShadow = '0 10px 25px rgba(0,0,0,0.5)';

                                        // ボタンを横並びにするエリア
                                        var btnArea = document.createElement('div');
                                        btnArea.style.display = 'flex';
                                        btnArea.style.gap = '20px';
                                        btnArea.style.marginTop = '20px';

                                        // レコードへ飛ぶボタン
                                        var linkBtn = document.createElement('div');
                                        linkBtn.innerText = '📝 レコードを開く';
                                        linkBtn.style.color = '#fff';
                                        linkBtn.style.fontSize = '16px';
                                        linkBtn.style.fontWeight = 'bold';
                                        linkBtn.style.padding = '12px 24px';
                                        linkBtn.style.backgroundColor = '#3498db';
                                        linkBtn.style.borderRadius = '30px';
                                        linkBtn.style.border = '2px solid #2980b9';
                                        linkBtn.style.cursor = 'pointer';
                                        linkBtn.onclick = function (e) {
                                            e.stopPropagation(); // 黒背景の「閉じる」処理が暴発しないように止める

                                            // スマホ版かPC版かを判定
                                            var isMobile = (window.location.pathname.indexOf('/m/') !== -1);

                                            // アプリIDを取得 (不安全発見アプリ 157)
                                            var currentAppId = kintone.app.getId();
                                            if (!currentAppId && kintone.mobile && kintone.mobile.app) {
                                                currentAppId = kintone.mobile.app.getId();
                                            }

                                            var recordUrl = '';
                                            if (isMobile) {
                                                // スマホ用レコード詳細URL
                                                recordUrl = '/k/m/' + currentAppId + '/show?record=' + recId;
                                            } else {
                                                // PC用のレコード詳細URL
                                                recordUrl = '/k/' + currentAppId + '/show#record=' + recId;
                                            }

                                            window.location.href = recordUrl;
                                        };

                                        // 閉じるボタン
                                        var closeBtn = document.createElement('div');
                                        closeBtn.innerText = '× 閉じる';
                                        closeBtn.style.color = '#fff';
                                        closeBtn.style.fontSize = '16px';
                                        closeBtn.style.fontWeight = 'bold';
                                        closeBtn.style.padding = '12px 24px';
                                        closeBtn.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                                        closeBtn.style.borderRadius = '30px';
                                        closeBtn.style.border = '1px solid rgba(255,255,255,0.4)';
                                        closeBtn.style.cursor = 'pointer';

                                        btnArea.appendChild(linkBtn);
                                        btnArea.appendChild(closeBtn);

                                        overlay.appendChild(largeImg);
                                        overlay.appendChild(btnArea);

                                        overlay.onclick = function () {
                                            if (document.body.contains(overlay)) {
                                                document.body.removeChild(overlay);
                                            }
                                        };

                                        document.body.appendChild(overlay);
                                    };
                                };
                                tempImg.src = blobUrl;
                            } else {
                                containerEl.innerHTML = '<div style="font-size:10px; color:red; margin-top:35px; text-align:center;">エラー</div>';
                            }
                        };
                        xhr.send();
                        observer.unobserve(containerEl);
                    }
                }
            });
        }, { rootMargin: '100px 0px' });

        // --- 2階層のループで画面に描画 ---
        for (var kName in grouped) {
            // [課名] 見出し
            var deptContainer = document.createElement('div');
            deptContainer.style.marginBottom = '30px';

            var kNameEl = document.createElement('div');
            kNameEl.style.fontSize = '22px';
            kNameEl.style.fontWeight = 'bold';
            kNameEl.style.color = '#111';
            kNameEl.style.borderBottom = '3px solid #333';
            kNameEl.style.paddingBottom = '5px';
            kNameEl.innerText = '[' + kName + ']';
            deptContainer.appendChild(kNameEl);

            for (var incident in grouped[kName]) {
                var incidentContainer = document.createElement('div');
                incidentContainer.style.marginLeft = '10px';

                // [インシデント名] 見出し
                var incidentEl = document.createElement('div');
                incidentEl.style.fontSize = '18px';
                incidentEl.style.fontWeight = 'bold';
                incidentEl.style.color = '#444';
                incidentEl.style.marginTop = '20px';
                incidentEl.style.marginBottom = '12px';
                incidentEl.style.borderLeft = '5px solid #666';
                incidentEl.style.paddingLeft = '10px';
                incidentEl.innerText = '[' + incident + ']';
                incidentContainer.appendChild(incidentEl);

                var itemsArray = grouped[kName][incident];

                // 画像を敷き詰めるエリア
                var imgArea = document.createElement('div');
                imgArea.style.display = 'flex';
                imgArea.style.flexWrap = 'wrap';
                imgArea.style.gap = '8px';
                imgArea.style.marginLeft = '10px';
                imgArea.style.marginBottom = '15px';

                itemsArray.forEach(function (imgInfo) {
                    var imgBox = document.createElement('div');
                    imgBox.style.width = '100px';
                    imgBox.style.height = '100px';
                    imgBox.style.borderRadius = '8px';
                    imgBox.style.border = '1px solid #ddd';
                    imgBox.style.backgroundColor = '#f4f4f4';
                    imgBox.style.cursor = 'pointer';
                    imgBox.style.overflow = 'hidden';

                    imgBox.dataset.fileKey = imgInfo.fileKey;
                    imgBox.dataset.recordId = imgInfo.recordId;

                    // スクロール時に自動で画像を引っ張ってくる監視対象に登録
                    lazyImageObserver.observe(imgBox);

                    imgArea.appendChild(imgBox);
                });

                incidentContainer.appendChild(imgArea);
                deptContainer.appendChild(incidentContainer);
            }
            galleryArea.appendChild(deptContainer);
        }

        return event;
    });

})();
