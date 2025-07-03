/**
 *    __________ _ _____    ___
 *    \____   // ||   _  \  \  \
 *       /  //   ||  | \  \ |  |____       ___ __
 *     /  //  /  ||  |_/  //  // ___\___  / __\ |_
 *   /  //__/ |  ||   __//__/  \__ \/ . \|  _||  _|
 * /_________\|__||__| /__/   /____/\___/|_|  \__\
 *
 * NextSweep UI-Client Module
 *
 * ZAPentaleri, 2025
 *
 * @NApiVersion 2.1
 */

define([], () => {
    /**
     * Updates a Next Base Styles progress bar
     *
     * @param {object} options
     * @param {string} [options.id] Progress bar element ID
     * @param {string} [options.selector] Progress bar element CSS selector
     * @param {string} [options.progress] Progress percentage (a float in the range of 0-1 or null)
     */
    function updateProgressBars(options) {
        if ((typeof options?.id) !== 'string' && (typeof options?.selector) !== 'string')
            throw new Error('ID or selector must be provided');

        const percentage = options?.progress ? (100 * options.progress) : 0;
        const percentageRounded = Math.max((percentage < 100 ? Math.min(Math.round(percentage), 99) : 100), 0);
        // percentage is pinned to 99 if it's even one iota less than 100, so that "100%" can always mean "complete"

        document.querySelectorAll(options?.id ? `#${options.id}` : options.selector).forEach(elem =>
            elem.setAttribute('data-progress', (options?.progress ?? null) === null ? "" : percentageRounded));
    }

    /**
     * Updates a Next Base Styles status box
     *
     * @param {object} options
     * @param {string} [options.id] Status element ID
     * @param {string} [options.selector] Status element CSS selector
     * @param {string} [options.status="ready"] Status name ("READY", "PENDING", "COMPLETE", or "FAILED")
     */
    function updateStatusBoxes(options) {
        if ((typeof options?.id) !== 'string' && (typeof options?.selector) !== 'string')
            throw new Error('ID or selector must be provided');
        if (!['READY', 'PENDING', 'COMPLETE', 'FAILED'].includes(options?.status?.toUpperCase()))
            throw new Error('Invalid status');

        document.querySelectorAll(options?.id ? `#${options.id}` : options.selector).forEach(elem =>
            elem.setAttribute('data-status', options?.status?.toUpperCase() ?? 'READY'));
    }

    return { updateProgressBars, updateStatusBoxes, };
});
