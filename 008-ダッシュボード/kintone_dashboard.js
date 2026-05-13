/* Ver.2.4.1 - 008-ダッシュボード (Logic & Layout Fix) */
(function() {
    'use strict';

    const CREATOR_FIELD = '作成者';
    const DATE_FIELD = '作成日時';
    const REASON_FIELD = '来店';
    const AI_PROXY_URL = 'https://script.google.com/macros/s/AKfycbwGaRG9gmMc1FUKvzZfF_xw46kSZ75FZfEQEg43W-T07LXvkJVmSXxLfTw1en7NE5X_tA/exec';

    let allFetchedRecords = [];

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
        btn.innerHTML = '📊 来場者分析ダッシュボード';
        btn.style.margin = '10px'; btn.style.padding = '8px 16px';
        btn.style.backgroundColor = '#8e2de2'; btn.style.color = 'white';
        btn.style.border = 'none'; btn.style.borderRadius = '4px';
        btn.style.cursor = 'pointer'; btn.style.fontWeight = 'bold';

        btn.onclick = async () => {
            createDashboardContainer();
            if (allFetchedRecords.length === 0) {
                allFetchedRecords = await fetchAllRecords();
            }
            renderDashboardBase();
            updateDashboardData('ALL');
        };
        menuSpace.appendChild(btn);

        return event;
    });

    function createDashboardContainer() {
        const oldOverlay = document.getElementById('dashboard-overlay-008');
        if (oldOverlay) oldOverlay.remove();

        const overlay = document.createElement('div');
        overlay.id = 'dashboard-overlay-008';
        overlay.style.display = 'flex';
        
        const modal = document.createElement('div');
        modal.id = 'dashboard-modal-008';
        
        modal.innerHTML = `
            <div class="dashboard-008-header">
                <div class="dashboard-008-title">📊 来場者登録統計 (ロジック修正版)</div>
                <button class="dashboard-008-close" id="close-dashboard-008">&times;</button>
            </div>
            <div id="dashboard-008-content">
                <div class="dashboard-008-loading" style="text-align:center; padding:100px 0;">
                    <div class="dashboard-008-spinner" style="margin: 0 auto 20px;"></div>
                    <div style="color: #00d2ff; font-weight: bold;">データを集計中...</div>
                </div>
            </div>
            <div style="text-align:right; margin-top:15px; font-size:10px; opacity:0.4; color:white;">Ver.2.4.1</div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        document.getElementById('close-dashboard-008').onclick = () => overlay.style.display = 'none';

        if (!document.getElementById('dashboard-detail-overlay-008')) {
            const detailOverlay = document.createElement('div');
            detailOverlay.id = 'dashboard-detail-overlay-008';
            detailOverlay.innerHTML = `
                <div id="dashboard-detail-modal-008">
                    <div class="dashboard-008-detail-header">
                        <div class="dashboard-008-detail-title" id="dashboard-008-detail-title">詳細一覧</div>
                        <div style="display:flex; gap:10px; align-items:center;">
                            <button class="dashboard-008-ai-btn" id="dashboard-008-ai-start-btn">✨ AI傾向分析</button>
                            <button class="dashboard-008-close" id="close-dashboard-detail-008">&times;</button>
                        </div>
                    </div>
                    <div class="dashboard-008-detail-body">
                        <div class="dashboard-008-ai-panel" id="dashboard-008-ai-panel">
                            <div id="dashboard-008-ai-result" class="dashboard-008-ai-content"></div>
                        </div>
                        <div id="dashboard-008-detail-table-container"></div>
                    </div>
                </div>
            `;
            document.body.appendChild(detailOverlay);
            document.getElementById('close-dashboard-detail-008').onclick = () => detailOverlay.style.display = 'none';
        }
    }

    async function fetchAllRecords() {
        let records = [];
        let offset = 0;
        try {
            while (true) {
                const resp = await kintone.api(kintone.api.url('/k/v1/records', true), 'GET', {
                    app: kintone.app.getId(),
                    query: `order by ${DATE_FIELD} desc limit 500 offset ${offset}`
                });
                records = records.concat(resp.records);
                if (resp.records.length < 500) break;
                offset += 500;
            }
        } catch (e) { console.error('Fetch Error:', e); }
        return records;
    }

    function renderDashboardBase() {
        let creators = new Set();
        allFetchedRecords.forEach(r => {
            let name = (r[CREATOR_FIELD] && r[CREATOR_FIELD].value) ? (r[CREATOR_FIELD].value.name || r[CREATOR_FIELD].value) : '';
            if (name) creators.add(name);
        });
        let sortedCreators = Array.from(creators).sort();
        
        let filterOptions = `<option value="ALL">すべて (全件表示)</option>` + 
                           sortedCreators.map(c => `<option value="${c}">${c}</option>`).join('');

        document.getElementById('dashboard-008-content').innerHTML = `
            <div class="dashboard-008-filter-bar">
                <div class="dashboard-008-filter-label">🔍 絞り込み:</div>
                <select id="dashboard-008-creator-filter">${filterOptions}</select>
            </div>
            <div id="dashboard-008-dynamic-content"></div>
        `;

        document.getElementById('dashboard-008-creator-filter').onchange = (e) => updateDashboardData(e.target.value);
    }

    function updateDashboardData(selectedCreator) {
        let targetRecords = allFetchedRecords;
        if (selectedCreator !== 'ALL') {
            targetRecords = allFetchedRecords.filter(r => {
                let name = (r[CREATOR_FIELD] && r[CREATOR_FIELD].value) ? (r[CREATOR_FIELD].value.name || r[CREATOR_FIELD].value) : '';
                return name === selectedCreator;
            });
        }

        const now = new Date();
        let months = [];
        for(let i=0; i<3; i++) {
            let d = new Date(now.getFullYear(), now.getMonth()-i, 1);
            months.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`);
        }
        const displayMonths = [...months].reverse();

        let monthlyMotive = {};
        let monthlyStaff = {};
        let motiveTotal = {};
        let staffTotal = {};
        let thisMonthCount = 0;
        const curMonthStr = months[0];

        targetRecords.forEach(r => {
            const date = r[DATE_FIELD]?.value || '';
            const m = date.substring(0, 7);
            const motive = r[REASON_FIELD]?.value || '不明';
            const staff = (r[CREATOR_FIELD] && r[CREATOR_FIELD].value) ? (r[CREATOR_FIELD].value.name || r[CREATOR_FIELD].value) : '不明';

            if (m === curMonthStr) thisMonthCount++;

            if (!monthlyMotive[m]) monthlyMotive[m] = {};
            monthlyMotive[m][motive] = (monthlyMotive[m][motive] || 0) + 1;

            if (!monthlyStaff[m]) monthlyStaff[m] = {};
            monthlyStaff[m][staff] = (monthlyStaff[m][staff] || 0) + 1;

            if (months.includes(m)) {
                motiveTotal[motive] = (motiveTotal[motive] || 0) + 1;
                staffTotal[staff] = (staffTotal[staff] || 0) + 1;
            }
        });

        const sortedMotives = Object.keys(motiveTotal).sort((a,b) => motiveTotal[b] - motiveTotal[a]);
        const sortedStaff = Object.keys(staffTotal).sort((a,b) => staffTotal[b] - staffTotal[a]);

        const mvpName = selectedCreator === 'ALL' ? (sortedStaff[0] || '-') : selectedCreator;
        const mvpCount = (monthlyStaff[curMonthStr] && monthlyStaff[curMonthStr][mvpName]) || 0;

        document.getElementById('dashboard-008-dynamic-content').innerHTML = `
            <div class="dashboard-008-cards">
                <div class="dashboard-008-card card-bg-1">
                    <div class="dashboard-008-card-title">総レコード数</div>
                    <div class="dashboard-008-card-value">${targetRecords.length.toLocaleString()} 件</div>
                </div>
                <div class="dashboard-008-card card-bg-2">
                    <div class="dashboard-008-card-title">今月の登録 (${curMonthStr})</div>
                    <div class="dashboard-008-card-value" style="color:#00d2ff;">${thisMonthCount.toLocaleString()} 件</div>
                </div>
                <div class="dashboard-008-card card-bg-3">
                    <div class="dashboard-008-card-title">🥇 ${selectedCreator === 'ALL' ? '今月のMVP' : 'あなたの今月の登録'}</div>
                    <div class="dashboard-008-card-value" style="color:#ffa500;">${mvpName}</div>
                    <div class="dashboard-008-card-sub">${mvpCount} 件登録</div>
                </div>
                <div class="dashboard-008-card card-bg-4">
                    <div class="dashboard-008-card-title">👑 トップ来館キッカケ</div>
                    <div class="dashboard-008-card-value" style="color:#b388ff;">${sortedMotives[0] || '-'}</div>
                    <div class="dashboard-008-card-sub">${motiveTotal[sortedMotives[0]] || 0} 件 (直近3ヶ月)</div>
                </div>
            </div>

            <div class="dashboard-008-row">
                <div class="dashboard-008-chart-container"><canvas id="chart-motive"></canvas></div>
                <div class="dashboard-008-list-container">
                    <div class="dashboard-008-list-title">🎯 来場動機 直近3ヶ月の推移</div>
                    ${renderTrendList(sortedMotives, monthlyMotive, displayMonths, REASON_FIELD)}
                </div>
            </div>
            <div class="dashboard-008-row">
                <div class="dashboard-008-chart-container"><canvas id="chart-staff"></canvas></div>
                <div class="dashboard-008-list-container">
                    <div class="dashboard-008-list-title">🏆 担当者 直近3ヶ月の推移</div>
                    ${renderTrendList(sortedStaff, monthlyStaff, displayMonths, CREATOR_FIELD)}
                </div>
            </div>
        `;

        drawStackedChart('chart-motive', monthlyMotive, sortedMotives.slice(0, 10));
        drawStackedChart('chart-staff', monthlyStaff, sortedStaff.slice(0, 10));

        document.querySelectorAll('.dashboard-008-list-item-name').forEach(el => {
            el.onclick = (e) => {
                const key = el.getAttribute('data-key');
                const field = el.getAttribute('data-field');
                showDetailModal(key, field, targetRecords, 'RECENT_3', displayMonths);
                e.stopPropagation();
            };
        });

        document.querySelectorAll('.dashboard-008-list-item-trend-value').forEach(el => {
            el.onclick = (e) => {
                const key = el.getAttribute('data-key');
                const field = el.getAttribute('data-field');
                const month = el.getAttribute('data-month');
                showDetailModal(key, field, targetRecords, month, null);
                e.stopPropagation();
            };
        });
    }

    function renderTrendList(keys, monthlyData, displayMonths, field) {
        return keys.map((key, i) => {
            let trends = displayMonths.map(m => {
                let count = (monthlyData[m] && monthlyData[m][key]) || 0;
                return `<span class="dashboard-008-list-item-trend-value" data-key="${key}" data-field="${field}" data-month="${m}" style="cursor:pointer; margin-right:8px;">
                    <span style="opacity:0.6; font-size:0.7rem;">${m.split('-')[1]}月:</span><b style="color:#00d2ff; text-decoration:underline;">${count}</b>
                </span>`;
            }).join('');
            return `
                <div class="dashboard-008-list-item">
                    <div class="dashboard-008-list-item-name" data-key="${key}" data-field="${field}" style="flex:1; cursor:pointer; color:#00d2ff; text-decoration:underline;">
                        ${i+1}. ${key}
                    </div>
                    <div style="font-size:0.8rem;">${trends}</div>
                </div>
            `;
        }).join('');
    }

    function drawStackedChart(canvasId, monthlyData, keys) {
        const ctx = document.getElementById(canvasId).getContext('2d');
        const months = Object.keys(monthlyData).sort();
        const colors = ['#00d2ff', '#3a7bd5', '#8e2de2', '#f7971e', '#ffd200', '#ff4b2b', '#4facfe', '#00f2fe', '#f093fb', '#f5576c'];
        
        const datasets = keys.map((k, i) => ({
            label: k,
            data: months.map(m => monthlyData[m][k] || 0),
            backgroundColor: colors[i % colors.length],
            stack: 'stack1'
        }));

        if (window[canvasId + 'Inst']) window[canvasId + 'Inst'].destroy();
        window[canvasId + 'Inst'] = new Chart(ctx, {
            type: 'bar',
            data: { labels: months, datasets: datasets },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { position: 'right', labels: { color: 'white', font: { size: 10 } } } },
                scales: { x: { stacked: true, ticks: { color: '#aaa' } }, y: { stacked: true, ticks: { color: '#aaa' } } }
            }
        });
    }

    function showDetailModal(key, field, records, monthFilter, allRecentMonths) {
        const detailOverlay = document.getElementById('dashboard-detail-overlay-008');
        const titleEl = document.getElementById('dashboard-008-detail-title');
        const tableContainer = document.getElementById('dashboard-008-detail-table-container');
        const aiPanel = document.getElementById('dashboard-008-ai-panel');

        let displayMonthLabel = monthFilter === 'RECENT_3' ? '直近3ヶ月' : (monthFilter || 'すべて');
        const displayStaff = key; 
        const searchKey = `${displayStaff}_${displayMonthLabel}`;
        const cleanTitle = `${displayStaff}(${displayMonthLabel})`;
        
        let filtered = records.filter(r => {
            let val = (r[field] && r[field].value) ? (r[field].value.name || r[field].value) : '';
            return val === key;
        });

        if (monthFilter === 'RECENT_3' && allRecentMonths) {
            filtered = filtered.filter(r => {
                const m = r[DATE_FIELD]?.value?.substring(0, 7);
                return allRecentMonths.includes(m);
            });
        } else if (monthFilter && monthFilter !== 'RECENT_3') {
            filtered = filtered.filter(r => r[DATE_FIELD]?.value?.startsWith(monthFilter));
        }

        titleEl.innerHTML = `
            <div style="font-weight: bold; white-space: nowrap;">${displayStaff} の詳細 (${displayMonthLabel})</div> 
            <div style="font-size:0.8rem; opacity:0.6;">(全 ${filtered.length} 件のレコード)</div>
        `;
        detailOverlay.style.display = 'flex';
        aiPanel.style.display = 'none';

        tableContainer.innerHTML = `
            <div id="dashboard-008-table-wrapper" style="height: 72vh; overflow-y: scroll; margin-top: 10px;">
                <table class="dashboard-008-detail-table" style="width:100%; border-collapse:collapse;">
                    <thead style="position: sticky; top: 0; background:#1e1e2e; z-index:10;">
                        <tr style="border-bottom:2px solid #00d2ff; font-size:0.95rem;">
                            <th style="padding:15px; width:40px;">No.</th>
                            <th style="padding:15px; width:220px;">基本情報 (日付/客名/担当)</th>
                            <th style="padding:15px; width:120px;">商品番</th>
                            <th style="padding:15px;">対応内容</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${filtered.map((r, i) => {
                            const recordUrl = `/k/${kintone.app.getId()}/show#record=${r.$id.value}`;
                            const date = (r[DATE_FIELD]?.value || '').substring(0, 10);
                            return `
                            <tr>
                                <td style="padding:15px; text-align:center; font-size:0.9rem;"><a href="${recordUrl}" target="_blank" style="color:#00d2ff;">${i+1}</a></td>
                                <td style="padding:15px; line-height:1.6; border-right: 1px solid rgba(255,255,255,0.05);">
                                    <div style="opacity:0.7; font-size:0.85rem;">${date}</div>
                                    <div style="font-weight:bold; color:#fff; font-size:1.1rem; margin:3px 0;">${r.お客様名?.value || '-'}</div>
                                    <div style="font-size:0.85rem; opacity:0.9; color:#00d2ff;">👤 ${r.接客スタッフ?.value || '-'}</div>
                                </td>
                                <td style="padding:15px; font-size:0.85rem; color:#aaa; text-align:center;">${r.見られた商品番?.value || '-'}</td>
                                <td style="padding:15px; font-size:1rem; line-height:1.7; vertical-align: top;">${r.対応内容?.value || '-'}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;

        document.getElementById('dashboard-008-ai-start-btn').onclick = () => runAIAnalysis(cleanTitle, filtered, displayStaff, displayMonthLabel, searchKey);
        autoCheckExistingAnalysis(cleanTitle, displayStaff, displayMonthLabel, filtered.length, searchKey);
    }

    function formatAIResult(text) {
        if (!text) return "";
        let cleanText = text.replace(/```html|```/g, '')
                            .replace(/<style.*?>[\s\S]*?<\/style>/gi, '') 
                            .replace(/<html.*?>|<\/html>|<body.*?>|<\/body>|<head.*?>[\s\S]*?<\/head>/gi, '')
                            .trim();

        let formatted = cleanText;
        if (!/<[a-z][\s\S]*?>/i.test(cleanText)) {
            formatted = cleanText.replace(/\n/g, '<br>');
        }

        formatted = formatted.replace(/【(.*?)】/g, '<strong style="color:#00d2ff; font-size:1.1rem; border-left:4px solid #00d2ff; padding-left:8px; margin:15px 0 10px 0; display:block;">$1</strong>');
        formatted = formatted.replace(/([■●](.*?))(<br>|$)/g, '<b style="color:#ffcc00;">$1</b>$3');
        
        const style = `
            <style>
                .dashboard-008-ai-content h3 { color: #00d2ff; margin: 15px 0 5px 0; font-size: 1.1rem; border-bottom: 1px solid rgba(0,210,255,0.2); padding-bottom: 3px; }
                .dashboard-008-ai-content p { margin: 0 0 10px 0; }
                .dashboard-008-ai-content ul { margin: 0 0 10px 0; padding-left: 20px; }
                .dashboard-008-ai-content li { margin-bottom: 5px; }
                .dashboard-008-ai-content b, .dashboard-008-ai-content strong { color: #ffcc00; }
            </style>
        `;
        return `${style}<div style="color:white !important; line-height:1.6;">${formatted}</div>`;
    }

    async function autoCheckExistingAnalysis(title, creator, month, count, searchKey) {
        const aiResultEl = document.getElementById('dashboard-008-ai-result');
        const aiPanel = document.getElementById('dashboard-008-ai-panel');
        const aiBtn = document.getElementById('dashboard-008-ai-start-btn');
        aiPanel.style.display = 'block';
        aiResultEl.innerHTML = '<span style="font-size:0.8rem; opacity:0.5;">検索中...</span>';
        try {
            const resp = await fetch(AI_PROXY_URL, { method: 'POST', body: JSON.stringify({ action: 'analyze', title: title, query_key: searchKey, target_name: creator, target_period: month, recordCount: count, records: [] }) });
            const result = await resp.json();
            if (result.success && result.cached) {
                aiResultEl.innerHTML = formatAIResult(result.analysis_result);
                aiBtn.innerText = '✨ AI再分析';
                aiBtn.style.opacity = '0.7';
            } else {
                aiResultEl.innerHTML = '<div style="font-size:0.8rem; opacity:0.6;">過去の分析はありません。分析を開始してください。</div>';
                aiBtn.innerText = '✨ AI傾向分析';
                aiBtn.style.opacity = '1';
            }
        } catch (e) { aiPanel.style.display = 'none'; }
    }

    async function runAIAnalysis(title, records, creator, month, searchKey) {
        const aiResultEl = document.getElementById('dashboard-008-ai-result');
        const aiPanel = document.getElementById('dashboard-008-ai-panel');
        const aiBtn = document.getElementById('dashboard-008-ai-start-btn');
        aiPanel.style.display = 'block';
        aiBtn.disabled = true;
        aiResultEl.innerHTML = '<div class="dashboard-008-spinner"></div> AI分析中...';
        try {
            const resp = await fetch(AI_PROXY_URL, { method: 'POST', body: JSON.stringify({ action: 'analyze', title: title, query_key: searchKey, target_name: creator, target_period: month, recordCount: records.length, force_refresh: true, records: records.map(r => ({'日付': r[DATE_FIELD]?.value || '', '接客スタッフ': r.接客スタッフ?.value || '', 'お客様名': r.お客様名?.value || '', '見られた商品番': r.見られた商品番?.value || '', '来店': r[REASON_FIELD]?.value || '', '対応内容': r.対応内容?.value || '', '見積金額': r.見積金額?.value ? parseInt(r.見積金額.value).toLocaleString() + '円' : '0円' })) }) });
            const result = await resp.json();
            if (result.success) {
                aiResultEl.innerHTML = formatAIResult(result.analysis_result);
                aiBtn.innerText = '✨ AI再分析';
            } else {
                aiResultEl.innerHTML = `エラー: ${result.error}`;
            }
        } catch (e) { aiResultEl.innerHTML = `エラー: ${e.message}`; } finally { aiBtn.disabled = false; }
    }

    if (typeof Chart === 'undefined') {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/chart.js';
        document.head.appendChild(s);
    }
})();
