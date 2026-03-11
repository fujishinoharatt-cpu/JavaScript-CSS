(() => {
    'use strict';

    kintone.events.on(['app.record.detail.show', 'app.record.edit.show',], async function (event) {

        var clientRecordId = event.recordId;
        var relatedAppId = kintone.app.getRelatedRecordsTargetAppId('関連レコード一覧');
        var query = '出荷日 = "' + event.record.計算.value + '" limit 500';
        var outputFields = ['才数計'];

        var sum_value = 0;
        var i = 0;

        //対象アプリのレコードを取得
        var tmp_record = await Get_APP_Table(relatedAppId, query, outputFields);

        for(i  = 0; i < tmp_record.length; i++) {

            //値が空でない場合
            if(!Is_All_Empty(tmp_record[i].才数計.value)){

                sum_value = sum_value + Number(tmp_record[i].才数計.value);

            }

        }
        
        //才数計(合計)をスペースへ表示
        var div_sum_display = document.createElement('div');
        var wString = String(sum_value.toFixed(2));
        div_sum_display.style.fontWeight = '900';
        div_sum_display.style.textAlign = 'right';
        div_sum_display.style.fontSize = '1.5rem';
        div_sum_display.innerHTML = `才数計(合計)：${wString}`;
        
        kintone.app.record.getSpaceElement('Sum_Space').appendChild(div_sum_display);

        return event;
    });

})();


