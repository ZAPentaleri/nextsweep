/**
 *    __________ _ _____    ___
 *    \____   // ||   _  \  \  \
 *       /  //   ||  | \  \ |  |____       ___ __
 *     /  //  /  ||  |_/  //  // ___\___  / __\ |_
 *   /  //__/ |  ||   __//__/  \__ \/ . \|  _||  _|
 * /_________\|__||__| /__/   /____/\___/|_|  \__\
 *
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 */
define(['N/task', 'N/runtime'], (task, runtime) => {
    /**
     * Defines the Scheduled script trigger point.
     * @param {Object} scriptContext
     * @param {string} scriptContext.type - Script execution context. Use values from the scriptContext.InvocationType
     *     enum.
     * @since 2015.2
     */
    function execute(scriptContext) {
        const currentScript = runtime.getCurrentScript();
        try {
            // this WILL FAIL if the script is already running -- this a feature, not a bug.
            // we only *want* one execution to take place at a time
            task.create({
                taskType: task.TaskType.MAP_REDUCE,
                scriptId: 'customscript_next_async_task_process_mr',
                deploymentId: 'customdeploy_next_async_task_process_mr',
            }).submit();
            log.audit({ title: 'Initiated Map/Reduce', details: `${currentScript.id}.${currentScript.deploymentId}`, });
        } catch {
            log.audit({ title: 'Could not Initiate Map/Reduce',
                details: `${currentScript.id}.${currentScript.deploymentId} : ${
                    JSON.stringify(submitError, Object.getOwnPropertyNames(submitError))}` });
        }
    }

    return { execute, };
});
