// Ver.1.1.4 - 008-ダッシュボード (Project Renamed)
(function() {
    'use strict';

    // ==========================================
    // 設定値
    // ==========================================
    const CREATOR_FIELD = '作成者';
    const CREATED_FIELD = '作成日時';
    const REASON_FIELD = '来店'; // 来館のキッカケ(DROP_DOWN)

    let allFetchedRecords = []; // 初回に全件取得したデータを保持する変数

    kintone.events.on('app.record.index.show', function(event) {
        if (document.getElementById('show-dashboard-008-btn')) return event;

        var menuSpace = null;
        try {
            if (typeof kintone !== 'undefined' && kintone.app && typeof kintone.app.getHeaderMenuSpace === 'function') {
                menuSpace = kintone.app.getHeaderMenuSpace();
            }
            if (!menuSpace) menuSpace = document.querySelector('.kintone-app-headermenu-space');
        } catch (e) { console.warn(e); }

        if (!menuSpace) return event;
        
        const btn = document.createElement('button');
        btn.id = 'show-dashboard-008-btn';
        btn.innerHTML = '📊 作成者ダッシュボード';
        btn.style.margin = '10px'; btn.style.padding = '8px 16px';
        btn.style.backgroundColor = '#8e2de2'; btn.style.color = 'white';
        btn.style.border = 'none'; btn.style.borderRadius = '4px';
        btn.style.cursor = 'pointer'; btn.style.fontWeight = 'bold';
        btn.style.transition = 'opacity 0.2s';
        btn.onmouseover = () => btn.style.opacity = '0.8';
        btn.onmouseout = () => btn.style.opacity = '1';

        const overlay = document.createElement('div');
        overlay.id = 'dashboard-overlay-008';
        
        const modal = document.createElement('div');
        modal.id = 'dashboard-modal-008';
        
        modal.innerHTML = `
            <div class="dashboard-008-header">
                <div class="dashboard-008-title">📊 登録推移ダッシュボード (作成者・来店キッカケ)</div>
                <button class="dashboard-008-close" id="close-dashboard-008">&times;</button>
            </div>
            
            <div id="dashboard-008-content">
                <div class="dashboard-008-loading">
                    <div class="dashboard-008-spinner"></div>
                    <div>全件データを集計中...</div>
                </div>
            </div>
            <div style="text-align:right; margin-top:15px; font-size:10px; opacity:0.4;">Ver.1.1.4</div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const loadChartJs = () => {
            return new Promise((resolve, reject) => {
                if (typeof Chart !== 'undefined') { resolve(); return; }
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
                script.onload = resolve;
                script.onerror = () => reject(new Error('Chart.jsの読み込みに失敗しました'));
                document.head.appendChild(script);
            });
        };

        btn.onclick = async function() {
            overlay.style.display = 'flex';
            
            // 初回表示時のみデータ取得
            if (!window.kintoneDashboard008DataLoaded) {
                try {
                    await loadChartJs();
                    
                    document.getElementById('dashboard-008-content').innerHTML = `
                        <div class="dashboard-008-loading">
                            <div class="dashboard-008-spinner"></div>
                            <div>全件データを集計中...</div>
                        </div>
                    `;

                    allFetchedRecords = await fetchAllRecords();
                    renderDashboardBase();
                    updateDashboardData('ALL'); // 初回は全件で描画
                    window.kintoneDashboard008DataLoaded = true;
                } catch (error) {
                    console.error('Data fetch error:', error);
                    document.getElementById('dashboard-008-content').innerHTML = `
                        <div style="color: #ff4444; text-align: center; padding: 50px;">
                            データの取得に失敗しました。<br>${error.message}
                        </div>
                    `;
                }
            }
        };

        document.getElementById('close-dashboard-008').onclick = function() { overlay.style.display = 'none'; };
        overlay.onclick = function(e) { if(e.target === overlay) overlay.style.display = 'none'; };

        menuSpace.appendChild(btn);
        return event;
    });

    async function fetchAllRecords() {
        const appId = kintone.app.getId();
        const query = 'order by 作成日時 asc';
        const fields = [CREATOR_FIELD, CREATED_FIELD, REASON_FIELD];

        const cursorRes = await kintone.api(kintone.api.url('/k/v1/records/cursor', true), 'POST', {
            app: appId, fields: fields, query: query, size: 500
        });

        const cursorId = cursorRes.id;
        let allRecords = [];
        let hasMore = true;

        while (hasMore) {
            const fetchRes = await kintone.api(kintone.api.url('/k/v1/records/cursor', true), 'GET', { id: cursorId });
            allRecords = allRecords.concat(fetchRes.records);
            hasMore = fetchRes.next;
        }
        return allRecords;
    }

    /**
     * ベースとなるHTML（フィルターバーやコンテンツ領域）を生成する
     */
    function renderDashboardBase() {
        // 作成者の一覧を抽出
        let creatorSet = new Set();
        allFetchedRecords.forEach(r => {
            if (r[CREATOR_FIELD] && r[CREATOR_FIELD].value) {
                creatorSet.add(r[CREATOR_FIELD].value.name);
            }
        });
        let sortedCreators = Array.from(creatorSet).sort();
        
        let filterOptions = `<option value="ALL">すべて (全件表示)</option>`;
        sortedCreators.forEach(c => {
            filterOptions += `<option value="${c}">${c}</option>`;
        });

        const baseHTML = `
            <div class="dashboard-008-filter-bar">
                <div class="dashboard-008-filter-label">🔍 絞り込み:</div>
                <select id="dashboard-008-creator-filter">
                    ${filterOptions}
                </select>
            </div>
            <div id="dashboard-008-dynamic-content"></div>
        `;

        document.getElementById('dashboard-008-content').innerHTML = baseHTML;

        // ドロップダウン変更時のイベントリスナー
        document.getElementById('dashboard-008-creator-filter').addEventListener('change', function(e) {
            updateDashboardData(e.target.value);
        });
    }

    /**
     * 選択された作成者に基づいてデータをフィルタリングし、UIとグラフを再描画する
     */
    function updateDashboardData(selectedCreator) {
        // --- フィルタリング処理 ---
        let targetRecords = allFetchedRecords;
        if (selectedCreator !== 'ALL') {
            targetRecords = allFetchedRecords.filter(r => r[CREATOR_FIELD] && r[CREATOR_FIELD].value.name === selectedCreator);
        }

        if (targetRecords.length === 0) {
            document.getElementById('dashboard-008-dynamic-content').innerHTML = '<div style="text-align:center; padding:50px;">該当するレコードがありません。</div>';
            return;
        }

        // --- データ集計処理 ---
        let monthlyCreatorData = {};
        let monthlyReasonData = {};
        let creatorTotal = {};
        let reasonTotal = {};
        let monthSet = new Set();
        
        let currentMonthStr = new Date().getFullYear() + '-' + String(new Date().getMonth() + 1).padStart(2, '0');
        let currentMonthCount = 0;
        let currentMonthCreators = {};

        // 直近3ヶ月の月文字列を計算
        let last3MonthsStr = [];
        let today = new Date();
        for (let i = 0; i < 3; i++) {
            let d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            last3MonthsStr.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
        }

        targetRecords.forEach(r => {
            if (!r[CREATED_FIELD] || !r[CREATED_FIELD].value) return;

            let dateStr = r[CREATED_FIELD].value;
            let dateObj = new Date(dateStr);
            let month = dateObj.getFullYear() + '-' + String(dateObj.getMonth() + 1).padStart(2, '0');
            
            let creator = (r[CREATOR_FIELD] && r[CREATOR_FIELD].value) ? r[CREATOR_FIELD].value.name : '不明';
            let reason = (r[REASON_FIELD] && r[REASON_FIELD].value) ? r[REASON_FIELD].value : '未選択';

            monthSet.add(month);
            
            // 作成者推移（グラフ用）
            if (!monthlyCreatorData[month]) monthlyCreatorData[month] = {};
            if (!monthlyCreatorData[month][creator]) monthlyCreatorData[month][creator] = 0;
            monthlyCreatorData[month][creator]++;

            // 来店キッカケ推移（グラフ用）
            if (!monthlyReasonData[month]) monthlyReasonData[month] = {};
            if (!monthlyReasonData[month][reason]) monthlyReasonData[month][reason] = 0;
            monthlyReasonData[month][reason]++;

            // 直近3ヶ月のランキング集計
            if (last3MonthsStr.includes(month)) {
                if (!creatorTotal[creator]) creatorTotal[creator] = 0;
                creatorTotal[creator]++;

                if (!reasonTotal[reason]) reasonTotal[reason] = 0;
                reasonTotal[reason]++;
            }

            // 今月集計
            if (month === currentMonthStr) {
                currentMonthCount++;
                if (!currentMonthCreators[creator]) currentMonthCreators[creator] = 0;
                currentMonthCreators[creator]++;
            }
        });

        let sortedMonths = Array.from(monthSet).sort();
        let sortedCreators = Object.keys(creatorTotal).sort((a, b) => creatorTotal[b] - creatorTotal[a]);
        let sortedReasons = Object.keys(reasonTotal).sort((a, b) => reasonTotal[b] - reasonTotal[a]);
        
        let mvpName = '-';
        let mvpCount = 0;
        Object.keys(currentMonthCreators).forEach(c => {
            if (currentMonthCreators[c] > mvpCount) {
                mvpCount = currentMonthCreators[c];
                mvpName = c;
            }
        });

        // フィルタ時の表示テキスト調整
        let title1 = selectedCreator === 'ALL' ? '総レコード数' : selectedCreator + 'のレコード数';
        let title3 = selectedCreator === 'ALL' ? '🥇 今月のMVP' : '🥇 今月の登録数';
        let displayMvp = selectedCreator === 'ALL' ? mvpName : selectedCreator;
        
        let displayMonths = [...last3MonthsStr].reverse();

        // --- UI（HTML）の構築 ---
        const contentHTML = `
            <div class="dashboard-008-cards">
                <div class="dashboard-008-card card-bg-1">
                    <div class="dashboard-008-card-title">${title1}</div>
                    <div class="dashboard-008-card-value">${targetRecords.length.toLocaleString()} <span style="font-size:1rem;">件</span></div>
                </div>
                <div class="dashboard-008-card card-bg-2">
                    <div class="dashboard-008-card-title">今月 (${currentMonthStr}) の登録</div>
                    <div class="dashboard-008-card-value" style="color:#00d2ff;">${currentMonthCount.toLocaleString()} <span style="font-size:1rem;">件</span></div>
                </div>
                <div class="dashboard-008-card card-bg-3">
                    <div class="dashboard-008-card-title">${title3}</div>
                    <div class="dashboard-008-card-value" style="color:#ffa500; font-size:1.4rem;">${displayMvp}</div>
                    <div class="dashboard-008-card-sub">${mvpCount}件登録</div>
                </div>
                <div class="dashboard-008-card card-bg-4">
                    <div class="dashboard-008-card-title">👑 トップ来館キッカケ</div>
                    <div class="dashboard-008-card-value" style="color:#b388ff; font-size:1.4rem;">${sortedReasons.length > 0 ? sortedReasons[0] : '-'}</div>
                    <div class="dashboard-008-card-sub">${sortedReasons.length > 0 ? reasonTotal[sortedReasons[0]].toLocaleString() : 0}件 (直近3ヶ月)</div>
                </div>
            </div>

            <!-- 1段目: 来店キッカケ推移 -->
            <div class="dashboard-008-row">
                <div class="dashboard-008-chart-container">
                    <div style="font-size:0.9rem; margin-bottom:10px; opacity:0.8;">📈 来館キッカケ別の登録推移 (月別)</div>
                    <div style="height: 300px; width: 100%;">
                        <canvas id="dashboard-008-reason-chart"></canvas>
                    </div>
                </div>
                <div class="dashboard-008-list-container">
                    <div class="dashboard-008-list-title">🎯 来館キッカケ 直近3ヶ月の推移</div>
                    ${sortedReasons.map((r, i) => {
                        let countsHTML = displayMonths.map(m => {
                            let mLabel = parseInt(m.split('-')[1]) + '月';
                            let count = (monthlyReasonData[m] && monthlyReasonData[m][r]) ? monthlyReasonData[m][r] : 0;
                            let isCurrent = m === currentMonthStr;
                            return `<span style="opacity:0.6; margin-right:3px; font-size:0.75rem;">${mLabel}:</span><b style="margin-right:${isCurrent ? '0' : '10px'}; ${isCurrent ? 'color:#00d2ff;' : ''}">${count}</b>`;
                        }).join('');
                        return `
                        <div class="dashboard-008-list-item" style="align-items:center;">
                            <div style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-right:10px;">
                                <span style="opacity:0.5; font-size:0.8rem; margin-right:8px;">${i+1}</span>
                                <span title="${r}">${r}</span>
                            </div>
                            <div style="font-size:0.85rem; white-space:nowrap; display:flex; align-items:baseline;">
                                ${countsHTML}
                            </div>
                        </div>
                        `;
                    }).join('')}
                </div>
            </div>

            <!-- 2段目: 作成者推移 -->
            <div class="dashboard-008-row" id="dashboard-008-creator-row">
                <div class="dashboard-008-chart-container">
                    <div style="font-size:0.9rem; margin-bottom:10px; opacity:0.8;">👤 作成者別の登録推移 (月別)</div>
                    <div style="height: 300px; width: 100%;">
                        <canvas id="dashboard-008-creator-chart"></canvas>
                    </div>
                </div>
                <div class="dashboard-008-list-container">
                    <div class="dashboard-008-list-title">🏆 作成者 直近3ヶ月の推移</div>
                    ${sortedCreators.map((c, i) => {
                        let countsHTML = displayMonths.map(m => {
                            let mLabel = parseInt(m.split('-')[1]) + '月';
                            let count = (monthlyCreatorData[m] && monthlyCreatorData[m][c]) ? monthlyCreatorData[m][c] : 0;
                            let isCurrent = m === currentMonthStr;
                            return `<span style="opacity:0.6; margin-right:3px; font-size:0.75rem;">${mLabel}:</span><b style="margin-right:${isCurrent ? '0' : '10px'}; ${isCurrent ? 'color:#00d2ff;' : ''}">${count}</b>`;
                        }).join('');
                        return `
                        <div class="dashboard-008-list-item" style="align-items:center;">
                            <div style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; margin-right:10px;">
                                <span style="opacity:0.5; font-size:0.8rem; margin-right:8px;">${i+1}</span>
                                <span title="${c}">${c}</span>
                            </div>
                            <div style="font-size:0.85rem; white-space:nowrap; display:flex; align-items:baseline;">
                                ${countsHTML}
                            </div>
                        </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;

        document.getElementById('dashboard-008-dynamic-content').innerHTML = contentHTML;

        // もし特定の作成者で絞り込んでいる場合は「作成者推移グラフ」は単色になって意味が薄いため非表示（任意）
        // でも今回は表示しておく。1本だけのグラフとして表示される。
        
        drawChart('dashboard-008-reason-chart', sortedMonths, sortedReasons, monthlyReasonData);
        drawChart('dashboard-008-creator-chart', sortedMonths, sortedCreators, monthlyCreatorData);
    }

    /**
     * 共通のChart.js描画関数
     */
    function drawChart(canvasId, sortedMonths, keys, monthlyData) {
        const colors = [
            'rgba(0, 210, 255, 0.8)', 'rgba(255, 165, 0, 0.8)', 'rgba(142, 45, 226, 0.8)',
            'rgba(255, 99, 132, 0.8)', 'rgba(75, 192, 192, 0.8)', 'rgba(255, 206, 86, 0.8)',
            'rgba(153, 102, 255, 0.8)', 'rgba(201, 203, 207, 0.8)', 'rgba(54, 162, 235, 0.8)'
        ];

        const topKeys = keys.slice(0, 15);
        
        let datasets = topKeys.map((k, index) => {
            return {
                label: k,
                data: sortedMonths.map(m => (monthlyData[m] && monthlyData[m][k]) ? monthlyData[m][k] : 0),
                backgroundColor: colors[index % colors.length],
                stack: 'Stack 0',
                borderRadius: 2
            };
        });

        if (keys.length > 15) {
            let otherData = sortedMonths.map(m => {
                let sum = 0;
                for (let i = 15; i < keys.length; i++) {
                    let k = keys[i];
                    if (monthlyData[m] && monthlyData[m][k]) sum += monthlyData[m][k];
                }
                return sum;
            });
            datasets.push({
                label: 'その他',
                data: otherData,
                backgroundColor: 'rgba(100, 100, 100, 0.6)',
                stack: 'Stack 0',
                borderRadius: 2
            });
        }

        const ctx = document.getElementById(canvasId).getContext('2d');
        if (window[canvasId + 'Inst']) window[canvasId + 'Inst'].destroy();
        
        window[canvasId + 'Inst'] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: sortedMonths,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { position: 'right', labels: { color: '#fff', font: { size: 10 } } },
                    tooltip: {
                        callbacks: {
                            footer: (tooltipItems) => {
                                let total = tooltipItems.reduce((a, e) => a + e.parsed.y, 0);
                                return '合計: ' + total;
                            }
                        }
                    }
                },
                scales: {
                    x: { stacked: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#aaa' } },
                    y: { stacked: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#aaa' } }
                }
            }
        });
    }

})();
