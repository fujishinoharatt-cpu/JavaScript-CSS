/* config_specific.js */
(function() {
    'use strict';

    // グローバル変数に設定オブジェクトを保存
    // ※先ほどの全件更新用とは別の名前(bulkUpdateSpecificConfig)にして、混ざらないようにしています
    window.bulkUpdateSpecificConfig = {
        
        // 【検索条件】kintoneのクエリ形式で記述
        // 例: '手配 in ("冨士ファニチア㈱")' 
        queryCondition: '手配 in ("冨士ファニチア㈱")',

        // 【更新対象】フィールドコード
        updateFieldCode: '運送便コード',

        // 【更新後の値】
        updateValue: '1F',

        // 【ボタンの表示名】
        buttonLabel: '運送便コード一括更新-冨士ファニチア㈱のみ(1F)'
    };

})();