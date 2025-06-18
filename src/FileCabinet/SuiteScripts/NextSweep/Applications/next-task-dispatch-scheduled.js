/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 */
define(['N/task'], (task) => {
    /**
     * Defines the Scheduled script trigger point.
     * @param {Object} scriptContext
     * @param {string} scriptContext.type - Script execution context. Use values from the scriptContext.InvocationType enum.
     * @since 2015.2
     */
    function execute(scriptContext) {
        try {
            task.create({
                taskType: task.TaskType.MAP_REDUCE,
                scriptId: 'customscript_next_async_task_process_mr',
                deploymentId: 'customdeploy_next_async_task_process_mr',
            }).submit();
        } catch {
            // do nothing
        }
    }

    return { execute, };
});
