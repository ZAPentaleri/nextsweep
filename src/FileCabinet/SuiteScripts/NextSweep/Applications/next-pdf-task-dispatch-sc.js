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
            // this WILL FAIL if the script is already running -- this a feature, not a bug.
            // we only *want* one execution to take place at a time
            task.create({
                taskType: task.TaskType.MAP_REDUCE,
                scriptId: 'customscript_next_pdf_task_process_mr',
                deploymentId: 'customdeploy_next_pdf_task_process_mr',
            }).submit();
        } catch {
            // do nothing
        }
    }

    return { execute, };
});
