/* bulk_update_specific.js */
(function () {
    'use strict';

    kintone.events.on('app.record.index.show', function (event) {

        // 設定ファイルの読み込み
        var config = window.bulkUpdateSpecificConfig;

        if (!config) {
            console.error('config_specific.js が読み込まれていないか、設定変数が間違っています。');
            return event;
        }

        var QUERY_CONDITION = config.queryCondition;
        var UPDATE_FIELD_CODE = config.updateFieldCode;
        var UPDATE_VALUE = config.updateValue;
        var BUTTON_LABEL = config.buttonLabel;
        var EXCLUDE_OPERATOR = config.excludeOperator || '!='; // デフォルトは '!='

        // ボタン増殖防止
        if (document.getElementById('my_specific_update_button')) {
            return event;
        }

        var myButton = document.createElement('button');
        myButton.id = 'my_specific_update_button';
        myButton.innerText = BUTTON_LABEL;
        myButton.classList.add('kintoneplugin-button-normal');

        myButton.onclick = function () {

            // 【重要】「条件に合う」かつ「まだ値が変わっていない」ものを探すクエリ
            // これにより、更新が終わったものは次回の検索に引っかからなくなるため、無限ループを防ぎます
            var excludePart = '';
            if (EXCLUDE_OPERATOR === 'not in') {
                excludePart = EXCLUDE_OPERATOR + ' ("' + UPDATE_VALUE + '")';
            } else {
                excludePart = EXCLUDE_OPERATOR + ' "' + UPDATE_VALUE + '"';
            }

            var finalQuery = '(' + QUERY_CONDITION + ') and ' + UPDATE_FIELD_CODE + ' ' + excludePart;

            var confirmMsg = '以下の条件でデータを【全件】更新します。\n\n' +
                '【対象条件】 ' + QUERY_CONDITION + '\n' +
                '【除外条件】 既に値が「' + UPDATE_VALUE + '」のものはスキップします\n' +
                '【更新内容】 ' + UPDATE_FIELD_CODE + ' → ' + UPDATE_VALUE + '\n\n' +
                '対象が100件以上ある場合も、自動で最後まで処理を繰り返します。\n実行しますか？';

            if (!confirm(confirmMsg)) {
                return;
            }

            var originalText = myButton.innerText;
            myButton.innerText = '更新中...そのままお待ちください';
            myButton.disabled = true;

            // --- 再帰処理関数（全件対応用） ---
            function processBatch(counter) {
                var body = {
                    'app': kintone.app.getId(),
                    'query': finalQuery + ' limit 100', // 100件ずつ取得
                    'fields': ['$id']
                };

                kintone.api(kintone.api.url('/k/v1/records', true), 'GET', body, function (resp) {
                    var records = resp.records;

                    // 更新対象がなくなったら終了（完了）
                    if (!records || records.length === 0) {
                        if (counter === 0) {
                            alert('更新が必要なデータは見つかりませんでした。\n（すべて更新済み、または対象外です）');
                        } else {
                            alert('すべての更新が完了しました！\n合計 ' + counter + ' 件更新しました。');
                            location.reload();
                        }
                        myButton.innerText = originalText;
                        myButton.disabled = false;
                        return;
                    }

                    // 更新用データ作成
                    var recordsToUpdate = records.map(function (record) {
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

                    // 更新実行
                    kintone.api(kintone.api.url('/k/v1/records', true), 'PUT', putBody, function (resp) {
                        // 成功したら、カウントを足して自分自身を再呼び出し（次の100件へ）
                        processBatch(counter + recordsToUpdate.length);
                    }, function (error) {
                        console.error(error);
                        alert('更新中にエラーが発生しました。\n' + error.message);
                        myButton.innerText = originalText;
                        myButton.disabled = false;
                    });

                }, function (error) {
                    console.error(error);
                    alert('データ取得に失敗しました。\n' + error.message);
                    myButton.innerText = originalText;
                    myButton.disabled = false;
                });
            }

            // 処理スタート
            processBatch(0);
        };

        kintone.app.getHeaderMenuSpaceElement().appendChild(myButton);
    });
})();