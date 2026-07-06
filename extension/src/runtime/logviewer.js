!function () {
    "use strict";
    // This script is injected into the log viewer page to convert unicode escape sequences to readable characters
    // "[2025-05-13 08:04:14 PM]---get_3d_part_patient_info error:\u7597\u7a0bPATTFL1D57MuUcAO0EsQjb1747137851\u7684machine_system\u4e3a\u7a7a";
    const logs = JSON.parse(document.body.textContent).data.split('\n')
        , unicodeToString = (str) => {
            return str.replace(/\\u[\dA-F]{4}/gi, function (match) {
                return String.fromCharCode(parseInt(match.replace("\\u", ""), 16));
            });
        }
        , h = (t, a, c) => {
            const e = document.createElement(t);
            if (typeof a === 'object' && Object.keys(a).length > 0) {
                for (const k in a) {
                    if (a.hasOwnProperty(k)) {
                        if (typeof a[k] === 'object') {
                            for (const i in a[k]) {
                                if (a[k].hasOwnProperty(i)) {
                                    e[k][i] = a[k][i]
                                }
                            }
                        } else {
                            e[k] = a[k]
                        }
                    }
                }
                if (Array.isArray(c) && c.length > 0) {
                    for (const i of c) {
                        e.appendChild(i)
                    }
                }
                return e
            }
        };
    var $body = document.body
        , $head = document.head;
    $head.appendChild(h('style', {
        type: 'text/css',
        innerHTML: `
    body {
    font-family: "Microsoft YaHei", Arial, sans-serif;
    background-color: #f5f5f5;
    margin: 0;
    padding: 20px;
    color: #333;
}

.log-item {
    background-color: #fff;
    border-radius: 6px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
    margin-bottom: 15px;
    overflow: hidden;
}

.log-row {
    display: flex;
    width: 100%;
}

.log-date {
    padding: 12px 15px;
    background-color: #f5f5f5;
    border-right: 1px solid #e0e0e0;
    color: #555;
}

.log-interface {
    flex: 0.4;
    padding: 12px 15px;
    background-color: #f9f9f9;
    border-right: 1px solid #e0e0e0;
    color: #2c3e50;
}

.log-status {
    flex: 0.1;
    padding: 12px 15px;
    text-align: center;
    font-weight: bold;
    color: white;
    border-right: 1px solid #e0e0e0;
    background-color:rgb(66, 66, 66);
}

.status-error {
    background-color: #e74c3c;
}

.status-success {
    background-color: #2ecc71;
}

.status-warning {
    background-color: #f39c12;
}

.status-info {
    background-color: #3498db;
}

.log-message {
    flex: 2;
    padding: 12px 15px;
    background-color: #fafafa;
}`
    })),
        $body.innerHTML = '';
    for (let i = logs.length - 1; i >= 0; i--) {
        var lastLog = logs[i];
        if (lastLog.length === 0 || lastLog.trim() === '') continue;
        const logString = unicodeToString(lastLog)
            , regex = /\[(.*?)\]---(.*) (.*?):(.*)/
            , match = logString.match(regex);

        if (match) {
            const date = match[1];      // {1} 日期和时间
            const interfaceName = match[2]; // {2} 接口名称
            const status = match[3];    // {3} 状态
            const message = match[4];   // {4} 返回信息
            const logElement = h('div', {
                className: 'log-item',
                style: 'margin: 5px; padding: 5px; border: 1px solid #ccc; background-color: #f9f9f9;'
            }, [h('div', { className: "log-row" }, [h('span', {
                className: 'log-date',
                innerText: date
            }), h('span', {
                className: 'log-interface',
                innerText: interfaceName
            }), h('span', {
                className: `log-status status-${status.toLowerCase()}`,
                innerText: status
            }), h('span', {
                className: 'log-message',
                innerText: message
            })])]);
            // <div class="log-date">2025-05-13 07:59:07 PM</div>
            // <div class="log-interface">update_3d_part_treat_flow</div>
            // <div class="log-status status-error">error</div>
            // <div class="log-message">疗程PATTFLPXCWaSHzLUy5hnmk1747099154的machine_system为空</div>
            // </div>
            $body.appendChild(logElement);
        } else {
            const logElement = h('div', {
                className: 'log-item',
                style: 'margin: 5px; padding: 5px; border: 1px solid #ccc; background-color: #f9f9f9;'
            }, [h('div', { className: "log-row" }, [h('span', {
                className: 'log-message',
                innerText: logString
            })])]);
            $body.appendChild(logElement);
        }
    }
}()