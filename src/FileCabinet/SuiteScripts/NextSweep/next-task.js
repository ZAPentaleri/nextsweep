/**
 *    __________ _ _____    ___
 *    \____   // ||   _  \  \  \
 *       /  //   ||  | \  \ |  |____       ___ __
 *     /  //  /  ||  |_/  //  // ___\___  / __\ |_
 *   /  //__/ |  ||   __//__/  \__ \/ . \|  _||  _|
 * /_________\|__||__| /__/(R)/____/\___/|_|  \__\
 *
 * NextSweep Task Module: methods relating to NextSweep asynchronous tasks
 *
 * ZAPentaleri, 2025
 *
 * @NApiVersion 2.1
 */

const TASK_ERR_NAME = 'NEXT_TASK_ERROR';
const NO_PARAMS_STRING = '>NEXT_TASK_NO_PARAMETERS<';

define(['N/crypto/random', 'N/error', 'N/record', 'N/search', './next-list', './next-record'], (
    cryptoRandom, error, record, search, nextList, nextRecord,
) => {
    /**
     * @class
     * @property {string} id Task record ID
     * @property {string} status Task status
     * @property {any} result Task result after successful completion
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
            require(['N/task'], task => task.create({
                taskType: task.TaskType.SCHEDULED_SCRIPT,
                scriptId: 'customscript_next_async_task_dispatch_sc',
            }).submit());
        } catch {
            // do nothing
        }
    }

    /**
     * Gets certain data about open Asynchronous Tasks
     *
     * @returns {{
     *     recordId: string, status: string,
     *     functionData: {module: string, function: string, parameters: any, spread: boolean
     * }}[]}
     */
    function getOpenAsyncTasks() {
        const AsyncTaskStatus = nextList.load({ id: 'customlist_next_async_task_status', });
        const asyncTaskSearchData = search.create({
            type: 'customrecord_next_async_task',
            filters: [
                ['custrecord_next_at_status', 'is', AsyncTaskStatus.getById('next_ats_new').internalId,], 'AND',
                ['isinactive', 'is', false,],
            ],
            columns: ['custrecord_next_at_status', 'custrecord_next_at_module', 'custrecord_next_at_function',
                'custrecord_next_at_parameters', 'custrecord_next_at_spread',],
        }).runPaged({ pageSize: 1000, });

        return asyncTaskSearchData.pageRanges.flatMap(page =>
            asyncTaskSearchData.fetch({ index: page.index, }).data
        ).map(taskResult => {
            const paramsString = taskResult.getValue('custrecord_next_at_parameters');
            const noParams = paramsString === NO_PARAMS_STRING;

            return {
                recordId: taskResult.id,
                status:   AsyncTaskStatus.getByInternalId(taskResult.getValue('custrecord_next_at_status')).id,
                functionData: {
                    module:     taskResult.getValue('custrecord_next_at_module'),
                    function:   taskResult.getValue('custrecord_next_at_function'),
                    parameters: noParams ? [] : JSON.parse(paramsString),
                    spread:     noParams || !!taskResult.getValue('custrecord_next_at_spread'),
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
        const asyncJobRecord = record.load({ type: 'customrecord_next_async_task', id: options.id, });

        const currentStatus = AsyncTaskStatus.getByInternalId(asyncJobRecord.getValue('custrecord_next_at_status')).id;
        return new AsyncTaskResult(asyncJobRecord.id, currentStatus,
            (currentStatus === 'next_ats_completed'
                ? JSON.parse(asyncJobRecord.getValue('custrecord_next_at_result')) : null),
            (currentStatus === 'next_ats_failed'
                ? JSON.parse(asyncJobRecord.getValue('custrecord_next_at_error') || null) : null),
        );
    }

    return { dispatchAsyncTask, dispatchAsyncTaskProcessor, getOpenAsyncTasks, getAsyncTaskResult, };
});
