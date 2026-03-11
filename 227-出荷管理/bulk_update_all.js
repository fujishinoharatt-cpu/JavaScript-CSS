/* bulk_update_all.js */
(function() {
    'use strict';

    kintone.events.on('app.record.index.show', function(event) {
        
        // 設定値の読み込み
        var config = window.bulkUpdateConfig;

        // 設定ファイルが正しく読み込まれていない場合のガード処理
        if (!config) {
            console.error('config.js が読み込まれていないか、設定が間違っています。');
            return event;
        }

        var UPDATE_FIELD_CODE = config.targetFieldCode;
        var UPDATE_VALUE      = config.updateValue;
        var BUTTON_LABEL      = config.buttonLabel;
        var CONFIRM_MSG       = config.confirmMessage;

        // ボタン増殖防止
        if (document.getElementById('my_bulk_update_button')) {
            return event;
        }

        var myButton = document.createElement('button');
        myButton.id = 'my_bulk_update_button';
        myButton.innerText = BUTTON_LABEL; // 設定ファイルの文言を使用
        myButton.classList.add('kintoneplugin-button-normal');

        myButton.onclick = function() {
            
            // 条件：設定されたフィールドが、設定された値「ではない」もの全て
            // ※無駄な更新を防ぐための絞り込み
            var QUERY_CONDITION = UPDATE_FIELD_CODE + ' != "' + UPDATE_VALUE + '"';

            // 確認メッセージ
            var msg = '【注意】\n' + CONFIRM_MSG + '。\n（' + UPDATE_FIELD_CODE + ' → ' + UPDATE_VALUE + '）\n\n実行しますか？';
            
            if (!confirm(msg)) {
                return;
            }

            // ローディング表示
            var originalText = myButton.innerText;
            myButton.innerText = '更新中...そのままお待ちください';
            myButton.disabled = true;

            // 再帰的な更新処理
            function processBatch(counter) {
                var body = {
                    'app': kintone.app.getId(),
                    'query': QUERY_CONDITION + ' limit 100',
                    'fields': ['$id']
                };

                kintone.api(kintone.api.url('/k/v1/records', true), 'GET', body, function(resp) {
                    var records = resp.records;

                    if (!records || records.length === 0) {
                        alert('すべての更新が完了しました！\n合計 ' + counter + ' 件更新しました。');
                        location.reload();
                        return;
                    }

                    var recordsToUpdate = records.map(function(record) {
                        var obj = {};
                        obj[UPDATE_FIELD_CODE] = { 'value': UPDATE_VALUE };
                        return {
                            'id': record.$id.value,
                            'record': obj
                        };
                    });

                    var putBody = {
                        'app': kintone.app.getId(),
                        'records': recordsToUpdate
                    };

                    kintone.api(kintone.api.url('/k/v1/records', true), 'PUT', putBody, function(resp) {
                        processBatch(counter + recordsToUpdate.length);
                    }, function(error) {
                        console.error(error);
                        alert('更新中にエラーが発生しました。\n' + error.message);
                        myButton.innerText = originalText;
                        myButton.disabled = false;
                    });

                }, function(error) {
                    console.error(error);
                    alert('データ取得中にエラーが発生しました。');
                    myButton.innerText = originalText;
                    myButton.disabled = false;
                });
            }

            processBatch(0);
        };

        kintone.app.getHeaderMenuSpaceElement().appendChild(myButton);
    });
})();