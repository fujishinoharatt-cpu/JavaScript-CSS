(() => {
    'use strict';

    // レコード一覧画面で動作するように設定
    kintone.events.on('app.record.index.show', function (event) {

        // ボタンを作成
        if (document.getElementById('record-delete-button')) return; // 重複防止
        const delete_button = document.createElement('button');
        delete_button.id = 'record-delete-button';
        delete_button.innerText = '手配削除';
        delete_button.style.margin = '10px';
        delete_button.className = 'delete-button';

        // ドロップダウン「氏名」を作成（選択項目は空）
        var name_obj = new Kuc.Dropdown({
            //label: "氏名",
            className: "name_selectbox",
            requiredIcon: false,
            items: [
                {label: "オリジン㈱", value: "オリジン㈱"},
                {label: "冨士ファニチア㈱", value: "冨士ファニチア㈱"}
		    ],
            visible: true,
            disabled: false,
        });

        // ボタンを画面に追加
        kintone.app.getHeaderMenuSpaceElement().appendChild(name_obj);
        kintone.app.getHeaderMenuSpaceElement().appendChild(delete_button);

        // ボタンがクリックされたときの処理
        delete_button.onclick = async function () {

            var appId = kintone.app.getId();
            var query = '出荷日 >="' + Get_Now_Date() + '" and 手配 in ("' + name_obj.value + '")'; //出荷日が今日を含めた未来　かつ　選択した区分を削除
            var recordsToDelete = [];

            // Step 1: レコード取得
            //条件に合うレコードを最大100件取得(offsetでページング処理)
            var getRecords = async (offset = 0) => {
                var resp = await kintone.api(kintone.api.url('/k/v1/records', true), 'GET', {
                    app: appId,
                    query: `${query} limit 100 offset ${offset}`
                });
                //取得したレコードのIDを追加
                recordsToDelete.push(...resp.records.map(r => r.$id.value));

                //100件取得できた場合は再帰的に次のページを取得
                if (resp.records.length === 100) {
                    await getRecords(offset + 100);
                }
            };

            await getRecords();

            //削除前に確認ダイアログを表示
            var confirmed = confirm(`条件に一致するレコードが ${recordsToDelete.length} 件あります。削除してもよろしいですか？`);

            if (!confirmed) {
                alert('削除をキャンセルしました');
                return;
            }

            // Step 2: 一括削除（最大100件ずつ）
            //削除対象IDを100件ずつ取り出して削除する(spliceで配列から削除済みIDを取り除く)
            while (recordsToDelete.length > 0) {
                var chunk = recordsToDelete.splice(0, 100);
                await kintone.api(kintone.api.url('/k/v1/records', true), 'DELETE', {
                    app: appId,
                    ids: chunk
                });
            }

            Timer_Alert("削除処理が完了しました。<br>画面を再読み込みすると反映されます。", 5000, 'linear-gradient(90deg, #cd0060ff, #dc2cffff)');
            //alert('削除完了しました');

        };
    });
})();


