/* config.js */
(function() {
    'use strict';

    // グローバル変数に設定オブジェクトを保存
    // ※他のプラグインと名前が被らないようにユニークな名前にしています
    window.bulkUpdateConfig = {
        // 更新対象のフィールドコード
        targetFieldCode: '運送便コード',

        // 更新後の値
        updateValue: '1S',

        // ボタンに表示するテキスト
        buttonLabel: '全件一括更新（運送便コード→1S）',

        // 確認メッセージの一部に使われるテキスト
        confirmMessage: '運送便コードを「1S」に書き換えます'
    };

})();