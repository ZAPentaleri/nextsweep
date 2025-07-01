/**
 *    __________ _ _____    ___
 *    \____   // ||   _  \  \  \
 *       /  //   ||  | \  \ |  |____       ___ __
 *     /  //  /  ||  |_/  //  // ___\___  / __\ |_
 *   /  //__/ |  ||   __//__/  \__ \/ . \|  _||  _|
 * /_________\|__||__| /__/   /____/\___/|_|  \__\
 *
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/error', 'N/https', 'N/log', 'N/search', 'N/task', 'N/ui/serverWidget', '../next-file', '../next-list',
    '../next-task',], (
    error, https, log, search, task, uiServerWidget, nextFile, nextList, nextTask
) => {
    const SEARCH_PAGE_SIZE = 1000;
    const RECORD_SEARCH_COMBINE_MAX = 5;  // max searches to combine
    const RECORD_SEARCH_LINE_MAX = 10000;  // to prevent the searches timing out

    const STANDALONE_SEARCH_TYPE_MAP = {
        'Competitor': 'Competitor',
        'Contact': 'Contact',
        'Customer': 'Customer',
        'Employee': 'Employee',
        'Entity': 'Entity',
        'Generic Resource': 'GenericResource',
        'Partner': 'Partner',
        'Project': 'Job',
        'Transaction': 'Transaction',
        'Vendor': 'Vendor',
    };

    function onRequest(scriptContext) {
        if ( scriptContext.request.method === 'GET' ) {
            // create form
            let renderForm = uiServerWidget.createForm({ title: 'NextSweep >> Mass PDF Utility', });

            // create fields
            let interfaceField = renderForm.addField({
                id: 'interface_container',
                type: uiServerWidget.FieldType.INLINEHTML,
                label: 'Main',
            });
            interfaceField.defaultValue = `<style>${nextFile.load({
                path: 'SuiteScripts/NextSweep/Applications/Resources/next-base.css',
            }).getContents()}</style>${nextFile.load({
                path: 'SuiteScripts/NextSweep/Applications/Resources/next-mass-pdf-render-main.html',
            }).getContents()}`;

            // add client script
            renderForm.clientScriptModulePath = './next-mass-pdf-render-client.js';

            // return response
            scriptContext.response.writePage(renderForm);
        } else {
            const requestType = scriptContext.request.parameters.nmprRequestType || null;
            const requestBody = JSON.parse( scriptContext.request.body || null );

            switch (requestType) {
                case 'get_statuses': {
                    scriptContext.response.setHeader({ name: 'Content-Type', value: 'application/json', });
                    scriptContext.response.write({
                        output: JSON.stringify(nextList.load({ id: 'customlist_next_async_task_status', })), });

                    break;
                }
                case 'get_search_list': {
                    scriptContext.response.setHeader({ name: 'Content-Type', value: 'application/json', });
                    scriptContext.response.write({ output: JSON.stringify(getBulkPDFSearches()), });

                    break;
                }
                case 'get_search_results': {
                    const inputSearchIDs = Object.freeze(requestBody?.searchIds).slice(0, RECORD_SEARCH_COMBINE_MAX);
                    log.debug({ title: 'inputSearchIDs', details: JSON.stringify(inputSearchIDs), });

                    const responseObj = {
                        records: {},
                        results: {},

                        sortRecords: [],
                        sortResults: [],
                    };

                    const searchDataMap = getBulkPDFSearches(inputSearchIDs).searches;

                    log.debug({ title: 'searchDataMap', details: JSON.stringify(searchDataMap), });

                    // check if all requested searches were located
                    if (
                        Object.keys(searchDataMap).length !== inputSearchIDs.length
                        || !Object.keys(searchDataMap).every(searchId => inputSearchIDs.includes(searchId))
                    ) throw new Error('Requested searches could not all be located.');

                    const recordIDs = {};
                    for ( const searchID of inputSearchIDs ) {
                        responseObj.results[searchID] = {
                            ...searchDataMap[searchID],
                            columns: [{ name: 'internalid', label: 'Internal ID', },],
                            rows: [],
                        };

                        responseObj.sortResults.push(searchID);

                        const requestedSearch =
                            search.load({ type: responseObj.results[searchID].searchType, id: searchID, });

                        const requestedSearchData = requestedSearch.runPaged({ pageSize: SEARCH_PAGE_SIZE, });
                        const requestedSearchResults = requestedSearchData.pageRanges.slice(
                            0, Math.ceil(RECORD_SEARCH_LINE_MAX / SEARCH_PAGE_SIZE)
                        ).flatMap(page => requestedSearchData.fetch({ index: page.index, }).data);

                        for (const recordColumn of requestedSearch.columns) {
                            responseObj.results[searchID].columns.push(
                                { name: recordColumn.name, label: recordColumn.label, }
                            );
                        }
                        for (const recordResult of requestedSearchResults) {
                            responseObj.results[searchID].rows.push([
                                { value: recordResult.id ?? '', text: '', },
                                ...recordResult.columns.map(column => ({
                                    value: recordResult.getValue(column),
                                    text:  recordResult.getText(column),
                                })),
                            ]);

                            if (!recordIDs.hasOwnProperty(responseObj.results[searchID].searchType)) {
                                recordIDs[responseObj.results[searchID].searchType] = new Set();
                            }

                            recordIDs[responseObj.results[searchID].searchType].add(recordResult.id);
                        }
                    }

                    const colType   = search.createColumn({ name: 'type', sort: search.Sort.ASC, });
                    const colId     = search.createColumn({ name: 'internalid', sort: search.Sort.ASC, });
                    const colNumber = search.createColumn({ name: 'tranid', });
                    const colDate   = search.createColumn({ name: 'trandate', });
                    const colEntity = search.createColumn({ name: 'entity', });
                    const transSearchData = search.create({
                        type: search.Type.TRANSACTION,
                        filters: [
                            [
                                'internalid',
                                'anyof',
                                ...(recordIDs?.[search.Type.TRANSACTION] ?? []),
                                '-999999999999999',  // dummy value
                            ],
                            'AND',
                            [ 'mainline', 'is', true, ],
                        ],
                        columns: [colType, colId, colNumber, colDate, colEntity,],
                    }).runPaged({ pageSize: SEARCH_PAGE_SIZE, });

                    const transSearchResults = recordIDs?.[search.Type.TRANSACTION].size > 0
                        ? transSearchData.pageRanges.slice(
                            0, Math.ceil(RECORD_SEARCH_LINE_MAX / SEARCH_PAGE_SIZE)
                        ).flatMap(page => transSearchData.fetch({ index: page.index, }).data)
                        : [];

                    const fileNameCounts = {};
                    for (const recordResult of transSearchResults) {
                        responseObj.records[recordResult.id] = {
                            typeId:   recordResult.getValue(colType),
                            type:     recordResult.getText(colType),
                            id:       recordResult.id,
                            number:   recordResult.getValue(colNumber) || null,
                            date:     recordResult.getValue(colDate),
                            entityId: recordResult.getValue(colEntity) || null,
                            entity:   recordResult.getText(colEntity) || null,
                            fileName: null,
                        };

                        responseObj.sortRecords.push(recordResult.id);

                        const recordEntry = responseObj.records[recordResult.id];
                        recordEntry.fileName = [
                            recordEntry.type.replace(/\s/g, '',),
                            dateToFileNameString(new Date(recordEntry.date)),
                            recordEntry.number ?? '---',
                            recordEntry.entity.replace(/\s/g, '',),
                        ].join('_').replace( /[<>:"/\\|?*]/g, '_', );  // sanitization

                        // append number if name already in use; should not happen unless naming scheme is updated
                        if (!fileNameCounts.hasOwnProperty(recordEntry.fileName))
                            fileNameCounts[recordEntry.fileName] = 0;
                        if (++fileNameCounts[recordEntry.fileName] > 1)
                            recordEntry.fileName += `_${ fileNameCounts[recordEntry.fileName] }`;

                        recordEntry.fileName += '.pdf'  // add file extension
                    }

                    scriptContext.response.setHeader({ name: 'Content-Type', value: 'application/json', });
                    scriptContext.response.write({ output: JSON.stringify(responseObj), });

                    break;
                }
                case 'render_pdfs': {
                    const folderPath = requestBody?.folderPath.trim();
                    const folderId = nextFile.getFolderId(folderPath)
                        ?? nextFile.createFolder({ path: folderPath, recursive: true, });

                    log.debug({ title: 'folderPath', details: folderPath, });
                    log.debug({ title: 'folderId', details: folderId, });

                    const pdfTaskRecordId = nextTask.dispatchPdfTask({ folder: folderId, configuration: {},
                        records: requestBody?.records, });

                    scriptContext.response.setHeader({ name: 'Content-Type', value: 'application/json', });
                    scriptContext.response.write({ output: JSON.stringify({
                        folder: folderId,
                        folderPath: nextFile.getFolderPath(folderId),
                        recordId: pdfTaskRecordId,
                    }), });

                    break;
                }
                case 'check_render_status': {
                    const pdfTaskResult = nextTask.getPdfTaskResult({ id: requestBody?.id, });

                    scriptContext.response.setHeader({ name: 'Content-Type', value: 'application/json', });
                    scriptContext.response.write({ output: JSON.stringify(pdfTaskResult), });

                    break;
                }
                case 'download_file': {
                    const fileId = nextTask.getPdfTaskResult({ id: requestBody?.taskRecordId, }).getRenderedFileId(
                        requestBody?.renderedType, requestBody?.renderedId
                    );

                    if (fileId === null)  // deliberately vague error message, do not clarify
                        throw error.create({ message: 'Access denied', name: 'NEXT_PDF_RENDER_ERROR' });

                    scriptContext.response.writeFile({ file: nextFile.load({ id: fileId, }), });

                    break;
                }
            }
        }
    }

    function getBulkPDFSearches(requestedSearchIDs=[]) {
        const searchData = {
            searches: {},
            sortSearches: [],
        };

        const colSearchType     = search.createColumn({ name: 'recordtype', });
        const colSearchTitle    = search.createColumn({ name: 'title', sort: search.Sort.ASC, });
        const colSearchScriptID = search.createColumn({ name: 'id', });
        const colSearchOwner    = search.createColumn({ name: 'owner', });
        search.create({
            type: 'SavedSearch',
            filters: [
                [ 'recordtype', 'anyof', 'Transaction', ],
                'AND',
                [ 'titletext', 'startswith', '[MASS PDF]', ],
                ...(requestedSearchIDs?.length > 0
                    ? [ 'AND', [ 'internalid', 'anyof', ...requestedSearchIDs, ], ]
                    : []
                )
            ],
            columns: [
                colSearchType,
                colSearchTitle,
                colSearchScriptID,
                colSearchOwner,
            ],
        }).run().each(searchResult => {
            const searchTitle = searchResult.getValue(colSearchTitle);

            searchData.searches[searchResult.id] = {
                internalId: searchResult.id,
                scriptId:   searchResult.getValue(colSearchScriptID),
                searchType: STANDALONE_SEARCH_TYPE_MAP[searchResult.getValue(colSearchType)].toLowerCase(),

                origTitle:  searchTitle,
                title:      searchTitle.match(/(?<=\[MASS PDF]).+/i)[0].trim(),
                owner:      searchResult.getValue(colSearchOwner),
            };

            searchData.sortSearches.push(searchResult.id);

            return true
        });

        return searchData;
    }

    function dateToFileNameString(inputDate, includeTime=false) {
        if (includeTime) {
            return `${
                inputDate.getFullYear()
            }-${
                (inputDate.getMonth() + 1).toString().padStart( 2, '0' )
            }-${
                inputDate.getDate().toString().padStart( 2, '0' )
            }_${
                inputDate.getHours().toString().padStart( 2, '0' )
            }${
                inputDate.getMinutes().toString().padStart( 2, '0' )
            }${
                inputDate.getSeconds().toString().padStart( 2, '0' )
            }`;
        } else {
            return `${
                inputDate.getFullYear()
            }-${
                (inputDate.getMonth() + 1).toString().padStart( 2, '0' )
            }-${
                inputDate.getDate().toString().padStart( 2, '0' )
            }`;
        }
    }

    return { onRequest, };
},
);
