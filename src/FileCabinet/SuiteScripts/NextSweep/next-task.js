/**
 *    __________ _ _____    ___
 *    \____   // ||   _  \  \  \
 *       /  //   ||  | \  \ |  |____       ___ __
 *     /  //  /  ||  |_/  //  // ___\___  / __\ |_
 *   /  //__/ |  ||   __//__/  \__ \/ . \|  _||  _|
 * /_________\|__||__| /__/   /____/\___/|_|  \__\
 *
 * NextSweep Task Module: methods relating to NextSweep asynchronous tasks
 *
 * ZAPentaleri, 2025
 *
 * @NApiVersion 2.1
 */

const TASK_ERR_NAME = 'NEXT_TASK_ERROR';
const NO_PARAMS_STRING = '>NEXT_TASK_NO_PARAMETERS<';

define(['N/crypto/random', 'N/error', 'N/record', 'N/search', './next-file', './next-list', './next-record'], (
    cryptoRandom, error, record, search, nextFile, nextList, nextRecord,
) => {
    /**
     * @class
     * @property {string} id Task record ID
     * @property {string} status Task status
     * @property {any} result Task result after successful completion
     * @property {any} error Task error
     */
    class AsyncTaskResult {
        constructor(id, status, result, error) {
            Object.defineProperty(this, 'id',     { value: id.toString(), writable: false, enumerable: true, });
            Object.defineProperty(this, 'status', { value: status, writable: false, enumerable: true, });
            Object.defineProperty(this, 'result', { value: result ?? null, writable: false, enumerable: true, });
            Object.defineProperty(this, 'error',  { value: error ?? null, writable: false, enumerable: true, });
        }
    }

    /**
     * @class
     * @property {string} id Task record ID
     * @property {string} status Task status
     * @property {string} folder Output folder ID
     * @property {object[]} staged Staged record detail
     * @property {object[]} rendered Rendered record detail
     * @property {any} error Task error
     */
    class PdfTaskResult {
        constructor(id, status, folder, staged, rendered, error) {
            Object.defineProperty(this, 'id',       { value: id.toString(), writable: false, enumerable: true, });
            Object.defineProperty(this, 'status',   { value: status, writable: false, enumerable: true, });
            Object.defineProperty(this, 'folder',   { value: folder.toString(), writable: false, enumerable: true, });
            Object.defineProperty(this, 'staged',   { value: staged ?? [], writable: false, enumerable: true, });
            Object.defineProperty(this, 'rendered', { value: rendered ?? [], writable: false, enumerable: true, });
            Object.defineProperty(this, 'error',    { value: error ?? null, writable: false, enumerable: true, });
        }

        getRenderedFileId(recordType, recordId) {
            return this.rendered.reduce((accumulator, rendRec) =>
                rendRec.type === recordType.toLowerCase() && rendRec.id === recordId ? rendRec.file : accumulator,
            null,);
        }
    }

    /**
     * Dispatches a new Asynchronous Task
     *
     * @param {object} options
     * @param {string} options.module Asynchronous task module path
     * @param {string} options.function Asynchronous task function name
     * @param {any} [options.parameters] Asynchronous task function parameters (MUST BE SERIALIZABLE TO JSON)
     * @param {boolean} [options.spread]
     * @returns {*}
     */
    function dispatchAsyncTask(options) {
        if ((typeof options.module) !== 'string')
            throw error.create({ message: 'Module path is not a string', name: TASK_ERR_NAME, });
        if ((typeof options.function) !== 'string')
            throw error.create({ message: 'Function name is not a string', name: TASK_ERR_NAME, });
        if (/^\.\//.test(options.module))
            throw error.create({ message: 'Module is relative path', name: TASK_ERR_NAME, });

        const asyncJobId = nextRecord.quickCreate({
            type: 'customrecord_next_async_task',
            procedure: [
                ['custrecord_next_at_module', options.module,],
                ['custrecord_next_at_function', options.function,],
                ['custrecord_next_at_parameters', (typeof options.parameters) !== 'undefined'
                    ? JSON.stringify(options.parameters)
                    : NO_PARAMS_STRING,],
                ['custrecord_next_at_spread', !!options.spread,],
            ],
        });

        dispatchAsyncTaskProcessor();

        return asyncJobId;
    }

    /**
     * Dispatches the Asynchronous Task processor. You do not need to call this
     * function directly, it happens automatically
     */
    function dispatchAsyncTaskProcessor() {
        try {
            // this *may* fail, but if that happens then that means the script is already queued or executing, in which
            // case its job will be done anyway. It only takes a matter of seconds to complete execution, so queueing it
            // again will do nothing
            require(['N/task'], task => task.create({
                taskType: task.TaskType.SCHEDULED_SCRIPT,
                scriptId: 'customscript_next_async_task_dispatch_sc',
            }).submit());
        } catch {
            // do nothing
        }
    }

    /**
     * Gets an array of data concerning open Asynchronous Tasks
     *
     * @returns {{
     *     recordId: string, status: string,
     *     functionData: {module: string, function: string, parameters: any, spread: boolean, paramsTooLong: boolean}
     * }[]}
     */
    function getOpenAsyncTasks() {
        const AsyncTaskStatus = nextList.load({ id: 'customlist_next_async_task_status', });
        const asyncTaskSearchData = search.create({
            type: 'customrecord_next_async_task',
            filters: [
                [
                    'custrecord_next_at_status', 'anyof',
                    AsyncTaskStatus.getById('next_ats_new').internalId,
                    AsyncTaskStatus.getById('next_ats_retrying').internalId,
                ], 'AND',
                ['isinactive', 'is', false,],
            ],
            columns: ['custrecord_next_at_status', 'custrecord_next_at_module', 'custrecord_next_at_function',
                'custrecord_next_at_parameters', 'custrecord_next_at_spread',],
        }).runPaged({ pageSize: 1000, });

        return asyncTaskSearchData.pageRanges.flatMap(page =>
            asyncTaskSearchData.fetch({ index: page.index, }).data
        ).map(taskResult => {
            const paramsString = taskResult.getValue('custrecord_next_at_parameters');
            const noParams = paramsString === NO_PARAMS_STRING;  // check against magic string that signifies no params
            const paramsTooLongForSearch = paramsString.length >= 4000;  // searches can only return 4000 bytes of text
            //TODO: evaluate above behavior; 4000 byte limit is not properly handled, but limit might not exist at all.
            // It is documented in official NS documentation, but I haven't observed it in a live environment

            return {
                recordId: taskResult.id,
                status:   AsyncTaskStatus.getByInternalId(taskResult.getValue('custrecord_next_at_status')).id,
                functionData: {
                    module:     taskResult.getValue('custrecord_next_at_module'),
                    function:   taskResult.getValue('custrecord_next_at_function'),
                    parameters: noParams || paramsTooLongForSearch ? [] : JSON.parse(paramsString),
                    spread:     noParams || !!taskResult.getValue('custrecord_next_at_spread'),
                    paramsTooLong: paramsTooLongForSearch,
                },
            }
        });
    }

    /**
     * Gets the result and/or current status of an Asynchronous Task by ID
     *
     * @param {object} options
     * @param {string|number} options.id
     * @returns {AsyncTaskResult}
     */
    function getAsyncTaskResult(options) {
        const AsyncTaskStatus = nextList.load({ id: 'customlist_next_async_task_status', });
        const asyncTaskRecord = record.load({ type: 'customrecord_next_async_task', id: options?.id, });

        // status determines how certain properties will be set; this covers for the future potential case where a task
        // is "retried", but its state hasn't been fully restored to initial
        const currentStatus = AsyncTaskStatus.getByInternalId(asyncTaskRecord.getValue('custrecord_next_at_status')).id;
        return new AsyncTaskResult(asyncTaskRecord.id, currentStatus,
            (currentStatus === 'next_ats_completed'
                ? JSON.parse(asyncTaskRecord.getValue('custrecord_next_at_result')) : null),
            (currentStatus === 'next_ats_failed'
                ? JSON.parse(asyncTaskRecord.getValue('custrecord_next_at_error') || null) : null),
        );
    }

    /**
     *
     * @param {object} options
     * @param {object} [options.configuration={}]
     * @param {string|number} [options.folder]
     * @param {string} [options.folderPath]
     * @param {array} [options.records]
     * @returns {string}
     */
    function dispatchPdfTask(options) {
        if ((typeof options) !== 'object')
            throw error.create({ message: 'Options was not passed as object', name: TASK_ERR_NAME, });

        const configuration = options.configuration ?? {};
        const folderId = options.folder ?? nextFile.getFolderId(options.folderPath);
        const recordMap = (options.records ?? []).map(recMapping =>
            ({ type: recMapping?.type?.toLowerCase(), id: recMapping?.id?.toString(), name: recMapping?.name ?? null, })
        );

        if ((typeof configuration) !== 'object')
            throw error.create({ message: 'Configuration was not passed as object', name: TASK_ERR_NAME, });
        if (nextFile.getFolderName(folderId) === null)  // cheap (1pt) check; returns null if folder doesn't exist
            throw error.create({ message: 'Invalid render folder', name: TASK_ERR_NAME, });
        if (recordMap.some(m => (typeof m.type) !== 'string' || (typeof m.id) !== 'string' || !/^-?\d+$/.test(m.id)))
            throw error.create({ message: 'Invalid value types in record array', name: TASK_ERR_NAME, });

        const asyncJobId = nextRecord.quickCreate({
            type: 'customrecord_next_pdf_render_task',
            procedure: [
                ['custrecord_next_pr_folder', folderId,],
                ['custrecord_next_pr_configuration', JSON.stringify(configuration),],
                ['custrecord_next_pr_staged_records', JSON.stringify(
                    Object.values(Object.fromEntries(recordMap.map(rec => [`${rec.type}_${rec.id}`, rec,])))  // dedupe
                ),],
                ['custrecord_next_pr_rendered_records', '[]',],
            ],
        });

        dispatchPdfTaskProcessor();
        return asyncJobId;
    }

    /**
     * Dispatches the PDF Task processor. You do not need to call this function
     * directly, it happens automatically
     */
    function dispatchPdfTaskProcessor() {
        try {
            // this *may* fail, but if that happens then that means the script is already queued or executing, in which
            // case its job will be done anyway. It only takes a matter of seconds to complete execution, so queueing it
            // again will do nothing
            require(['N/task'], task => task.create({
                taskType: task.TaskType.SCHEDULED_SCRIPT, scriptId: 'customscript_next_pdf_task_dispatch_sc',
            }).submit());
        } catch {
            // do nothing
        }
    }

    /**
     * Gets an array of data concerning open PDF Render Tasks
     *
     * @returns {{recordId: string, status: string, folder: string, config: object}[]}
     */
    function getOpenPdfTasks() {
        const AsyncTaskStatus = nextList.load({ id: 'customlist_next_async_task_status', });
        const pdfTaskSearchData = search.create({
            type: 'customrecord_next_pdf_render_task',
            filters: [
                [
                    'custrecord_next_pr_status', 'anyof',
                    AsyncTaskStatus.getById('next_ats_new').internalId,
                    AsyncTaskStatus.getById('next_ats_processing').internalId,
                    AsyncTaskStatus.getById('next_ats_retrying').internalId,
                ], 'AND',
                ['isinactive', 'is', false,],
            ],
            columns: ['custrecord_next_pr_status', 'custrecord_next_pr_folder', 'custrecord_next_pr_configuration',],
        }).runPaged({ pageSize: 1000, });

        return pdfTaskSearchData.pageRanges.flatMap(page =>
            pdfTaskSearchData.fetch({ index: page.index, }).data
        ).map(taskResult => ({
            recordId: taskResult.id,
            status:   AsyncTaskStatus.getByInternalId(taskResult.getValue('custrecord_next_pr_status')).id,
            folder:   taskResult.getValue('custrecord_next_pr_folder'),
            config:   JSON.parse(taskResult.getValue('custrecord_next_pr_configuration')),
        }));
    }

    /**
     * Gets the result and/or current status of a PDF Render Task by ID
     *
     * @param {object} options
     * @param {string|number} options.id
     * @returns {PdfTaskResult}
     */
    function getPdfTaskResult(options) {
        const AsyncTaskStatus = nextList.load({ id: 'customlist_next_async_task_status', });
        const pdfJobRecord = record.load({ type: 'customrecord_next_pdf_render_task', id: options?.id, });

        // status determines how certain properties will be set; this covers for the future potential case where a task
        // is "retried", but its state hasn't been fully restored to initial
        const currentStatus = AsyncTaskStatus.getByInternalId(pdfJobRecord.getValue('custrecord_next_pr_status')).id;
        return new PdfTaskResult(
            pdfJobRecord.id,
            AsyncTaskStatus.getByInternalId(pdfJobRecord.getValue('custrecord_next_pr_status')).id,
            pdfJobRecord.getValue('custrecord_next_pr_folder'),
            JSON.parse(pdfJobRecord.getValue('custrecord_next_pr_staged_records') || '[]'),
            JSON.parse(pdfJobRecord.getValue('custrecord_next_pr_rendered_records') || '[]'),
            (currentStatus === 'next_ats_failed'
                ? JSON.parse(pdfJobRecord.getValue('custrecord_next_pr_error') || null) : null),
        );
    }

    return {
        dispatchAsyncTask, dispatchAsyncTaskProcessor, getOpenAsyncTasks, getAsyncTaskResult,
        dispatchPdfTask, dispatchPdfTaskProcessor, getOpenPdfTasks, getPdfTaskResult,
    };
});
