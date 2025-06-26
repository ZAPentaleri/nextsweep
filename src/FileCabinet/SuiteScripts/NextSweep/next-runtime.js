/**
 *    __________ _ _____    ___
 *    \____   // ||   _  \  \  \
 *       /  //   ||  | \  \ |  |____       ___ __
 *     /  //  /  ||  |_/  //  // ___\___  / __\ |_
 *   /  //__/ |  ||   __//__/  \__ \/ . \|  _||  _|
 * /_________\|__||__| /__/   /____/\___/|_|  \__\
 *
 * NextSweep Runtime Module: runtime data retrieval methods
 *
 * ZAPentaleri, 2025
 *
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
