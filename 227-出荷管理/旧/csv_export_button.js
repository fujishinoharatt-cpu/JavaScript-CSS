(() => {
    'use strict';

    // レコード一覧画面で動作するように設定
    kintone.events.on('app.record.index.show', function (event) {
        // ボタンを作成
        if (document.getElementById('export-csv-button')) return; // 重複防止
        const exportButton = document.createElement('button');
        exportButton.id = 'export-csv-button';
        exportButton.innerText = 'CSVエクスポート';
        exportButton.style.margin = '10px';
        exportButton.className = 'export-button';

        // ボタンを画面に追加
        kintone.app.getHeaderMenuSpaceElement().appendChild(exportButton);

        // ボタンがクリックされたときの処理
        exportButton.onclick = async function () {
            const query = kintone.app.getQuery(); // クエリを取得
            const records = await kintone.api(kintone.api.url('/k/v1/records', true), 'GET', {
                app: kintone.app.getId(),
                query: query,
            });

            if (records.records.length === 0) {
                alert('エクスポートするレコードがありません。');
                return;
            }

            // CSVデータを生成
            const csvRows = [];
            const headers = Object.keys(records.records[0]).map(key => `"${key}"`);
            csvRows.push(headers.join(','));

            records.records.forEach(record => {
                const row = Object.values(record).map(value => `"${value.value}"`);
                csvRows.push(row.join(','));
            });

            var csvContent = csvRows.join('\r\n');

            //sjis
            var csv_array = Encoding.convert(Encoding.stringToCode(csvContent),
                {
                    to: 'SJIS',
                    from: 'UNICODE'
                }
            );
            csvContent = new Uint8Array(csv_array);
            const blob = new Blob([csvContent], { type: 'text/csv;charset=shift-jis;' });
            
            //utf8
            //const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);

            // ダウンロードリンクを作成してクリック
            const link = document.createElement('a');
            link.href = url;
            link.download = 'kintone_records.csv';
            link.click();
            URL.revokeObjectURL(url);
        };
    });
})();


