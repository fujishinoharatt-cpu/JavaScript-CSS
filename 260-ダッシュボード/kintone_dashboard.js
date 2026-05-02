// Ver.1.12.0 - Full Specs Dashboard
(function() {
    'use strict';

    const FIELD_CODE = '都道府県';
    const BIRTHDAY_FIELD = '生年月日';      // 生年月日
    const CREATED_FIELD = '作成日時';        // 作成日時

    kintone.events.on('app.record.index.show', function(event) {
        if (document.getElementById('show-dashboard-btn')) return event;

        var menuSpace = null;
        try {
            if (typeof kintone !== 'undefined' && kintone.app && typeof kintone.app.getHeaderMenuSpace === 'function') {
                menuSpace = kintone.app.getHeaderMenuSpace();
            }
            if (!menuSpace) menuSpace = document.querySelector('.kintone-app-headermenu-space');
        } catch (e) { console.warn(e); }

        if (!menuSpace) return event;
        
        const btn = document.createElement('button');
        btn.id = 'show-dashboard-btn';
        btn.innerHTML = '顧客分析 📊';
        btn.style.margin = '10px'; btn.style.padding = '8px 16px';
        btn.style.backgroundColor = '#4A90E2'; btn.style.color = 'white';
        btn.style.border = 'none'; btn.style.borderRadius = '4px';
        btn.style.cursor = 'pointer'; btn.style.fontWeight = 'bold';
        
        const overlay = document.createElement('div');
        overlay.id = 'dashboard-overlay';
        overlay.style.display = 'none'; overlay.style.position = 'fixed';
        overlay.style.top = '0'; overlay.style.left = '0';
        overlay.style.width = '100%'; overlay.style.height = '100%';
        overlay.style.backgroundColor = 'rgba(0,0,0,0.7)';
        overlay.style.backdropFilter = 'blur(8px)'; overlay.style.zIndex = '10000';
        overlay.style.justifyContent = 'center'; overlay.style.alignItems = 'center';

        const modal = document.createElement('div');
        modal.style.width = '1100px'; modal.style.maxHeight = '95vh';
        modal.style.padding = '35px'; modal.style.background = '#1e1e2f';
        modal.style.borderRadius = '24px'; modal.style.color = 'white';
        modal.style.position = 'relative'; modal.style.overflowY = 'auto';

        modal.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:20px; border-bottom:1px solid #444; padding-bottom:15px;">
                <div style="font-size:1.4rem; font-weight:bold;">📊 顧客データ 高度分析ダッシュボード</div>
                <button id="close-dashboard" style="background:none; border:none; color:#ccc; cursor:pointer; font-size:28px;">&times;</button>
            </div>
            
            <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:15px; margin-bottom:25px;">
                <div id="card-total" style="background:#2d2d44; padding:15px; border-radius:15px;"></div>
                <div id="card-avg-age" style="background:rgba(142,45,226,0.15); border:1px solid #8e2de2; padding:15px; border-radius:15px;"></div>
                <div id="card-top-group" style="background:rgba(255,165,0,0.1); border:1px solid #ffa500; padding:15px; border-radius:15px;"></div>
                <div id="card-newest" style="background:rgba(0,210,255,0.1); border:1px solid #00d2ff; padding:15px; border-radius:15px;"></div>
            </div>

            <div style="display:grid; grid-template-columns: 1.5fr 1fr 1fr; gap:25px; margin-bottom:25px;">
                <div style="background:rgba(255,255,255,0.02); padding:15px; border-radius:15px;">
                    <div style="font-size:0.9rem; margin-bottom:10px; opacity:0.7;">📍 地域別分布</div>
                    <div id="chartContainer" style="height: 350px;"><canvas id="mainChart"></canvas></div>
                </div>
                <div style="background:rgba(255,255,255,0.02); padding:15px; border-radius:15px;">
                    <div style="font-size:0.9rem; margin-bottom:10px; opacity:0.7;">🎂 年齢別分布</div>
                    <div style="height: 350px;"><canvas id="ageChart"></canvas></div>
                </div>
                <div id="listContainer" style="background:rgba(255,255,255,0.05); padding:15px; border-radius:15px; overflow-y:auto; height:380px;"></div>
            </div>

            <div style="background:rgba(255,255,255,0.02); padding:15px; border-radius:15px;">
                <div style="font-size:0.9rem; margin-bottom:10px; opacity:0.7;">📈 登録時期別推移 (月別)</div>
                <div style="height: 250px;"><canvas id="trendChart"></canvas></div>
            </div>

            <div style="text-align:right; margin-top:20px; font-size:10px; opacity:0.3;">Ver.1.12.0</div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        btn.onclick = function() {
            overlay.style.display = 'flex';
            renderDashboard(event.records);
        };

        document.getElementById('close-dashboard').onclick = function() { overlay.style.display = 'none'; };
        overlay.onclick = function(e) { if(e.target === overlay) overlay.style.display = 'none'; };

        menuSpace.appendChild(btn);
        return event;
    });

    function getAge(birthday) {
        if (!birthday) return null;
        const today = new Date();
        const birthDate = new Date(birthday);
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    }

    function renderDashboard(records) {
        const prefCounts = {};
        const monthCounts = {};
        const ageGroups = {
            '10代未満': 0, '10代': 0, '20代': 0, '30代': 0, '40代': 0, '50代': 0, '60代以上': 0
        };
        let totalAge = 0;
        let ageEntryCount = 0;

        records.forEach(r => {
            // 都道府県
            const pref = (r[FIELD_CODE] && r[FIELD_CODE].value) ? r[FIELD_CODE].value : '未入力';
            if (!prefCounts[pref]) prefCounts[pref] = { total: 0 };
            prefCounts[pref].total++;

            // 年齢
            const bday = (r[BIRTHDAY_FIELD] && r[BIRTHDAY_FIELD].value) ? r[BIRTHDAY_FIELD].value : null;
            const age = getAge(bday);
            if (age !== null) {
                totalAge += age;
                ageEntryCount++;
                if (age < 10) ageGroups['10代未満']++;
                else if (age < 20) ageGroups['10代']++;
                else if (age < 30) ageGroups['20代']++;
                else if (age < 40) ageGroups['30代']++;
                else if (age < 50) ageGroups['40代']++;
                else if (age < 60) ageGroups['50代']++;
                else ageGroups['60代以上']++;
            }

            // 推移
            if (r[CREATED_FIELD] && r[CREATED_FIELD].value) {
                const month = r[CREATED_FIELD].value.substring(0, 7); 
                monthCounts[month] = (monthCounts[month] || 0) + 1;
            }
        });

        document.getElementById('card-total').innerHTML = `<div style="font-size:0.7rem;opacity:0.6;">総顧客数</div><div style="font-size:1.6rem;font-weight:bold;">${records.length} 名</div>`;
        document.getElementById('card-avg-age').innerHTML = `<div style="font-size:0.7rem;color:#b388ff;font-weight:bold;">👥 平均年齢</div><div style="font-size:1.6rem;font-weight:bold;">${ageEntryCount > 0 ? Math.round(totalAge / ageEntryCount) : '-'} 歳</div>`;
        
        const sortedAgeGroups = Object.entries(ageGroups).sort((a,b) => b[1] - a[1]);
        const topGroup = sortedAgeGroups[0];
        document.getElementById('card-top-group').innerHTML = `<div style="font-size:0.7rem;color:#ffa500;font-weight:bold;">🏆 主要な年齢層</div><div style="font-size:1.6rem;font-weight:bold;">${topGroup[1] > 0 ? topGroup[0] : '-'}</div>`;
        
        const latestMonth = Object.keys(monthCounts).sort().reverse()[0] || '-';
        document.getElementById('card-newest').innerHTML = `<div style="font-size:0.7rem;color:#00d2ff;font-weight:bold;">🆕 直近の登録</div><div style="font-size:1.3rem;font-weight:bold;margin-top:5px;">${latestMonth}</div>`;

        const sortedPref = Object.entries(prefCounts).sort((a,b) => b[1].total - a[1].total);
        document.getElementById('listContainer').innerHTML = `
            <div style="font-size:0.75rem;opacity:0.5;margin-bottom:12px;border-bottom:1px solid #444;padding-bottom:5px;">地域別内訳</div>
            ${sortedPref.map(p => `
                <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.03);font-size:0.85rem;">
                    <span>${p[0]}</span>
                    <span><b>${p[1].total}</b></span>
                </div>
            `).join('')}
        `;

        renderCharts(sortedPref, monthCounts, ageGroups);
    }

    function renderCharts(prefData, monthData, ageData) {
        // 地域グラフ
        const ctx1 = document.getElementById('mainChart').getContext('2d');
        if (window.myChart1) window.myChart1.destroy();
        window.myChart1 = new Chart(ctx1, {
            type: 'bar',
            data: {
                labels: prefData.map(d => d[0]),
                datasets: [{ label: '人数', data: prefData.map(d => d[1].total), backgroundColor: 'rgba(0, 210, 255, 0.7)', borderRadius: 4 }]
            },
            options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
                scales: { x: { grid: { color: 'rgba(255,255,255,0.1)' }, ticks: { color: '#888' } }, y: { ticks: { color: '#fff' } } }
            }
        });

        // 年齢グラフ
        const ctxAge = document.getElementById('ageChart').getContext('2d');
        if (window.myAgeChart && typeof window.myAgeChart.destroy === 'function') {
            window.myAgeChart.destroy();
        }
        window.myAgeChart = new Chart(ctxAge, {
            type: 'doughnut',
            data: {
                labels: Object.keys(ageData),
                datasets: [{
                    data: Object.values(ageData),
                    backgroundColor: ['#ff6384', '#36a2eb', '#ffce56', '#4bc0c0', '#9966ff', '#ff9f40', '#c9cbcf'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'bottom', labels: { color: '#fff', font: { size: 10 }, padding: 10 } }
                },
                cutout: '70%'
            }
        });

        // 推移グラフ
        const ctx2 = document.getElementById('trendChart').getContext('2d');
        if (window.myChart2) window.myChart2.destroy();
        const sortedMonths = Object.keys(monthData).sort();
        window.myChart2 = new Chart(ctx2, {
            type: 'line',
            data: {
                labels: sortedMonths,
                datasets: [{
                    label: '登録件数',
                    data: sortedMonths.map(m => monthData[m]),
                    borderColor: '#ffa500',
                    backgroundColor: 'rgba(255,165,0,0.2)',
                    fill: true,
                    tension: 0.3,
                    pointBackgroundColor: '#fff',
                    pointRadius: 4
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
                scales: { 
                    x: { ticks: { color: '#888' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                    y: { ticks: { color: '#888', stepSize: 1 }, grid: { color: 'rgba(255,255,255,0.05)' } }
                }
            }
        });
    }
})();
