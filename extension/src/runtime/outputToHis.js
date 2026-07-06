!function () {
    'use strict';
    function setTimeoutExec(functionRef, delay) {
        return new Promise((resolve, reject) => {
            window.setTimeout(() => {
                resolve(functionRef());
            }, delay);
        });
    }

    async function autoHandleDocs(patientName, processName) {
        document.getElementsByClassName('el-input el-input--mini el-input--suffix')[0].click(); //点击分页
        await setTimeoutExec(async () => {
            const docPager = document.querySelector('body > div.el-select-dropdown.el-popper > div.el-scrollbar > div.el-select-dropdown__wrap.el-scrollbar__wrap > ul').childNodes;
            docPager[docPager.length - 1].click();

            await setTimeoutExec(async () => {
                // const allSpanButtons = document.getElementsByClassName('el-table__fixed-body-wrapper')[0].querySelectorAll('span'); //找到页面中表格里的span元素
                // const allHisImportButtons = Array.from(allSpanButtons).filter(function (button) {
                //     return button.textContent.trim() === '导入HIS' && button.parentNode.classList.contains('is-disabled') === false; //找到“导入HIS”按钮
                // });
                // const hisImportButtons = Array.from(allHisImportButtons).filter(function (button) {
                //     return button.parentNode.parentNode.parentNode.previousElementSibling.textContent.trim() === '未导入';
                // });

                // hisImportButtons.forEach(function (button) {
                //     let docName = button.parentNode.parentNode.parentNode.parentNode.children[0].textContent.trim();
                //     button.parentNode.click(); //自动点击“导入HIS”
                //     console.error('病人：' + patientName + '，流程：' + processName + '，自动导入HIS：' + docName);
                // });
                const allDocs = document.getElementsByClassName('el-table__fixed-body-wrapper')[0].querySelectorAll('tr.el-table__row'); //找到页面中表格里的tr元素
                const targetDocs = Array.from(allDocs).filter(function (doc) {
                    return doc.children[0].textContent.trim().includes('导入HIS') && !doc.children[3].classList.contains('is-disabled'); //找到“导入HIS”按钮
                });

                targetDocs.forEach(function (doc) {
                    let docName = doc.children[0].textContent.trim();
                    doc.children[3].click(); //自动点击“导入HIS”
                    console.log('病人：' + patientName + '，流程：' + processName + '，自动导入HIS：' + docName);
                });

                await setTimeoutExec(() => { }, 1000 * targetDocs.length);
                await setTimeoutExec(() => { }, 1000);
            }, 1000);
        }, 1000);
    }

    async function autoHandlePatient(patientName) {
        const docTabLink = document.getElementById('tab-documentation');
        docTabLink.click();

        await setTimeoutExec(async () => {
            const docTabs = document.getElementsByClassName('document_con_menu_item');
            if (docTabs.length > 0) {
                for (let docIndex = 0; docIndex < docTabs.length; docIndex++) {
                    docTabs[docIndex].click();

                    const processName = docTabs[docIndex].textContent.trim();
                    await setTimeoutExec(async () => {
                        await autoHandleDocs(patientName, processName);
                    }, 1000);
                }
            } else {
                await setTimeoutExec(async () => {
                    await autoHandleDocs(patientName, '默认流程');
                }, 1000);
            }
        }, 1000);

        document.getElementsByClassName('icon icon-return-left')[0].click();
        await setTimeoutExec(() => { console.log('病人：' + patientName + '，处理完成') }, 5000);
    }

    async function autoHandlePatients() {
        const patientNodes = document.getElementsByClassName('el-table__body-wrapper')[0].getElementsByTagName('tr');
        for (let index = 0; index < patientNodes.length; index++) {
            const patient = patientNodes[index].getElementsByClassName('painet_table_info-box__wrapper clickable')[0];
            const name = patient.textContent.trim();
            console.log('病人：' + name + '，开始处理');
            patient.click();

            await setTimeoutExec(async () => {
                await autoHandlePatient(name);
            }, 3000);
        }
    }


    async function autoHandlePages() {
        const patientPageContainer = document.getElementsByClassName('mt-list-footer patient-list-footer')[0];
        const patientPageSizeButton = patientPageContainer.getElementsByClassName('el-input el-input--mini el-input--suffix')[0];
        patientPageSizeButton.click();

        //患者列表，切换成每页100个患者
        await setTimeoutExec(() => {
            patientPageSizeSelectors = document.querySelector('body > div.el-select-dropdown.el-popper > div.el-scrollbar > div.el-select-dropdown__wrap.el-scrollbar__wrap > ul').children;
            patientPageSizeSelectors[patientPageSizeSelectors.length - 2].click();
        }, 2000);

        const patientPager = document.getElementsByClassName('mt-list-footer patient-list-footer')[0].getElementsByClassName('el-pager')[0];
        const patientPageCount = patientPager.children.length;

        for (let patientPageIndex = 0; patientPageIndex < patientPageCount; patientPageIndex++) {
            if (patientPageIndex != 0) {
                patientPager.children[patientPageIndex].click();
            }
            console.log('处理第' + (patientPageIndex + 1) + '页数据')
            await setTimeoutExec(async () => {
                await autoHandlePatients();
            }, 2000);
        }
    }

    // autoHandlePages();

    // id_number,patient_visit_code,patient_treatflow_code
    let patientList = [["231688199006101751", "PATVIS4Ptr5HJc27XfuM1v1747978290", "PATTFLvnrslEVF5dOaqf3j1747993826"], ["334268198308149659", "PATVISWFGU2PIVrfNSB1ZD1748333606", "PATTFLPeYnVuILRTDk620y1748333606"]]
        , patient;

    while (patient = patientList.pop()) {
        window.location.replace(`https://192.168.10.92/#/flow-system/patient?id=${patient[0]}&pd=${patient[1]}&fc=${patient[2]}`);
        autoHandlePatient(patient[0]);
    };


}()