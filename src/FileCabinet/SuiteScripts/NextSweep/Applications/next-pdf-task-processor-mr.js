/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */

const RENDERS_PER_REDUCE = 25;  // number of renders to complete on each reduce execution

define(['N/crypto/random', 'N/error', 'N/record', 'N/render', 'N/search',
    '../next-file', '../next-list', '../next-runtime', '../next-task'], (
    cryptoRandom, error, record, render, search, nextFile, nextList, nextRuntime, nextTask
) => {
    function mergeRenderedArrays() {
        return Object.values(Object.fromEntries(
            [...arguments].flat().map(recMapping => [`${recMapping.type}_${recMapping.id}`, recMapping,]),
        ));
    }

    function updateTaskRecordRendered(recordId, newRendered) {
        const pdfTaskRecord = record.load({ type: 'customrecord_next_pdf_render_task', id: recordId, });

        const stagedArray =
            JSON.parse(pdfTaskRecord.getValue({ fieldId: 'custrecord_next_pr_staged_records', }) || '[]');
        const renderedArray = mergeRenderedArrays(
            JSON.parse(pdfTaskRecord.getValue({ fieldId: 'custrecord_next_pr_rendered_records', }) || '[]'),
            newRendered,
        );
        const allRecordsAreRendered = stagedArray.every(staged =>
            renderedArray.some(rendered => staged.type === rendered.type && staged.id === rendered.id));

        pdfTaskRecord.setValue({ fieldId: 'custrecord_next_pr_rendered_records',
            value: JSON.stringify(renderedArray), });

        if (allRecordsAreRendered) {
            const AsyncTaskStatus = nextList.load({ id: 'customlist_next_async_task_status', });
            pdfTaskRecord.setValue({ fieldId: 'custrecord_next_pr_status',
                value: AsyncTaskStatus.getById('next_ats_completed').internalId, });
        }

        pdfTaskRecord.save();
    }

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
        const currentMapReduceTaskId = nextRuntime.getCurrentScheduledTaskId() ?? 'UNKNOWN';
        return nextTask.getOpenPdfTasks().map(taskData => JSON.stringify({  // map status JSON and task ID into values
            statusList: JSON.stringify(nextList.load({ id: 'customlist_next_async_task_status', })),
            taskId:     currentMapReduceTaskId,
            ...taskData,
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
        const taskData = JSON.parse(mapContext.value);
        const AsyncTaskStatus = nextList.CustomList.fromJSON(taskData.statusList);
        const recordedStatus = AsyncTaskStatus.getByInternalId(search.lookupFields({
            type: 'customrecord_next_pdf_render_task',
            id:   taskData.recordId,
            columns: ['custrecord_next_pr_status'],
        })?.['custrecord_next_pr_status']?.[0]?.value)?.id;

        log.debug({ title: 'taskData1', details: JSON.stringify(taskData), });

        const pdfTaskRecord = record.load({ type: 'customrecord_next_pdf_render_task', id: taskData.recordId, });
        taskData.staged =
            JSON.parse(pdfTaskRecord.getValue({ fieldId: 'custrecord_next_pr_staged_records', }) || '[]');
        taskData.rendered =
            JSON.parse(pdfTaskRecord.getValue({ fieldId: 'custrecord_next_pr_rendered_records', }) || '[]');

        log.debug({ title: 'taskData2', details: JSON.stringify(taskData), });

        const renderedMap = taskData.rendered.reduce((accumulator, recMapping) => {
            if (!accumulator.hasOwnProperty(recMapping.type)) accumulator[recMapping.type] = [];
            accumulator[recMapping.type].push(recMapping.id);
            return accumulator;
        }, {},);
        taskData.pending =
            taskData.staged.filter(recMapping => !renderedMap[recMapping.type]?.includes?.(recMapping.id));

        log.debug({ title: 'taskData3', details: JSON.stringify(taskData), });

        switch (recordedStatus) {
            case 'next_ats_new':
            case 'next_ats_retrying': {
                // update task record status to "In Progress"
                pdfTaskRecord.setValue({ fieldId: 'custrecord_next_at_status',
                    value: AsyncTaskStatus.getById('next_ats_processing').internalId, });
                pdfTaskRecord.save();
                break;
            }
            case 'next_ats_processing': break;
            default: {
                pdfTaskRecord.setValue({ fieldId: 'custrecord_next_at_status',
                    value: AsyncTaskStatus.getById('next_ats_cancelled').internalId, });
                pdfTaskRecord.save();
                return;
            }
        }

        log.debug({ title: 'taskData4', details: JSON.stringify(taskData), });

        for (let pendingIndex = 0; pendingIndex < taskData.pending.length; pendingIndex += RENDERS_PER_REDUCE) {
            mapContext.write({ key: cryptoRandom.generateUUID(), value: JSON.stringify({
                ...taskData,
                assigned: taskData.pending.slice(pendingIndex, pendingIndex + RENDERS_PER_REDUCE),
            }), });
        }
    }

    /**
     * Defines the function that is executed when the reduce entry point is
     * triggered. This entry point is triggered automatically when the
     * associated map stage is complete. This function is applied to each group
     * in the provided context.
     *
     * @param {Object} reduceContext Data collection containing the groups to process in the reduce stage. This
     *     parameter is provided automatically based on the results of the map stage.
     * @param {Iterator} reduceContext.errors Serialized errors that were thrown during previous attempts to execute the
     *     reduce function on the current group
     * @param {number} reduceContext.executionNo Number of times the reduce function has been executed on the current
     *     group
     * @param {boolean} reduceContext.isRestarted Indicates whether the current invocation of this function is the first
     *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
     * @param {string} reduceContext.key Key to be processed during the reduce stage
     * @param {List<String>} reduceContext.values All values associated with a unique key that was passed to the reduce
     *     stage for processing
     * @since 2015.2
     */
    function reduce(reduceContext) {
        for (const taskData of reduceContext.values.map(value => JSON.parse(value))) {
            log.debug({ title: 'taskData', details: JSON.stringify(taskData), });

            const newRendered = [];
            for (const assignedMapping of taskData.assigned) {
                try {
                    const pdfName = nextFile.sanitizeFileName(
                        `${assignedMapping.name ?? (assignedMapping.type + '_' + assignedMapping.id)}.pdf`);

                    try {
                        nextFile.delete({ folder: taskData.folder, name: pdfName, });
                    } catch {
                        // if delete fails, that just means the file didn't need to be deleted
                    }

                    // add logic here to leverage taskData.configuration
                    let renderer = null;
                    switch (assignedMapping.type) {
                        case 'transaction': renderer = recId => render.transaction({ entityId: Number(recId), }); break;
                        default: throw error.create({ message: 'No mapped renderer', name: 'NEXT_PDF_RENDER_ERROR', });
                    }

                    const pdfFile = renderer(assignedMapping.id);
                    pdfFile.folder = taskData.folder;
                    pdfFile.name = pdfName;
                    const pdfId = pdfFile.save().toString();

                    newRendered.push({ ...assignedMapping, file: pdfId, });
                } catch (pdfTaskError) {
                    log.debug({ title: 'pdfTaskError',
                        details: JSON.stringify(pdfTaskError, Object.getOwnPropertyNames(pdfTaskError)), });
                }
            }

            log.debug({ title: 'taskData.recordId', details: taskData.recordId, });
            log.debug({ title: 'newRendered', details: JSON.stringify(newRendered), });

            // this write() call DOES NOT behave the same as the one in map(); map() collates writes by key, reduce()
            // does not. Why? I have no earthly idea
            reduceContext.write({ key: cryptoRandom.generateUUID(), value: JSON.stringify({
                recordId: taskData.recordId,
                rendered: newRendered
            }), });

            updateTaskRecordRendered(taskData.recordId, newRendered,);
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
        const newRenderMapMap = {};
        // assemble rendered arrays via this convoluted iterator, because NetSuite won't do it for us
        summaryContext.output.iterator().each((_, newRenderMapPieceJSON) => {
            const newRenderMapPiece = JSON.parse(newRenderMapPieceJSON);
            if (!newRenderMapMap.hasOwnProperty(newRenderMapPiece.recordId))
                newRenderMapMap[newRenderMapPiece.recordId] = { recordId: newRenderMapPiece.recordId, rendered: [], };

            newRenderMapMap[newRenderMapPiece.recordId].rendered.push(...newRenderMapPiece.rendered);
        });

        for (const newRenderMap of Object.values(newRenderMapMap)) {
            log.debug({ title: 'recordId', details: newRenderMap.recordId, });
            log.debug({ title: 'rendered', details: newRenderMap.rendered, });
            if (newRenderMap.rendered.length > 0) {
                updateTaskRecordRendered(newRenderMap.recordId, newRenderMap.rendered,);
            } else {
                const AsyncTaskStatus = nextList.load({ id: 'customlist_next_async_task_status', });
                record.submitFields({
                    type: 'customrecord_next_pdf_render_task', id: newRenderMap.recordId,
                    values: { 'custrecord_next_at_status': AsyncTaskStatus.getById('next_ats_completed').internalId, },
                });
            }
        }

        // attempt re-execution if open tasks found
        if (nextTask.getOpenPdfTasks().length > 0) {
            log.debug({ title: 'Tasks Remain', details: 'Unresolved tasks remain, attempting M/R dispatch', });
            // nextTask.dispatchPdfTaskProcessor();
        } else {
            log.debug({ title: 'All Tasks Resolved', details: 'No open tasks remain, exiting', });
        }
    }

    return { getInputData, map, reduce, summarize, };
});
