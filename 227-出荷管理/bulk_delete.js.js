/* bulk_delete.js */
(function() {
    'use strict';

    kintone.events.on('app.record.index.show', function(event) {
        
        var config = window.bulkDeleteConfig;
        if (!config) {
            console.error('設定ファイルが読み込まれていません。');
            return event;
        }

        var TARGET_FIELD = config.targetFieldCode;
        var TARGET_VALUE = config.targetValue; // "オリジン"
        var BUTTON_LABEL = config.buttonLabel;

        if (document.getElementById('my_bulk_delete_button')) {
            return event;
        }

        var myButton = document.createElement('button');
        myButton.id = 'my_bulk_delete_button';
        myButton.innerText = BUTTON_LABEL;
        myButton.classList.add('kintoneplugin-button-normal');

        var lastRecordId = 0;
        var totalDeleted = 0;

        myButton.onclick = function() {
            
            var confirmMsg = '⚠【ドロップダウン用】削除処理を開始します。\n\n' +
                             '対象フィールド: [' + TARGET_FIELD + ']\n' +
                             '削除条件:\n' +
                             '1. 未選択(空)のもの\n' +
                             '2. 「' + TARGET_VALUE + '」という文字を含むもの\n\n' +
                             '実行しますか？';

            if (!confirm(confirmMsg)) return;

            var originalText = myButton.innerText;
            myButton.innerText = '処理中...';
            myButton.disabled = true;

            function processBatch() {
                var query = '$id > ' + lastRecordId + ' order by $id asc limit 100';
                
                var body = {
                    'app': kintone.app.getId(),
                    'query': query,
                    'fields': ['$id', TARGET_FIELD] 
                };

                kintone.api(kintone.api.url('/k/v1/records', true), 'GET', body, function(resp) {
                    var records = resp.records;

                    if (!records || records.length === 0) {
                        alert('完了！合計 ' + totalDeleted + ' 件削除しました。');
                        location.reload();
                        return;
                    }

                    var maxIdInBatch = records[records.length - 1].$id.value;
                    lastRecordId = maxIdInBatch; 

                    // --- 【ドロップダウン対応版】判定ロジック ---
                    var idsToDelete = records.filter(function(record) {
                        var val = record[TARGET_FIELD].value;
                        var recId = record.$id.value;

                        // 1. 値が空（null または 空文字）の場合 → 削除
                        if (val === null || val === undefined || val === "") {
                            return true;
                        }

                        // 2. 値が文字列（ドロップダウン）で、キーワードを含んでいる場合
                        // String(val)とすることで、確実に文字として扱います
                        if (String(val).indexOf(TARGET_VALUE) !== -1) {
                             console.log('削除対象発見 ID:' + recId + ' 値:', val);
                             return true;
                        }

                        // 対象外
                        return false;
                        
                    }).map(function(record) {
                        return record.$id.value;
                    });

                    if (idsToDelete.length === 0) {
                        processBatch();
                        return;
                    }

                    var deleteBody = {
                        'app': kintone.app.getId(),
                        'ids': idsToDelete
                    };

                    kintone.api(kintone.api.url('/k/v1/records', true), 'DELETE', deleteBody, function() {
                        totalDeleted += idsToDelete.length;
                        myButton.innerText = '処理中... (' + totalDeleted + '件 削除済)';
                        processBatch();
                    }, function(error) {
                        console.error(error);
                        alert('削除エラー: ' + error.message);
                        myButton.disabled = false;
                        myButton.innerText = originalText;
                    });

                }, function(error) {
                    alert('データ取得エラー: ' + error.message);
                    myButton.disabled = false;
                    myButton.innerText = originalText;
                });
            }

            processBatch();
        };

        kintone.app.getHeaderMenuSpaceElement().appendChild(myButton);
    });
})();