/**
 * @NApiVersion 2.1
 */
define(['N/runtime', 'N/search'], (runtime, search) => {
    /**
     * Gets the Task ID of the calling Scheduled or Map/Reduce Script
     *
     * @returns {string|null}
     */
    function getCurrentScheduledTaskId() {
        const currentScript = runtime.getCurrentScript();
        return search.create({
            type: search.Type.SCHEDULED_SCRIPT_INSTANCE,
            filters: [
                ['status', 'anyof', 'PROCESSING',], 'AND',
                ['script.scriptid', 'is', currentScript.id,], 'AND',
                ['scriptdeployment.scriptid', 'is', currentScript.deploymentId,],
            ],
            columns: ['taskid'],
        }).run().getRange({ start: 0, end: 1, })?.[0]?.getValue?.('taskid') ?? null;
    }

    return { getCurrentScheduledTaskId, }
});
