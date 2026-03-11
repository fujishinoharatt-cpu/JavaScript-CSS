(() => {
    'use strict';

    const HIDDEN_FIELD_NAME = ['方面', '納入場所'];
    //***********************************************************************************
    //指定フィールドの表示/非表示
    //引数１：フィールドコート名(配列)　引数２：true / false
    //***********************************************************************************
    function Select_Show_Field(field_array, tmp_bool) {

        var i = 0;

        for(i = 0; i < field_array.length; i++) {

            kintone.app.record.setFieldShown(field_array[i], tmp_bool);

        }

    }

    //***********************************************************
    // 新規作成/編集画面
    //***********************************************************
    kintone.events.on(['app.record.create.show', 'app.record.edit.show'], function(event) {

        //初期設定指定フィールドを隠す
        Select_Show_Field(HIDDEN_FIELD_NAME, false);

    });

    //***********************************************************
    //フィールド「区分」イベント
    //***********************************************************
    kintone.events.on(['app.record.edit.change.区分', 'app.record.create.change.区分', 'app.record.index.edit.change.区分'], function(event) {


        switch(event.record.区分.value) {

            case 'オ':

                Select_Show_Field(HIDDEN_FIELD_NAME, true); //指定フィールドを表示する

            break;

            default:

                Select_Show_Field(HIDDEN_FIELD_NAME, false); //指定フィールドを隠す

            break;

        }

    });

})();


