// 有害信息录入小工具 v2.0 - 云端加载版
if (document.getElementById('xj-panel')) {
    alert('录入工具已加载，请勿重复点击！');
} else (function () {
    'use strict';

    var CONFIG = {
        harmType: '低俗类',
        infoType: '含有低俗内容的信息',
        waitDialog: 4000,
        delay: 80,
        debug: true,
        siteMap: {
            'toutiao.com': { name: '今日头条', homepage: 'https://www.toutiao.com/', harmType: '涉历史虚无主义有害信息举报专区', hasSecondDropdown: false },
            'weibo.com':   { name: '微博',     homepage: 'https://weibo.com/',           harmType: '低俗类',                           hasSecondDropdown: true }
        }
    };

    function detectSite(url) {
        var keys = Object.keys(CONFIG.siteMap);
        for (var i = 0; i < keys.length; i++) {
            if (url.indexOf(keys[i]) > -1) return CONFIG.siteMap[keys[i]];
        }
        return null;
    }

    var records = [];
    var currentIdx = 0;
    var isRunning = false;
    var isPaused = false;
    var isAutoConfirm = true;
    var dialogIsOpen = false;

    function log(msg) {
        var panel = document.getElementById('xj-log');
        if (panel) {
            panel.innerHTML += '<div>' + msg + '</div>';
            var divs = panel.querySelectorAll('div');
            if (divs.length > 3) {
                for (var k = 0; k < divs.length - 3; k++) {
                    divs[k].remove();
                }
            }
            panel.scrollTop = panel.scrollHeight;
        }
        if (CONFIG.debug) console.log('[录入工具] ' + msg.replace(/<[^>]+>/g, ''));
    }

    function sleep(ms) {
        return new Promise(function (r) { setTimeout(r, ms); });
    }

    function isDialogOpen() {
        var wrappers = document.querySelectorAll('.el-dialog__wrapper');
        for (var i = 0; i < wrappers.length; i++) {
            var w = wrappers[i];
            if (w.style.display === 'none') continue;
            var dialog = w.querySelector('.el-dialog');
            if (dialog && dialog.style.display === 'none') continue;
            if (w.textContent.indexOf('危害类型') > -1) return w;
        }
        return null;
    }

    function findByText(text) {
        var all = document.querySelectorAll('*');
        for (var i = 0; i < all.length; i++) {
            var el = all[i];
            if (el.children.length === 0 || el.tagName === 'SPAN' || el.tagName === 'DIV' && el.textContent.trim() === text) {
                if (el.textContent.trim() === text) return el;
            }
        }
        for (var j = 0; j < all.length; j++) {
            var el2 = all[j];
            if (el2.textContent.trim().indexOf(text) > -1 && el2.textContent.trim().length < text.length + 10) {
                return el2;
            }
        }
        return null;
    }

    function findByTextContains(text) {
        var all = document.querySelectorAll('*');
        for (var i = 0; i < all.length; i++) {
            if (all[i].textContent.trim().indexOf(text) > -1) return all[i];
        }
        return null;
    }

    function realClick(el) {
        if (!el) return;
        var rect = el.getBoundingClientRect();
        var x = rect.left + rect.width / 2;
        var y = rect.top + rect.height / 2;
        ['mousedown', 'mouseup', 'click'].forEach(function (type) {
            var ev = new MouseEvent(type, {
                view: window, bubbles: true, cancelable: true,
                clientX: x, clientY: y, button: 0
            });
            el.dispatchEvent(ev);
        });
        if (el.focus) el.focus();
    }

    async function clickByText(text) {
        var el = findByText(text);
        if (!el) el = findByTextContains(text);
        if (el) {
            realClick(el);
            await sleep(80);
            return true;
        }
        return false;
    }

    function findLabelNear(keyword) {
        var labels = document.querySelectorAll('.el-form-item__label, label, .el-label');
        for (var i = 0; i < labels.length; i++) {
            if (labels[i].textContent.indexOf(keyword) > -1) {
                return labels[i];
            }
        }
        return null;
    }

    function findInputNearLabel(keyword) {
        var label = findLabelNear(keyword);
        if (!label) return null;
        var formItem = label.closest('.el-form-item') || label.parentElement;
        if (formItem) {
            var input = formItem.querySelector('input[type="text"], input:not([type]), textarea');
            if (input) return input;
        }
        var next = label.nextElementSibling;
        while (next) {
            if (next.querySelector) {
                var inp = next.querySelector('input[type="text"], input:not([type]), textarea');
                if (inp) return inp;
            }
            next = next.nextElementSibling;
        }
        return null;
    }

    async function waitForDropdown(labelKeyword, timeout) {
        if (!timeout) timeout = 10000;
        var start = Date.now();
        while (Date.now() - start < timeout) {
            var label = findLabelNear(labelKeyword);
            if (label) {
                var formItem = label.closest('.el-form-item') || label.parentElement;
                if (formItem) {
                    var dropdown = formItem.querySelector('.el-select');
                    if (dropdown && dropdown.offsetParent !== null && !dropdown.classList.contains('is-disabled')) {
                        return dropdown;
                    }
                }
            }
            await sleep(200);
        }
        return null;
    }

    async function selectDropdown(labelKeyword, value) {
        var label = findLabelNear(labelKeyword);
        if (!label) {
            log('⚠ 未找到标签: ' + labelKeyword);
            return false;
        }
        var formItem = label.closest('.el-form-item') || label.parentElement;
        if (!formItem) {
            log('⚠ 未找到表单项: ' + labelKeyword);
            return false;
        }
        var dropdown = formItem.querySelector('.el-select');
        if (!dropdown) {
            log('⚠ 未找到下拉框: ' + labelKeyword);
            return false;
        }
        realClick(dropdown);
        await sleep(200);
        var maxWait = 20;
        var found = false;
        for (var attempt = 0; attempt < maxWait; attempt++) {
            var options = document.querySelectorAll('.el-select-dropdown__item');
            for (var i = 0; i < options.length; i++) {
                if (options[i].textContent.trim() === value) {
                    realClick(options[i]);
                    found = true;
                    break;
                }
            }
            if (found) break;
            await sleep(60);
        }
        if (found) {
            log('✓ ' + labelKeyword + ' → ' + value);
            await sleep(150);
            return true;
        } else {
            log('⚠ 未找到选项: ' + value + '（' + labelKeyword + '），当前所有选项：');
            var allOpts = document.querySelectorAll('.el-select-dropdown__item');
            var optTexts = [];
            for (var j = 0; j < allOpts.length; j++) {
                optTexts.push(allOpts[j].textContent.trim());
            }
            log('  选项列表: ' + optTexts.join(', '));
            return false;
        }
    }

    function setNativeValue(el, value) {
        if (!el) return;
        var lastValue = el.value;
        el.value = value;
        var tracker = el._valueTracker;
        if (tracker) tracker.setValue(lastValue);
        ['input', 'change'].forEach(function (evType) {
            var ev = new Event(evType, { bubbles: true, cancelable: true });
            el.dispatchEvent(ev);
        });
    }

    async function waitForText(text, timeout) {
        if (!timeout) timeout = CONFIG.waitDialog;
        var start = Date.now();
        while (Date.now() - start < timeout) {
            var el = findByText(text);
            if (el) return el;
            el = findByTextContains(text);
            if (el) return el;
            await sleep(200);
        }
        return null;
    }

    async function openDialog() {
        if (dialogIsOpen && isDialogOpen()) {
            log('✓ 对话框已处于打开状态');
            return true;
        }
        dialogIsOpen = false;
        log('正在打开举报对话框...');
        var clicked = await clickByText('我要举报');
        if (!clicked) clicked = await clickByText('立即举报');
        if (clicked) {
            log('✓ 已点击"我要举报"，等待对话框...');
        } else {
            log('⚠ 未找到"我要举报"按钮，请手动点击');
        }
        var startTime = Date.now();
        var dlg = null;
        while (Date.now() - startTime < CONFIG.waitDialog) {
            dlg = isDialogOpen();
            if (dlg) break;
            await sleep(150);
        }
        if (dlg) {
            dialogIsOpen = true;
            log('✓ 对话框已弹出');
            return true;
        }
        log('⚠ 未检测到对话框，请手动打开');
        return false;
    }

    function waitForDialogClose() {
        return new Promise(function (resolve) {
            var dlg = isDialogOpen();
            if (!dlg) {
                dialogIsOpen = false;
                resolve();
                return;
            }
            if (isAutoConfirm) {
                log('⚡ 自动确认中...');
                setTimeout(function () {
                    var btn = findConfirmButton();
                    if (btn) {
                        realClick(btn);
                        log('✓ 已自动点击"确定"');
                    } else {
                        log('⚠ 自动确认：未找到"确定"按钮，请手动点击');
                        if (CONFIG.debug) {
                            var allBtns = document.querySelectorAll('.el-button');
                            var txts = [];
                            for (var i = 0; i < allBtns.length; i++) {
                                if (allBtns[i].offsetParent !== null) txts.push('"' + allBtns[i].textContent.trim() + '"');
                            }
                            console.log('[录入工具] 当前可见按钮: ' + txts.join(', '));
                        }
                    }
                }, 800);
            } else {
                log('✋ 等待您点击"确定"提交...');
            }
            var checker = setInterval(function () {
                var dlg2 = isDialogOpen();
                if (!dlg2) {
                    clearInterval(checker);
                    dialogIsOpen = false;
                    log('✓ 检测到对话框已关闭，准备下一条...');
                    setTimeout(resolve, 400);
                }
            }, 250);
        });
    }

    function findConfirmButton() {
        var wrappers = document.querySelectorAll('.el-dialog__wrapper');
        var searchScope = document;
        for (var w = 0; w < wrappers.length; w++) {
            var wr = wrappers[w];
            if (wr.style.display === 'none') continue;
            var d = wr.querySelector('.el-dialog');
            if (d && d.style.display !== 'none' && wr.textContent.indexOf('危害类型') > -1) {
                searchScope = wr;
                break;
            }
        }
        var btns = searchScope.querySelectorAll('button, .el-button, a.el-button, span.el-button');
        if (CONFIG.debug) console.log('[录入工具] 搜索"确定"按钮，范围: ' + (searchScope === document ? '全文档' : '对话框') + '，找到 ' + btns.length + ' 个按钮');
        for (var i = 0; i < btns.length; i++) {
            var t = btns[i].textContent.replace(/\s/g, '').trim();
            if (t === '确定') return btns[i];
        }
        for (var j = 0; j < btns.length; j++) {
            var t2 = btns[j].textContent.replace(/\s/g, '').trim();
            if (t2.indexOf('确定') > -1 || t2.indexOf('确认') > -1 || t2.indexOf('提交') > -1) {
                return btns[j];
            }
        }
        return null;
    }

    async function fillOne(record) {
        log('正在填写第 <b>' + (currentIdx + 1) + '</b>/' + records.length + ' 条...');
        var link = record['有害信息链接*'] || record['有害信息链接'] || '';
        var site = detectSite(link);
        var harmType = site && site.harmType ? site.harmType : CONFIG.harmType;
        var hasSecond = site ? site.hasSecondDropdown : true;

        await selectDropdown('危害类型', harmType);
        log('✓ 危害类型 → ' + harmType);

        if (hasSecond) {
            await sleep(80);
            var dlg = isDialogOpen();
            if (!dlg) { log('⚠ 对话框已关闭'); return; }
            var allSelects = dlg.querySelectorAll('.el-select');
            var secondSelect = null;
            for (var s = 0; s < allSelects.length; s++) {
                if (allSelects[s].offsetParent !== null && !allSelects[s].classList.contains('is-disabled')) {
                    if (secondSelect === null) {
                        secondSelect = 'skip';
                    } else if (secondSelect === 'skip') {
                        secondSelect = allSelects[s];
                        break;
                    }
                }
            }
            if (!secondSelect || secondSelect === 'skip') {
                log('⚠ 未找到第二个下拉框，尝试按 label 选...');
                await selectDropdown('有害信息类型', CONFIG.infoType);
            } else {
                log('✓ 找到第二个下拉框，点击中...');
                realClick(secondSelect);
                await sleep(150);
                var found2 = false;
                for (var a = 0; a < 10; a++) {
                    var opts = document.querySelectorAll('.el-select-dropdown__item:not(.is-disabled)');
                    for (var o = 0; o < opts.length; o++) {
                        if (opts[o].textContent.trim() === CONFIG.infoType) {
                            realClick(opts[o]);
                            found2 = true;
                            break;
                        }
                    }
                    if (found2) break;
                    await sleep(60);
                }
                if (found2) {
                    log('✓ 有害信息类型 → ' + CONFIG.infoType);
                } else {
                    log('⚠ 未找到选项"' + CONFIG.infoType + '"，当前选项：');
                    var allOpts2 = document.querySelectorAll('.el-select-dropdown__item');
                    for (var j2 = 0; j2 < allOpts2.length; j2++) {
                        log('  ' + allOpts2[j2].textContent.trim());
                    }
                }
                await sleep(80);
            }
        } else {
            log('✓ 该类型无第二级下拉，跳过');
            await sleep(80);
        }
        await sleep(CONFIG.delay);

        var siteName = record['网站名称*'] || record['网站名称'] || (site ? site.name : '');
        var nameInput = findInputNearLabel('网站名称');
        if (nameInput) {
            setNativeValue(nameInput, siteName);
            await sleep(50);
            log('✓ 网站名称 → ' + siteName);
        } else {
            log('⚠ 未找到网站名称输入框');
        }
        await sleep(80);

        var homepage = record['网站主页'] || (site ? site.homepage : '');
        var homeInput = findInputNearLabel('网站主页');
        if (homeInput) {
            setNativeValue(homeInput, homepage);
            await sleep(50);
            log('✓ 网站主页 → ' + homepage);
        } else {
            log('⚠ 未找到网站主页输入框');
        }
        await sleep(80);

        var linkInput = findInputNearLabel('详细网址')
            || findInputNearLabel('有害信息')
            || findInputNearLabel('链接')
            || findInputNearLabel('网址');
        if (linkInput) {
            setNativeValue(linkInput, link);
            await sleep(50);
            log('✓ 有害信息链接 → ' + link.substring(0, 40) + '...');
        } else {
            log('⚠ 未找到有害信息链接输入框');
        }
        await sleep(80);

        var content = record['举报内容*'] || record['举报内容'] || '';
        var contentInput = findInputNearLabel('举报内容', 'textarea')
            || findInputNearLabel('举报内容', 'input');
        if (contentInput) {
            setNativeValue(contentInput, content);
            await sleep(50);
            log('✓ 举报内容 → ' + content.substring(0, 40) + '...');
        } else {
            log('⚠ 未找到举报内容输入框');
        }

        if (isAutoConfirm) {
            log('⚡ 第 <b>' + (currentIdx + 1) + '</b> 条已填完，自动确认中...');
        } else {
            log('✋ 第 <b>' + (currentIdx + 1) + '</b> 条已填完，请检查后点击"确定"<br>提交后脚本会自动继续下一条');
        }
    }

    var KNOWN_HEADERS = ['举报渠道', '网站名称', '有害信息链接', '举报内容', '网站主页', '危害类型', '有害信息类型'];

    function isHeaderLine(line, delim) {
        var cells = line.split(delim).map(function (c) { return c.trim().replace(/^["']|["']$/g, ''); });
        for (var i = 0; i < cells.length; i++) {
            var c = cells[i];
            if (c.indexOf('*') > -1) return true;
            for (var j = 0; j < KNOWN_HEADERS.length; j++) {
                if (c.indexOf(KNOWN_HEADERS[j]) > -1) return true;
            }
        }
        return false;
    }

    function extractUrl(str) {
        var m = str.match(/https?:\/\/[^\s\u4e00-\u9fff]+/);
        if (m) return m[0];
        var keys = Object.keys(CONFIG.siteMap);
        for (var i = 0; i < keys.length; i++) {
            var idx = str.indexOf(keys[i]);
            if (idx > -1) {
                var start = idx;
                while (start > 0 && !/[\s\u4e00-\u9fff]/.test(str[start - 1])) start--;
                var end = idx + keys[i].length;
                while (end < str.length && !/[\s\u4e00-\u9fff]/.test(str[end])) end++;
                var url = str.substring(start, end);
                if (url.indexOf('http') !== 0) url = 'https://' + url;
                return url;
            }
        }
        return null;
    }

    function parseData(text) {
        var data = [];
        var lines = text.split(/[\r\n\u2028\u2029\u0085]+/);
        var currentTT = null;

        function finishTT() {
            if (currentTT && currentTT.url) {
                var site = detectSite(currentTT.url);
                var row = {};
                row['网站名称*'] = site ? site.name : '';
                row['网站主页'] = site ? site.homepage : '';
                row['有害信息链接*'] = currentTT.url;
                row['举报内容*'] = currentTT.content.trim();
                data.push(row);
                if (CONFIG.debug) console.log('[录入工具] ✓ 完成记录 #' + data.length + ' url=' + currentTT.url);
            } else if (currentTT) {
                if (CONFIG.debug) console.log('[录入工具] ⚠ 丢弃无URL记录: content=' + currentTT.content.substring(0, 40));
            }
        }

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (CONFIG.debug) console.log('[录入工具] 行' + i + ': "' + line.substring(0, 80) + '"');

            if (!line) {
                finishTT();
                currentTT = null;
                continue;
            }

            if (line.indexOf('标题：') === 0 || line.indexOf('标题:') === 0) {
                finishTT();
                var titleContent = line.replace(/^标题[：:]/, '').trim();
                var urlInTitle = extractUrl(titleContent);
                if (urlInTitle) {
                    currentTT = { content: titleContent.replace(urlInTitle, '').trim(), url: urlInTitle };
                } else {
                    currentTT = { content: titleContent, url: '' };
                }
                continue;
            }

            if (currentTT && !currentTT.url) {
                var url = extractUrl(line);
                if (url) {
                    currentTT.url = url;
                    continue;
                }
            }

            if (line.length < 10 && /.*[市区县]$/.test(line) && !extractUrl(line)) {
                if (CONFIG.debug) console.log('[录入工具] → 跳过地理位置行');
                continue;
            }

            if (line.indexOf('\t') > -1) {
                finishTT();
                currentTT = null;
                var vals = line.split('\t').map(function (v) { return v.trim(); });
                if (vals.length >= 2) {
                    var site = detectSite(vals[1] || '');
                    var row = {};
                    if (site) {
                        row['网站名称*'] = site.name;
                        row['网站主页'] = site.homepage;
                    } else {
                        row['网站名称*'] = vals[0] || '';
                    }
                    row['有害信息链接*'] = vals[1] || '';
                    row['举报内容*'] = (vals[2] || '');
                    if (vals.length > 3) row['举报内容*'] += ' ' + vals.slice(3).join(' ');
                    data.push(row);
                }
                continue;
            }

            if (currentTT) {
                currentTT.content += ' ' + line;
            }
        }

        finishTT();

        if (data.length > 0) {
            log('✓ 解析完成（混合格式），共 ' + data.length + ' 条');
            if (CONFIG.debug) {
                console.log('[录入工具] ===== 解析结果 =====');
                data.forEach(function (r, i) {
                    console.log('  [' + (i + 1) + '] 网站=' + (r['网站名称*'] || '-')
                        + ' | 链接=' + (r['有害信息链接*'] || '-')
                        + ' | 内容=' + (r['举报内容*'] || '-').substring(0, 40));
                });
            }
        }
        return data;
    }

    async function waitWhilePaused() {
        while (isPaused && isRunning) {
            await sleep(200);
        }
    }

    async function startFill() {
        if (records.length === 0) {
            var text = document.getElementById('xj-data').value;
            records = parseData(text);
        }
        if (records.length === 0) {
            log('⚠ 请先粘贴数据');
            return;
        }

        isRunning = true;
        isPaused = false;
        var btn = document.getElementById('xj-start');
        btn.disabled = false;
        btn.textContent = '⏸ 暂停';

        for (currentIdx = 0; currentIdx < records.length; currentIdx++) {
            if (!isRunning) break;
            await waitWhilePaused();
            if (!isRunning) break;

            updateProgress();

            var opened = await openDialog();
            if (!opened) {
                log('⚠ 对话框打开失败，请手动打开后继续');
                await sleep(60000);
                continue;
            }

            await waitWhilePaused();
            if (!isRunning) break;

            try {
                await fillOne(records[currentIdx]);
            } catch (e) {
                log('✗ 填写出错: ' + e.message + '，已跳过本条，继续下一条');
                console.error('[录入工具] 填写出错:', e);
            }

            await waitForDialogClose();
            log('✓ 第 ' + (currentIdx + 1) + '/' + records.length + ' 条完成');

            if (currentIdx < records.length - 1) {
                await sleep(500);
            }
        }

        if (isRunning) {
            log('🎉 全部完成！共填写 <b>' + records.length + '</b> 条');
        } else {
            log('⏹ 已停止');
        }
        isRunning = false;
        isPaused = false;
        btn.disabled = false;
        btn.textContent = '▶ 开始录入';
        currentIdx = 0;
        updateProgress();
    }

    function createPanel() {
        var panel = document.createElement('div');
        panel.id = 'xj-panel';
        panel.innerHTML = ''
            + '<div id="xj-header">📋 有害信息录入小工具 <span style="font-size:12px;color:#E8F5E9">v2.0</span></div>'
            + '<div id="xj-body">'
            + '  <div id="xj-tutorial" style="background:#F0FFF4;border:1px solid #B7E4C7;border-radius:4px;padding:8px 10px;margin-bottom:8px;font-size:12px;color:#2D6A4F;line-height:1.8">'
        + '    <div style="font-weight:bold;font-size:13px;margin-bottom:4px">使用步骤：</div>'
        + '    <div>① 粘贴数据到下方输入框</div>'
        + '    <div>② 点击「解析数据」核对录入数据条数</div>'
        + '    <div>③ 点击「开始录入」自动填写表单</div>'
        + '    <div style="margin-top:6px;padding-top:6px;border-top:1px dashed #B7E4C7;font-size:11px;color:#555;line-height:1.7">'
        + '      <div style="font-weight:bold;font-size:12px;color:#E76F51;margin-bottom:2px">注意事项：</div>'
        + '      <div>1. 粘贴格式：【历史虚无】直接复制Word全部内容，【低俗】复制表格"网站名称、链接、内容"三列</div>'
        + '      <div>2. 若需手动录入，解析数据后点击「自动模式」关闭，再点击开始录入</div>'
        + '      <div>3. 目前仅支持录入微博、今日头条平台的有害信息</div>'
        + '    </div>'
        + '  </div>'
            + '  <div id="xj-btns" style="display:flex;gap:5px;margin-bottom:6px;flex-wrap:wrap;flex-shrink:0">'
            + '    <button id="xj-parse">📋 解析数据</button>'
            + '    <button id="xj-start">▶ 开始录入</button>'
            + '    <button id="xj-auto" class="active" style="margin-left:auto">⚡ 自动模式: 开</button>'
            + '  </div>'
            + '  <div style="font-size:12px;color:#666;margin-bottom:4px;flex-shrink:0">📝 数据输入区（直接粘贴，自动识别格式）</div>'
            + '  <textarea id="xj-data" placeholder="微博: tab分隔3列（名称&#10;链接&#10;内容）&#10;&#10;头条: 标题：+链接+内容&#10;可直接全选粘贴混合数据"></textarea>'
            + '  <div id="xj-progress"></div>'
            + '  <div id="xj-log"></div>'
            + '</div>';

        panel.style.cssText = 'position:fixed;top:10px;width:360px;min-width:280px;min-height:200px;background:#fff;border:2px solid #52B788;'
            + 'border-radius:8px;box-shadow:0 4px 16px rgba(82,183,136,0.25);z-index:99999;font-size:13px;font-family:sans-serif;display:flex;flex-direction:column;overflow:hidden;';
        panel.style.left = (window.innerWidth - 380) + 'px';

        document.body.appendChild(panel);

        var style = document.createElement('style');
        style.textContent = ''
            + '#xj-panel {}\n'
            + '#xj-panel::-webkit-scrollbar { width:8px; }\n'
            + '#xj-panel::-webkit-scrollbar-thumb { background:#52B788;border-radius:4px; }\n'
            + '#xj-header { background:#52B788;color:#fff;padding:8px 12px;font-weight:bold;cursor:move;border-radius:6px 6px 0 0;flex-shrink:0; }\n'
            + '#xj-body { padding:10px;flex:1;display:flex;flex-direction:column;overflow:hidden; }\n'
            + '#xj-tutorial { flex-shrink:0; }\n'
            + '#xj-data { flex:1;width:100%;min-height:80px;margin-bottom:8px;font-size:13px;border:1px solid #B7E4C7;border-radius:4px;padding:6px;resize:none;box-sizing:border-box; }\n'
            + '#xj-parse, #xj-start { background:#52B788;color:#fff;border:none;padding:8px 12px;border-radius:4px;cursor:pointer;font-size:13px;font-weight:bold;white-space:nowrap; }\n'
            + '#xj-parse:hover, #xj-start:hover { background:#74C69D; }\n'
            + '#xj-auto { background:#E76F51;color:#fff;border:1px solid #D35C4F;padding:8px 12px;border-radius:4px;cursor:pointer;font-size:13px;font-weight:bold;white-space:nowrap; }\n'
            + '#xj-auto:hover { background:#D35C4F; }\n'
            + '#xj-auto.active { background:#52B788;color:#fff;border-color:#40916C; }\n'
            + '#xj-auto.active:hover { background:#40916C; }\n'
            + '#xj-progress { font-size:12px;color:#2D6A4F;margin:6px 0;flex-shrink:0; }\n'
            + '#xj-log { max-height:72px;overflow-y:auto;font-size:11px;color:#333;background:#F0FFF4;padding:6px;border-radius:4px;flex-shrink:0; }\n'
            + '#xj-log div { margin-bottom:2px;border-bottom:1px solid #D8F3DC;padding-bottom:2px; }';
        document.head.appendChild(style);

        var header = document.getElementById('xj-header');
        var isDragging = false, startX, startY, origX, origY;
        header.onmousedown = function (e) {
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            origX = parseInt(panel.style.left) || (window.innerWidth - 370);
            origY = parseInt(panel.style.top) || 10;
            document.onmousemove = function (e2) {
                if (!isDragging) return;
                panel.style.left = (origX + (e2.clientX - startX)) + 'px';
                panel.style.top = (origY + (e2.clientY - startY)) + 'px';
            };
            document.onmouseup = function () { isDragging = false; document.onmousemove = null; };
        };

        // 8-direction resize handles
        var dirs = [
            { d:'n', cur:'ns-resize', pos:'top:-4px;left:4px;right:4px;height:8px;' },
            { d:'s', cur:'ns-resize', pos:'bottom:-4px;left:4px;right:4px;height:8px;' },
            { d:'e', cur:'ew-resize', pos:'right:-4px;top:4px;bottom:4px;width:8px;' },
            { d:'w', cur:'ew-resize', pos:'left:-4px;top:4px;bottom:4px;width:8px;' },
            { d:'ne', cur:'nesw-resize', pos:'top:-4px;right:-4px;width:12px;height:12px;' },
            { d:'nw', cur:'nwse-resize', pos:'top:-4px;left:-4px;width:12px;height:12px;' },
            { d:'se', cur:'nwse-resize', pos:'bottom:-4px;right:-4px;width:12px;height:12px;' },
            { d:'sw', cur:'nesw-resize', pos:'bottom:-4px;left:-4px;width:12px;height:12px;' }
        ];
        dirs.forEach(function (item) {
            var h = document.createElement('div');
            h.style.cssText = 'position:absolute;z-index:100001;cursor:' + item.cur + ';' + item.pos;
            panel.appendChild(h);
            h.onmousedown = function (e) {
                e.preventDefault();
                e.stopPropagation();
                var smx = e.clientX, smy = e.clientY;
                var sl = parseInt(panel.style.left) || 0;
                var st = parseInt(panel.style.top) || 0;
                var sw = panel.offsetWidth, sh = panel.offsetHeight;
                var minW = 280, minH = 200;
                document.onmousemove = function (e2) {
                    var dx = e2.clientX - smx, dy = e2.clientY - smy;
                    var nw = sw, nh = sh, nl = sl, nt = st;
                    if (item.d.indexOf('e') > -1) nw = Math.max(minW, sw + dx);
                    if (item.d.indexOf('s') > -1) nh = Math.max(minH, sh + dy);
                    if (item.d.indexOf('w') > -1) { nw = Math.max(minW, sw - dx); nl = sl + (sw - nw); }
                    if (item.d.indexOf('n') > -1) { nh = Math.max(minH, sh - dy); nt = st + (sh - nh); }
                    panel.style.width = nw + 'px';
                    panel.style.height = nh + 'px';
                    panel.style.left = nl + 'px';
                    panel.style.top = nt + 'px';
                };
                document.onmouseup = function () { document.onmousemove = null; document.onmouseup = null; };
            };
        });

        document.getElementById('xj-parse').onclick = function () {
            var text2 = document.getElementById('xj-data').value;
            records = parseData(text2);
            if (records.length > 0) {
                log('✓ 解析成功！共 <b>' + records.length + '</b> 条，按F12打开控制台看详情');
                updateProgress();
                if (!isAutoConfirm) {
                    isAutoConfirm = true;
                    var autoBtn = document.getElementById('xj-auto');
                    autoBtn.textContent = '⚡ 自动模式: 开';
                    autoBtn.classList.add('active');
                    log('⚡ 自动模式已自动开启，填完后自动点击"确定"');
                }
                console.log('[录入工具] 解析结果（共' + records.length + '条）：');
                records.forEach(function (r, i) {
                    console.log('  [' + (i + 1) + '] 网站=' + (r['网站名称*'] || r['网站名称'] || '-')
                        + ' | 链接=' + (r['有害信息链接*'] || r['有害信息链接'] || '-').substring(0, 50)
                        + ' | 内容=' + (r['举报内容*'] || r['举报内容'] || '-').substring(0, 30));
                });
            } else {
                log('⚠ 未解析到数据，请检查格式<br>提示：粘贴 tab 分隔的3列数据，无需表头');
            }
        };

        document.getElementById('xj-start').onclick = function () {
            var btn = document.getElementById('xj-start');
            if (!isRunning) {
                startFill();
            } else if (isPaused) {
                isPaused = false;
                btn.textContent = '⏸ 暂停';
                log('▶ 已继续录入');
            } else {
                isPaused = true;
                btn.textContent = '▶ 继续录入';
                log('⏸ 已暂停，点击"继续录入"恢复');
            }
        };

        document.getElementById('xj-auto').onclick = function () {
            var btn = document.getElementById('xj-auto');
            isAutoConfirm = !isAutoConfirm;
            if (isAutoConfirm) {
                btn.textContent = '⚡ 自动模式: 开';
                btn.classList.add('active');
                log('⚡ 自动模式已开启，填完后自动点击"确定"');
            } else {
                btn.textContent = '✋ 自动模式: 关';
                btn.classList.remove('active');
                log('✋ 自动模式已关闭，需手动点击"确定"');
            }
        };
    }

    function updateProgress() {
        var el = document.getElementById('xj-progress');
        if (el) {
            var display = (isRunning || isPaused) ? (currentIdx + 1) : 0;
            el.innerHTML = '进度: ' + display + ' / ' + records.length;
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createPanel);
    } else {
        createPanel();
    }

})();
