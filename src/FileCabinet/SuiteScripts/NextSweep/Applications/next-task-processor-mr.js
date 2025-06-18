/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/crypto/random', 'N/record', 'N/runtime', 'N/search', '../next-list', '../next-task'], (
    cryptoRandom, record, runtime, search, nextList, nextTask
) => {
    /**
     * Defines the function that is executed at the beginning of the map/reduce
     * process and generates the input data.
     *
     * @param {Object} inputContext
     * @param {boolean} inputContext.isRestarted Indicates whether the current invocation of this function is the first
     *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
     * @param {Object} inputContext.ObjectRef Object that references the input data
     * @typedef {Object} ObjectRef
     * @property {string|number} ObjectRef.id Internal ID of the record instance that contains the input data
     * @property {string} ObjectRef.type Type of the record instance that contains the input data
     * @returns {Array|Object|Search|ObjectRef|File|Query} The input data to use in the map/reduce process
     * @since 2015.2
     */
    function getInputData(inputContext) {
        const currentScript = runtime.getCurrentScript();
        const currentMapReduceTaskId = search.create({
            type: search.Type.SCHEDULED_SCRIPT_INSTANCE,
            filters: [
                ['status', 'anyof', 'PROCESSING',], 'AND',
                ['script.scriptid', 'is', currentScript.id,], 'AND',
                ['scriptdeployment.scriptid', 'is', currentScript.deploymentId,],
            ],
            columns: ['taskid'],
        }).run().getRange({ start: 0, end: 1, })?.[0]?.getValue?.('taskid');

        return nextTask.getOpenAsyncTasks().map(jobData => JSON.stringify({
            statusList: nextList.load({ id: 'customlist_next_async_task_status', }).toJSON(),
            taskId:     currentMapReduceTaskId,
            ...jobData,
        }));
    }

    /**
     * Defines the function that is executed when the map entry point is
     * triggered. This entry point is triggered automatically when the
     * associated getInputData stage is complete. This function is applied to
     * each key-value pair in the provided context.
     *
     * @param {Object} mapContext Data collection containing the key-value pairs to process in the map stage. This
     *     parameter is provided automatically based on the results of the getInputData stage.
     * @param {Iterator} mapContext.errors Serialized errors that were thrown during previous attempts to execute the
     *     map function on the current key-value pair
     * @param {number} mapContext.executionNo Number of times the map function has been executed on the current
     *     key-value pair
     * @param {boolean} mapContext.isRestarted Indicates whether the current invocation of this function is the first
     *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
     * @param {string} mapContext.key Key to be processed during the map stage
     * @param {string} mapContext.value Value to be processed during the map stage
     * @since 2015.2
     */
    function map(mapContext) {
        const jobData = JSON.parse(mapContext.value);
        const AsyncTaskStatus = nextList.CustomList.fromJSON(jobData.statusList);
        const recordedStatus = AsyncTaskStatus.getByInternalId(search.lookupFields({
            type: 'customrecord_next_async_task',
            id:   jobData.recordId,
            columns: ['custrecord_next_at_status'],
        })?.['custrecord_next_at_status']?.[0]?.value)?.id;

        if (recordedStatus !== 'next_ats_new') {  // modify this conditional for retry logic
            // update task record status to "Added to Queue"
            record.submitFields({
                type: 'customrecord_next_async_task', id: jobData.recordId,
                values: {
                    'custrecord_next_at_status': AsyncTaskStatus.getById('next_ats_queued').internalId,
                    'custrecord_next_at_task':   jobData.taskId,
                    'custrecord_next_at_result': '',
                },
            });

            // for batching, modify below key
            mapContext.write({ key: cryptoRandom.generateUUID(), value: JSON.stringify(jobData), });
        }
    }

    /**
     * Defines the function that is executed when the reduce entry point is
     * triggered. This entry point is triggered automatically when the
     * associated map stage is complete. This function is applied to each group
     * in the provided context.
     *
     * @param {Object} reduceContext Data collection containing the groups to process in the reduce stage. This parameter is
     *     provided automatically based on the results of the map stage.
     * @param {Iterator} reduceContext.errors Serialized errors that were thrown during previous attempts to execute the
     *     reduce function on the current group
     * @param {number} reduceContext.executionNo Number of times the reduce function has been executed on the current group
     * @param {boolean} reduceContext.isRestarted Indicates whether the current invocation of this function is the first
     *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
     * @param {string} reduceContext.key Key to be processed during the reduce stage
     * @param {List<String>} reduceContext.values All values associated with a unique key that was passed to the reduce stage
     *     for processing
     * @since 2015.2
     */
    function reduce(reduceContext) {
        for (const jobData of reduceContext.values.map(value => JSON.parse(value))) {
            const AsyncTaskStatus = nextList.CustomList.fromJSON(jobData.statusList);

            // update task record status to "In Progress"
            record.submitFields({
                type: 'customrecord_next_async_task', id: jobData.recordId,
                values: {
                    'custrecord_next_at_status': AsyncTaskStatus.getById('next_ats_processing').internalId,
                    'custrecord_next_at_task':   jobData.taskId,
                },
            });

            try {
                const functionData = jobData.functionData;
                let _asyncTaskResult;
                require([functionData.module], _asyncTaskModule =>
                    _asyncTaskResult = _asyncTaskModule[functionData.function](...(functionData.spread
                        ? functionData.parameters
                        : [functionData.parameters]
                    ))
                );

                // update task record status to "Complete", record result
                record.submitFields({
                    type: 'customrecord_next_async_task', id: jobData.recordId,
                    values: {
                        'custrecord_next_at_status': AsyncTaskStatus.getById('next_ats_complete').internalId,
                        'custrecord_next_at_task':   jobData.taskId,
                        'custrecord_next_at_result': JSON.stringify(_asyncTaskResult ?? null),
                    },
                });
            } catch (asyncTaskError) {
                // update task record status to "Failed"
                record.submitFields({
                    type: 'customrecord_next_async_task', id: jobData.recordId,
                    values: {
                        'custrecord_next_at_status': AsyncTaskStatus.getById('next_ats_failed').internalId,
                        'custrecord_next_at_task':   jobData.taskId,
                    },
                });
            }
        }
    }

    /**
     * Defines the function that is executed when the summarize entry point is
     * triggered. This entry point is triggered automatically when the
     * associated reduce stage is complete. This function is applied to the
     * entire result set.
     *
     * @param {Object} summaryContext Statistics about the execution of a map/reduce script
     * @param {number} summaryContext.concurrency Maximum concurrency number when executing parallel tasks for the
     *     map/reduce script
     * @param {Date} summaryContext.dateCreated The date and time when the map/reduce script began running
     * @param {boolean} summaryContext.isRestarted Indicates whether the current invocation of this function is the
     *     first invocation (if true, the current invocation is not the first invocation and this function has been
     *     restarted)
     * @param {Iterator} summaryContext.output Serialized keys and values that were saved as output during the reduce
     *     stage
     * @param {number} summaryContext.seconds Total seconds elapsed when running the map/reduce script
     * @param {number} summaryContext.usage Total number of governance usage units consumed when running the map/reduce
     *     script
     * @param {number} summaryContext.yields Total number of yields when running the map/reduce script
     * @param {Object} summaryContext.inputSummary Statistics about the input stage
     * @param {Object} summaryContext.mapSummary Statistics about the map stage
     * @param {Object} summaryContext.reduceSummary Statistics about the reduce stage
     * @since 2015.2
     */
    function summarize(summaryContext) {
        // attempt re-execution if open tasks found
        if (nextTask.getOpenAsyncTasks().length > 0) {
            nextTask.dispatchAsyncTaskProcessor();
        }
    }

    return { getInputData, map, reduce, summarize, };
});
