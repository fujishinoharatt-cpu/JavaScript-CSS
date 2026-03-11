(() => {
    'use strict';

    kintone.events.on(['app.record.index.show'], function (event) {

        //「すべて」一覧を非表示にする
        var interval = setInterval(function () {

            if ($('.gaia-argoui-menuitem:contains("すべて")').length > 0) {

                clearInterval(interval);
                $('.gaia-argoui-menuitem:contains("すべて")').parent().remove();

            }

        }, 100);

        return event;

    });
})();
