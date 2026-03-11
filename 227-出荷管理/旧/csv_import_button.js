(() => {
    'use strict';

    const MAX_READ_RECORD_NUMBER = 100; //最大レコード新規登録制限数

    //***********************************************************
	//指定日付が今も含めて未来の場合true
	//引数１：指定日付(文字列)
	//***********************************************************
    function Judge_Date_Future(tmp_date) {

        var output_data = false;

		var target_date = new Date(tmp_date);
        target_date = new Date(target_date.getFullYear(), target_date.getMonth()+1, target_date.getDate());
        var now_date = new Date();
		now_date = new Date(now_date.getFullYear(), now_date.getMonth()+1, now_date.getDate());
		
        if(now_date <= target_date) {

            output_data = true;

        }

        return output_data;

	}

    //***********************************************************
	//encoding
	//引数１：バイナリ配列
	//***********************************************************
	function String_Convert_Encoding(codes) {
		
		var arrayBuffer = new Uint8Array(codes);

		// 文字コードを判別
		var detectedEncoding = Encoding.detect(arrayBuffer);

		// UTF-8からShift_JISに変換
		var convertedData = Encoding.convert(arrayBuffer, {
			to: 'UNICODE', // 変換先の文字コード
			from: detectedEncoding // 元の文字コード
		});

		// 文字列に変換
		var output_data = Encoding.codeToString(convertedData);

		return output_data;

	}

    //***********************************************************
    //ダブルクォテーション対応
    //***********************************************************
    function csvSplit(line) {

        var c = "";
        var s = new String();
        var data = new Array();
        var singleQuoteFlg = false;

        for (var i = 0; i < line.length; i++) {

            c = line.charAt(i);
            if (c == "," && !singleQuoteFlg || i == (line.length - 1)) {
                data.push(s.toString());
                s = "";
            } else if (c == "," && singleQuoteFlg) {
                s = s + c;
            } else if (c == '"') {
                singleQuoteFlg = !singleQuoteFlg;
            } else {
                s = s + c;
            }

        }

        return data;

    }

    //***********************************************************
    //新規レコードを登録する
    //***********************************************************
    function Kintone_Record_Entry(records) {

        kintone.api(kintone.api.url('/k/v1/records', true), 'POST', {
            app: kintone.app.getId(),
            records: records
        }).then(function() {
            //alert('CSVデータをインポートしました！');
            //location.reload();
        }).catch(function(error) {
            console.error(error);
            //alert('インポート中にエラーが発生しました。');
        });

    }

    //***********************************************************
    //CSVインポート処理
    //引数１：CSV配列データ
    //***********************************************************
    async function processCSVData(csvData) {

        var rows = csvData.split('\r\n');
        var csv_record_number = rows.length; //CSVレコード数(ヘッダ含)

        //var headers = rows[0].split(',');
        var headers = csvSplit(rows[0]); //ヘッダ部を取得

        // データをkintone形式に変換
        var records = [];

        //レコード数分処理
        for (var i = 1; i < csv_record_number; i++) {

            if (!rows[i].trim()) continue; // 空行をスキップ

            //最大制限数に達したら初期化
            if(i % MAX_READ_RECORD_NUMBER == 1) {

                records = []; //初期化

            }

            //var values = rows[i].split(',');
            var values = csvSplit(rows[i]); //探索中の行を「,」で分割

            var record = {}; //セットするレコードを初期化
            var entry_flg = true; //登録するレコードフラグを初期化

            //-------------------------------
            //[出荷日判定]
            //出荷日が今を除く過去の場合false
            //-------------------------------
            headers.forEach(function(header, index) {

                //出荷日　かつ　今の除いた過去の日付の場合
                if(header == '出荷日' && !Judge_Date_Future(values[index])) {

                    entry_flg = false;
                    return;

                }

            });

            //出荷日が今を含む未来の場合はレコードを対象に値をセットする
            if(entry_flg == true) {

                headers.forEach(function(header, index) {

                    var set_value = values[index]; //対象の値をセット

                    //レコードのフィールド値を設定
                    record[header] = {
                        value: set_value
                    };

                });

                records.push(record);

            }
            

            //レコード登録(最大制限数に達した)
            if(i % MAX_READ_RECORD_NUMBER == 0) {

                await Kintone_Record_Entry(records);

            }

        }

        //残りのレコードを登録
        await Kintone_Record_Entry(records);
        
    }

    //***********************************************************
    //CSV処理
    //***********************************************************
    function handleCSVImport() {
        var input = document.createElement('input');
            input.type = 'file';
            input.accept = '.csv';
            input.onchange = function(event) {
                var file = event.target.files[0];
                var reader = new FileReader();

                reader.onload = function(e) {

                    //var csvData = e.target.result;

                    var csvData = String_Convert_Encoding(e.target.result); //エンコーディング

                    //var encoder = new TextEncoder();

                    //csvData = encoder.encode(csvData); //utf-8へ変換

                    try {

                        // CSVデータを解析してkintoneに登録する処理を追加
                        processCSVData(csvData);
                        //alert('CSVデータをインポートしました！\r\n画面を再読み込みすると反映されます。');
                        Timer_Alert("CSVデータをインポートしました！<br>画面を再読み込みすると反映されます。", 5000, 'linear-gradient(90deg, #0000cd, #2c7cff)');
                        //location.reload();

                    } catch(e) {

                        alert('エラーが発生しました');
                        console.log(e.message);

                    }

                };

                //reader.readAsText(file); //テキスト
                reader.readAsArrayBuffer(file);

            };

            input.click();
    }

    //***********************************************************
    // レコード一覧画面
    //***********************************************************
    kintone.events.on('app.record.index.show', function(event) {

        // 既にボタンがある場合は追加しない
        if (document.getElementById('csv-import-button')) {
            return;
        }

        // ボタンを作成
        var myButton = document.createElement('button');
        myButton.id = 'csv-import-button';
        myButton.innerText = 'CSVインポート';
        myButton.style.margin = '10px';
        myButton.className = 'import-button';

        // ボタンを画面に追加
        var headerSpace = kintone.app.getHeaderMenuSpaceElement();
        headerSpace.appendChild(myButton);

        // ボタンのクリックイベントを設定
        myButton.onclick = function() {

            // CSV処理の関数を呼び出す
            handleCSVImport();

        };
    });

})();


