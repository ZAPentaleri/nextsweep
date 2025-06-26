/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/runtime', 'N/ui/dialog', './External/jszip.min.js', '../next-client',], (
    runtime, uiDialog, jsZip, nextClient,
) => {
    const PDF_DOWNLOAD_RETRY_COOLDOWN = 5000;
    const PDF_DOWNLOAD_CHECK_COOLDOWN = 1000;
    const PDF_DOWNLOAD_COOLDOWN = 50;
    const PDF_DOWNLOAD_RETRY_MAX = 5;
    const QUEUE_PAGE_SIZE = 100;
    const SEARCH_PREVIEW_PAGE_SIZE = 99;
    const RECORD_RENDER_PAGE_MAX = 2500;

    class RenderParameters {
        constructor(params={}) {
            Object.defineProperty(this, 'availableSearches',
                { value: Object.freeze(params.availableSearches), writable: false, enumerable: true, });
            Object.defineProperty(this, 'lookupSearches',
                { value: Object.freeze(params.lookupSearches), writable: false, enumerable: true, });
            Object.defineProperty(this, 'urlLookupSearches',
                { value: Object.freeze(params.urlLookupSearches), writable: false, enumerable: true, });
            Object.defineProperty(this, 'previewSearch',
                { value: params.previewSearch, writable: false, enumerable: true, });
            Object.defineProperty(this, 'folderPath',
                { value: params.folderPath, writable: false, enumerable: true, });
            Object.defineProperty(this, 'filesPerZip',
                { value: params.filesPerZip, writable: false, enumerable: true, });
            Object.defineProperty(this, 'listRefreshCooldown',
                { value: params.listRefreshCooldown, writable: false, enumerable: true, });
            Object.defineProperty(this, 'selectedPage',
                { value: params.selectedPage, writable: false, enumerable: true, });
        }
    }
    class RenderForm {
        #SearchOptions = null;

        constructor() {
            if (RenderForm.singleton) return RenderForm.singleton;

            this.searchInProgress   = false;
            this.renderInitiating   = false;
            this.renderInProgress   = false;
            this.downloadInProgress = false;
            this.stagedRender = null;
            this.taskPool      = {};

            return RenderForm.singleton = this;
        }
        static get() { return new RenderForm(); }

        async requestBackend(requestType, body) {
            return await nextClient.requestSuitelet({
                parameters: { 'nmprRequestType': requestType, },
                body: body ?? null,
            });
        }

        async downloadPdf(requestBody={}) {
            let lastFetchError;
            let attempt;
            for (attempt = 1; attempt < PDF_DOWNLOAD_RETRY_MAX; attempt++) {
                try {
                    return await this.requestBackend('download_file', requestBody);
                } catch (fetchError) {
                    lastFetchError = fetchError;
                    console.log(fetchError);
                    this.updateQueueStatusMessage(`Fetch error on attempt ${attempt}, retrying.`);
                    await new Promise(resolve => setTimeout(resolve, PDF_DOWNLOAD_RETRY_COOLDOWN));
                }
            }

            this.updateQueueStatusMessage(`Fetch error on attempt ${attempt}, aborting.`);
            await uiDialog.alert({ title: 'Download error',
                content: `File failed to download: ${JSON.stringify(requestBody)}`, });

            throw lastFetchError;
        }

        async cacheSearchOptions() {
            return this.#SearchOptions = Object.freeze(await this.requestBackend('get_search_list'));
        }

        updateSearchStatus(status) {
            document.querySelector('#nmpr-status-search').setAttribute('data-state', status);
        }

        updateSearchResultCount(count) {
            document.querySelector('#nmpr-label-record-count').innerText =
                Number.isInteger(count) ? `${count} records` : '';
        }

        updateQueueStatusMessage(message) {
            document.querySelector('#nmpr-widget-download-status').innerText = message;
        }

        updateRecordStatuses(statusNames, state, recordType=null, recordId=null) {
            let queries = [];
            for (const statusName of [].concat(statusNames)) {
                if (recordId === null) {
                    queries.push(`#nmpr-table-queue .nmpr-status-box.nmpr-${statusName}`);
                } else {
                    queries.push(`#nmpr-table-queue tr[data-type="${recordType}"][data-record="${recordId}"] `
                        + `.nmpr-status-box.nmpr-${statusName}`);
                }
            }

            document.querySelectorAll(queries.join(', ')).forEach(statusElem => {
                statusElem.setAttribute('data-state', state);
                for (const animation of statusElem.getAnimations()) {
                    animation.startTime = 0;
                }
            });
        }

        updateLoaderBars(loaderNames, percentComplete) {
            const percentageRounded = Math.round(10 * Math.min((100 * percentComplete), 100)) / 10
            const progressBarElems =
                document.querySelectorAll([].concat(loaderNames).map(name => `#nmpr-widget-${name}-bar`).join(', '));

            for (const progressBarElem of progressBarElems) {
                progressBarElem.setAttribute('style', `width:${percentageRounded}%;`,);
                progressBarElem.setAttribute(
                    'data-progressannotation',
                    percentageRounded !== 100 ? `${percentageRounded.toFixed(1)}%` : 'Complete.',
                );
            }
        }

        clearSearchTables() {
            const searchTableSelectElem = document.querySelector('#nmpr-select-search');
            const searchTableContainerElem = document.querySelector('#nmpr-pane-searches');
            const queuePageSelectElem = document.querySelector('#nmpr-select-queue-page');
            const queueTableBodyElem = document.querySelector('#nmpr-table-queue tbody');
            while (searchTableSelectElem.firstElementChild) searchTableSelectElem.lastElementChild.remove();
            while (searchTableContainerElem.firstElementChild) searchTableContainerElem.lastElementChild.remove();
            while (queuePageSelectElem.firstElementChild) queuePageSelectElem.lastElementChild.remove();
            while (queueTableBodyElem.firstElementChild !== queueTableBodyElem.lastElementChild)
                queueTableBodyElem.lastElementChild.remove();
        }

        async setParameters(parameters) {
            for (const param of Object.entries(parameters)) {
                switch (param[0]) {
                    case 'availableSearches': {
                        const addedSearchIds =
                            this.#SearchOptions.sortSearches.filter(sId => param[1].includes(sId));
                        const pseudoSelectElem = document.querySelector('#nmpr-pseudoselect-available-searches');
                        while (pseudoSelectElem.firstChild) pseudoSelectElem.firstChild.remove();
                        for (const searchID of addedSearchIds) {
                            const searchData = this.#SearchOptions.searches[searchID];
                            pseudoSelectElem.insertAdjacentHTML('beforeend',
                                `<div tabindex="0" class="nmpr-pseudoselect-option" data-search="${searchID}">${
                                    searchData.title} (${searchData.owner})</div>`,
                            );
                        }
                        break;
                    }
                    case 'lookupSearches': {
                        const selectedElem = document.querySelector('#nmpr-pseudoselect-selected-searches');
                        const currentSearchIds = this.parameters.lookupSearches;
                        const addedSearchIds = new Set(param[1].filter(sId =>
                            this.#SearchOptions.sortSearches.includes(sId) && !currentSearchIds.includes(sId)));
                        const removedSearchIds = currentSearchIds.filter(sId => !param[1].includes(sId));

                        for (const searchID of removedSearchIds)
                            selectedElem.querySelector(`[data-search="${searchID}"]`)?.remove();
                        for (const searchID of addedSearchIds) {
                            const searchData = this.#SearchOptions.searches[searchID];
                            selectedElem.insertAdjacentHTML('beforeend',
                                `<div tabindex="0" class="nmpr-pseudoselect-option" data-search="${searchID}">${
                                    searchData.title} (${searchData.owner})</div>`,
                            );
                        }
                        break;
                    }
                    case 'urlLookupSearches': {
                        const urlParams = new URLSearchParams(window.location.search);
                        const searchIDsString = param[1].join(',');
                        if (urlParams.get('nmprSearch') !== searchIDsString) {
                            urlParams.set('nmprSearch', searchIDsString);

                            const updatedURL = `${window.location.protocol}//${window.location.host}${
                                window.location.pathname}?${urlParams.toString()}`;

                            window.history.pushState({ path: updatedURL }, '', updatedURL,);
                        }
                        break;
                    }
                    case 'folderPath': {
                        document.querySelector('#nmpr-input-folder-path').value = param[1];
                        break;
                    }
                }
            }
        }

        async prepareFormData() {
            await this.cacheSearchOptions();
            console.log(this.#SearchOptions);

            const currentUser = runtime.getCurrentUser();
            await this.setParameters({
                'availableSearches': this.#SearchOptions.sortSearches,
                'lookupSearches':    this.parameters.urlLookupSearches,
                'folderPath':        `/Temp/NEXT_MASS_PDF/${currentUser.name.replace(/\s/g, '')}_${currentUser.id}`,
            });
        }

        get parameters() {
            return new RenderParameters({
                availableSearches: [
                    ...document.querySelectorAll('#nmpr-pseudoselect-available-searches .nmpr-pseudoselect-option')
                ].map(optionElem => optionElem.getAttribute('data-search')),
                lookupSearches: [
                    ...document.querySelectorAll('#nmpr-pseudoselect-selected-searches .nmpr-pseudoselect-option')
                ].map(optionElem => optionElem.getAttribute('data-search')),
                urlLookupSearches:   new URLSearchParams(window.location.search).get('nmprSearch')?.split?.(',') ?? [],
                previewSearch:       document.querySelector('#nmpr-select-search').value,
                folderPath:          document.querySelector('#nmpr-input-folder-path').value.trim(),
                filesPerZip:         Number(document.querySelector('#nmpr-select-zip-quantity').value),
                listRefreshCooldown: Number(document.querySelector('#nmpr-select-refresh-cooldown').value),
                selectedPage:        parseInt(document.querySelector('#nmpr-select-queue-page')),  // NaN if no page
            });
        }

        get SearchOptions() {
            if (this.#SearchOptions) return this.#SearchOptions;
            else throw new Error('Invalid SearchOptions cache')
        }
    }

    function getForm() { return RenderForm.get(); }

    /**
     * Function to be executed after page is initialized.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @param {string} scriptContext.mode - The mode in which the record is being accessed (create, copy, or edit)
     *
     * @since 2015.2
     */
    function pageInit(scriptContext) {
        console.log('Client script loaded');
        console.log(jsZip);

        getForm().prepareFormData().then(async () => {
            // add listeners
            for (const pSelectElem of document.querySelectorAll('.nmpr-pseudoselect')) {
                pSelectElem.addEventListener('keyup', async keyEvent => {
                    if (['Enter', ' '].includes(keyEvent.key)
                        && keyEvent.target.classList.contains('nmpr-pseudoselect-option')
                    ) keyEvent.target.dispatchEvent(new Event('click', { bubbles: true, },));
                },);
                pSelectElem.addEventListener('click', async clickEvent => {
                    if (clickEvent.target.classList.contains('nmpr-pseudoselect-option')) {
                        const targetSearchId = clickEvent.target.getAttribute('data-search');
                        switch (clickEvent.target.parentElement.id) {
                            case 'nmpr-pseudoselect-selected-searches': {
                                await getForm().setParameters({
                                    lookupSearches: getForm().parameters.lookupSearches.filter(searchId =>
                                        searchId !== targetSearchId),
                                });
                                break;
                            }
                            case 'nmpr-pseudoselect-available-searches': {
                                await getForm().setParameters({
                                    lookupSearches: getForm().parameters.lookupSearches.concat(targetSearchId),
                                });
                                break;
                            }
                            default: throw new Error('Unhandled pseudoselect');
                        }
                    }
                },);
            }
            document.querySelector('#nmpr-button-queue-back').addEventListener(
                'click',
                async () => {
                    const selectElem = document.querySelector('#nmpr-select-queue-page');
                    const firstValue = document.querySelector('#nmpr-select-queue-page option:first-child').value;
                    if (selectElem.value !== firstValue) {
                        selectElem.value = (parseInt(selectElem.value, 10) - 1).toString();
                        selectElem.dispatchEvent(new Event('change'));
                    }
                },
            );
            document.querySelector('#nmpr-button-queue-forward').addEventListener(
                'click',
                async () => {
                    const selectElem = document.querySelector('#nmpr-select-queue-page');
                    const lastValue = document.querySelector('#nmpr-select-queue-page option:last-child').value;
                    if (selectElem.value !== lastValue) {
                        selectElem.value = (parseInt(selectElem.value, 10) + 1).toString();
                        selectElem.dispatchEvent(new Event('change'));
                    }
                },
            );

            document.querySelector('#nmpr-select-search').addEventListener(
                'change',
                async changeEvent => {
                    const searchID = changeEvent.target.value;

                    const unselectedTableQuery = document.querySelectorAll(
                        `#nmpr-pane-searches .nmpr-table-search:not([data-search="${searchID}"])`);
                    const selectedTableElem = document.querySelector(
                        `#nmpr-pane-searches .nmpr-table-search[data-search="${searchID}"]`);

                    for (const unselectedTableElem of unselectedTableQuery)
                        unselectedTableElem.setAttribute('data-hidden', 'hidden');

                    selectedTableElem.setAttribute('data-hidden', '');
                },
            );
            document.querySelector('#nmpr-select-queue-page').addEventListener(
                'change',
                async changeEvent => {
                    const pageIndex = changeEvent.target.value;

                    const hiddenRowQuery =
                        document.querySelectorAll(`#nmpr-table-queue tbody tr:not([data-page="${pageIndex}"])`);
                    const visibleRowQuery =
                        document.querySelectorAll(`#nmpr-table-queue tbody tr[data-page="${pageIndex}"]`);

                    for (const hiddenRowElem of hiddenRowQuery) hiddenRowElem.setAttribute('data-hidden', 'hidden');
                    for (const visibleRowElem of visibleRowQuery) visibleRowElem.setAttribute('data-hidden', '');
                },
            );

            document.querySelector('#nmpr-button-search').addEventListener('click', submitQuery,);
            document.querySelector('#nmpr-button-render-queue').addEventListener('click', renderPdfs,);
            document.querySelector('#nmpr-button-download-queue').addEventListener('click', downloadPdfs,);

            // ready form for submission
            document.querySelector('#nmpr-button-search').disabled = false;
            document.querySelector('#nmpr-button-search').focus();
        });
    }

    async function submitQuery() {
        const searchIDs = getForm().parameters.lookupSearches;

        if (searchIDs.length === 0) return;
        if ( getForm().searchInProgress || getForm().renderInProgress || getForm().downloadInProgress) {
            await uiDialog.alert({ title: 'Lookup error', message: 'Blocking operation is in progress.', });

            return;
        }

        getForm().searchInProgress = true;
        getForm().stagedRender = null;
        getForm().updateLoaderBars(['render', 'cache', 'download',], 0,);
        getForm().updateSearchStatus('pending');
        getForm().updateQueueStatusMessage('Loading search results...');
        getForm().updateSearchResultCount();
        getForm().clearSearchTables();

        await getForm().setParameters({ 'urlLookupSearches': searchIDs, });

        // get search results, stage
        const recordResponse = await getForm().requestBackend('get_search_results', { searchIds: searchIDs, },);
        console.log(recordResponse);

        if (recordResponse.sortRecords.length === 0) {
            await uiDialog.alert({ title: 'Lookup error', message: 'Matching records were not found.', });

            getForm().updateSearchStatus('ready');
            getForm().searchInProgress = false;

            return;
        }

        getForm().stagedRender = { ...recordResponse,
            folderPath: null,
            taskRecordId: null,
            records: Object.fromEntries(Object.entries(recordResponse.records).map(recordEntry =>
                [recordEntry[0], { ...recordEntry[1], rendered: false, cached: false, downloaded: false, },])),
        };
        console.log(getForm().stagedRender);

        // populate search data tables
        for (let searchIndex = 0; searchIndex < getForm().stagedRender.sortResults.length; searchIndex++) {
            const searchID = getForm().stagedRender.sortResults[searchIndex];
            const searchColumns = getForm().stagedRender.results[searchID].columns;
            const searchRows = getForm().stagedRender.results[searchID].rows;

            document.querySelector('#nmpr-select-search').insertAdjacentHTML('beforeend',
                `<option value="${searchID}">${getForm().stagedRender.results[searchID].title}</option>`,);

            document.querySelector('#nmpr-pane-searches').insertAdjacentHTML('beforeend',
                `<table class="nmpr-data-table nmpr-table-search" data-search="${searchID}" data-hidden="${
                searchIndex > 0 ? 'hidden' : ''}"><thead><tr></tr></thead><tbody></tbody></table>`,);

            const searchTableHeaderRowElem =
                document.querySelector(`table.nmpr-table-search[data-search="${searchID}"] thead tr`);
            const searchTableBodyElem =
                document.querySelector(`table.nmpr-table-search[data-search="${searchID}"] tbody`);

            for (const searchColumn of searchColumns) {
                searchTableHeaderRowElem.insertAdjacentHTML('beforeend',
                    `<th title="${searchColumn.name}">${nextClient.escapeHtml(searchColumn.label)}</th>`
                );
            }
            for (let rowIndex = 0; rowIndex < Math.min(searchRows.length, SEARCH_PREVIEW_PAGE_SIZE); rowIndex++) {
                searchTableBodyElem.insertAdjacentHTML('beforeend',
                    `<tr>${ searchRows[rowIndex].map(searchCell =>
                        `<td title="${nextClient.escapeHtml(searchCell.value)}">${
                        nextClient.escapeHtml(searchCell.text || searchCell.value)}</td>`
                    ).join('') }</tr>`,
                );
            }

            if (searchRows.length > SEARCH_PREVIEW_PAGE_SIZE) {
                searchTableBodyElem.insertAdjacentHTML('beforeend',
                    `<tr class="nmpr-truncation"><td colspan="${searchColumns.length}"><span>${
                    searchRows.length - SEARCH_PREVIEW_PAGE_SIZE} rows have been omitted. (${
                    SEARCH_PREVIEW_PAGE_SIZE} shown)</span></td></tr>`,
                );
            }
        }

        // populate queue table
        const queueTableBodyElem = document.querySelector('#nmpr-table-queue tbody');
        const totalRecords = getForm().stagedRender.sortRecords.length;
        for (let recordIndex = 0; recordIndex < totalRecords; recordIndex++) {
            const recordData = getForm().stagedRender.records[getForm().stagedRender.sortRecords[recordIndex]];
            const queuePageIndex = Math.floor(recordIndex / QUEUE_PAGE_SIZE);
            queueTableBodyElem.insertAdjacentHTML('beforeend',
                `<tr data-type="transaction" data-record="${recordData.id}" data-page="${
                    queuePageIndex}" data-hidden="${queuePageIndex > 0 ? 'hidden' : ''}">
                    <td>${recordData.type}</td>
                    <td title="Internal ID: ${recordData.id}">${nextClient.escapeHtml(recordData.number ?? 'NULL')}</td>
                    <td title="Internal ID: ${recordData.entityId}">
                        ${nextClient.escapeHtml(recordData.entity ?? 'NULL')}</td>
                    <td>${recordData.date}</td>
                    <td>${recordData.fileName}</td>
                    <td><span class="nmpr-status-box nmpr-rendered" data-state="staged"></span></td>
                    <td><span class="nmpr-status-box nmpr-cached" data-state="staged"></span></td>
                    <td><span class="nmpr-status-box nmpr-downloaded" data-state="staged"></span></td>
                </tr>`,
            );
        }

        // populate queue table page select
        for (let qpi = 0; qpi < Math.ceil(totalRecords / QUEUE_PAGE_SIZE); qpi++) {
            document.querySelector('#nmpr-select-queue-page').insertAdjacentHTML('beforeend',
                `<option value="${qpi}">Page ${qpi + 1} (${(qpi * QUEUE_PAGE_SIZE) + 1}&ndash;${//qpi = queue page index
                    Math.min((qpi + 1) * QUEUE_PAGE_SIZE, totalRecords)
                })</option>`,
            );
        }

        getForm().updateSearchStatus('ready');
        getForm().updateQueueStatusMessage('Records staged.');
        getForm().updateSearchResultCount(totalRecords);
        getForm().searchInProgress = false;
    }

    async function renderPdfs() {
        getForm().renderInitiating = true;

        const PENDING_STATUSES = Object.freeze([
            'next_ats_new', 'next_ats_queued', 'next_ats_processing', 'next_ats_retrying',]);
        const FAILED_STATUSES = Object.freeze(['next_ats_failed', 'next_ats_cancelled',]);

        // validation
        if (getForm().stagedRender === null) return;
        if (getForm().searchInProgress || getForm().renderInProgress || getForm().downloadInProgress) {
            await uiDialog.alert({title: 'Render error', message: 'Blocking operation is in progress.',});
            getForm().renderInitiating = false;
            return;
        }

        getForm().stagedRender.folderPath = getForm().parameters.folderPath;
        if (getForm().stagedRender.folderPath === '') {
            await uiDialog.alert({title: 'Render error', message: 'Folder path is invalid.',});
            getForm().renderInitiating = false;
            return;
        }

        const renderConfirmed = await uiDialog.confirm({
            title: 'Confirm render',
            message: `Are you sure you want to render ${getForm().stagedRender.sortRecords.length} staged records?`,
        });
        if (!renderConfirmed) {
            getForm().renderInitiating = false;
            return;
        }

        // request wake lock, then set statuses
        const wakelock = await navigator.wakeLock.request();
        getForm().renderInitiating = false;
        getForm().renderInProgress = true;
        getForm().updateLoaderBars('render', 0,);
        getForm().updateRecordStatuses('rendered', 'pending',);

        // collate staged records, process into render parameters
        const stagedRecordMap = getForm().stagedRender.sortRecords.map(recordID =>
            getForm().stagedRender.records[recordID]
        ).map(recordData => ({ type: 'transaction', id: recordData.id, name: recordData.fileName, }));

        // dispatch record renders by page
        for (let recordIndex = 0; recordIndex < stagedRecordMap.length; recordIndex += RECORD_RENDER_PAGE_MAX) {
            getForm().updateQueueStatusMessage(`Rendering records ${recordIndex + 1} through ${
                Math.min(recordIndex + RECORD_RENDER_PAGE_MAX, stagedRecordMap.length)}...`);

            const recordMapSlice = stagedRecordMap.slice(recordIndex, recordIndex + RECORD_RENDER_PAGE_MAX);
            const renderResponse = await getForm().requestBackend('render_pdfs',
                { folderPath: getForm().stagedRender.folderPath, records: recordMapSlice, },);
            console.log(renderResponse);

            getForm().taskPool[renderResponse.recordId] = null;
        }

        // iterate tasks as long as some are pending
        const displayedRecords = [];
        while (Object.values(getForm().taskPool).some(task => !task?.status || PENDING_STATUSES.includes(task.status))){
            // wait cooldown, then collate pending task IDs
            await new Promise(resolve => setTimeout(resolve, getForm().parameters.listRefreshCooldown));
            const pendingTaskIds = Object.keys(getForm().taskPool).filter(recordId =>
                !getForm().taskPool[recordId]?.status
                    || PENDING_STATUSES.includes(getForm().taskPool[recordId].status));

            // check all pending tasks
            for (const pendingTaskRecordId of pendingTaskIds) {
                // try to get task status
                try {
                    getForm().taskPool[pendingTaskRecordId] =
                        await getForm().requestBackend('check_render_status', { id: pendingTaskRecordId, },);
                } catch (checkError) {
                    console.log(checkError);
                }
                const renderResult = getForm().taskPool[pendingTaskRecordId];
                if (renderResult === null) continue;

                // collate failed and newly rendered records
                const failedRecords = FAILED_STATUSES.includes(renderResult.status)
                    ? renderResult.staged.filter(stageRec => !renderResult.rendered.some(renderRec =>
                        stageRec.type === renderRec.type && stageRec.id === renderRec.id))
                    : [];  // gets all records that are staged but not rendered if status is fail
                const newRenderedRecords = renderResult.rendered.filter(renderRec => !displayedRecords.some(displayRec=>
                        renderRec.type === displayRec.type && renderRec.id === displayRec.id));
                                                             // ^^^ gets all records that are rendered but not displayed
                // update statuses for failed/rendered records
                for (const recordData of newRenderedRecords) {
                    getForm().stagedRender.records[recordData.id].rendered = true;
                    getForm().stagedRender.records[recordData.id].taskRecordId = pendingTaskRecordId;
                    getForm().updateRecordStatuses('rendered', 'complete', 'transaction', recordData.id,);
                }
                for (const recordData of failedRecords) {
                    getForm().updateRecordStatuses('rendered', 'failed', 'transaction', recordData.id,);
                }

                // update render loading bar
                getForm().updateLoaderBars('render', (Object.values(getForm().stagedRender.records).filter(
                    recordData => recordData.rendered
                ).length / getForm().stagedRender.sortRecords.length),);

                // push newly rendered records to displayed records array
                displayedRecords.push(...newRenderedRecords);
            }
        }

        getForm().renderInProgress = false;
        await wakelock?.release();
        console.log('Done rendering');
    }

    async function downloadPdfs() {
        if (getForm().stagedRender === null) return;
        if (getForm().searchInProgress || getForm().downloadInProgress)
            return await uiDialog.alert({ title: 'Download error', message: 'Blocking operation is in progress.', });

        const stagedRecords = getForm().stagedRender.sortRecords.map(recId => getForm().stagedRender.records[recId]);
        if (!getForm().renderInProgress && stagedRecords.some(recordData => !recordData.rendered)) {
            renderPdfs();
            do { await new Promise(resolve => setTimeout(resolve, 250)); } while (getForm().renderInitiating)
        }

        const wakelock = await navigator.wakeLock.request();
        getForm().downloadInProgress = true;
        getForm().updateLoaderBars(['cache', 'download',], 0,);
        getForm().updateRecordStatuses(['cached', 'downloaded',], 'pending',);

        try {
            const currentDateNameSafe = dateToFileNameString(new Date(), true);
            const downloadedStartIndices = [];
            while (stagedRecords.some(recordData => !recordData.downloaded)) {
                const recordZipMax = getForm().parameters.filesPerZip;

                // iterate groups ("pages") of files to be zipped; not necessarily aligned with displayed pages
                for (let zipStartIndex = 0; zipStartIndex < stagedRecords.length; zipStartIndex += recordZipMax) {
                    if (downloadedStartIndices.includes(zipStartIndex)) continue;  // ensure no duplicate downloads

                    // collate page of records
                    const stagedRecordsPage = stagedRecords.slice(zipStartIndex, zipStartIndex + recordZipMax);

                    // ensure page is entirely rendered
                    if (stagedRecordsPage.some(recordData => !recordData.rendered)) {
                        if (getForm().renderInProgress) continue;
                        else throw new Error('Some files unavailable');
                    }

                    // download and map PDF blobs by file name
                    const pdfBlobMap = [];
                    for (const recordData of stagedRecordsPage) {
                        await new Promise(resolve => setTimeout(resolve, PDF_DOWNLOAD_COOLDOWN));
                        const pdfBlob = await getForm().downloadPdf({
                            taskRecordId: recordData.taskRecordId,
                            renderedType: 'transaction',
                            renderedId:   recordData.id,
                        });

                        getForm().stagedRender.records[recordData.id].cached = true;
                        getForm().updateRecordStatuses('cached', 'complete', 'transaction', recordData.id,);
                        getForm().updateLoaderBars('cache', (Object.values(getForm().stagedRender.records).filter(
                            recordData => recordData.cached
                        ).length / getForm().stagedRender.sortRecords.length),);

                        pdfBlobMap.push({ fileName: recordData.fileName, blob: pdfBlob, });
                    }

                    // create zip object URL from multiple PDF blobs
                    const zipStartNumber = zipStartIndex + 1;
                    const zipEndNumber = Math.min((zipStartIndex + recordZipMax), stagedRecords.length);
                    const zipName = `PDF Archive ${currentDateNameSafe} (Files ${zipStartNumber}-${zipEndNumber})`;
                    const zipFile = new jsZip();
                    const zipFolder = zipFile.folder(zipName);
                    for (const blobMapping of pdfBlobMap) zipFolder.file(blobMapping.fileName, blobMapping.blob);
                    const zipObjectURL = await zipFile.generateAsync({type: 'blob',}).then(zipBlob =>
                        URL.createObjectURL(zipBlob));

                    // download zip file
                    const downloadAnchor = document.createElement('a');
                    downloadAnchor.style = 'display:none;';
                    downloadAnchor.href = zipObjectURL;
                    downloadAnchor.download = `${zipName}.zip`;
                    downloadAnchor.click();
                    setTimeout(() => {
                        downloadAnchor.remove();
                        window.URL.revokeObjectURL(zipObjectURL);
                    }, 10000);  // explicitly release URL for garbage collection after 10sec delay to avoid memory leaks

                    // flag records as downloaded
                    for (const recordData of stagedRecordsPage) {
                        getForm().stagedRender.records[recordData.id].downloaded = true;
                        getForm().updateRecordStatuses('downloaded', 'complete', 'transaction', recordData.id,);
                        getForm().updateLoaderBars('download', Object.values(getForm().stagedRender.records).filter(
                            recordData => recordData.downloaded
                        ).length / getForm().stagedRender.sortRecords.length,);
                    }

                    downloadedStartIndices.push(zipStartIndex);

                    getForm().updateQueueStatusMessage(
                        `Done downloading zip of files ${zipStartNumber}-${zipEndNumber}.`);
                }

                await new Promise(resolve => setTimeout(resolve, PDF_DOWNLOAD_CHECK_COOLDOWN));
            }
        } catch (downloadError) {
            console.log(downloadError);
            await uiDialog.alert({ title: 'Download error',
                message: `Some requested PDFs could not be retrieved at download time: ${
                    stagedRecords.filter(recordData => !recordData.rendered).map(recordData =>
                        recordData.fileName).join(', ')}`,
            });
            getForm().updateQueueStatusMessage('An error occurred during download; please try again.');
        }

        getForm().downloadInProgress = false;
        await wakelock?.release();
    }

    function dateToFileNameString(inputDate, includeTime=false) {
        const padNum = num => num.toString().padStart(2, '0');
        if (includeTime) {
            return `${inputDate.getFullYear()}-${padNum(inputDate.getMonth() + 1)}-${padNum(inputDate.getDate())}_`
                + `${padNum(inputDate.getHours())}${padNum(inputDate.getMinutes())}${padNum(inputDate.getSeconds())}`;
        } else {
            return `${inputDate.getFullYear()}-${padNum((inputDate.getMonth() + 1))}-${padNum(inputDate.getDate())}`;
        }
    }

    return { pageInit, };
},
);
