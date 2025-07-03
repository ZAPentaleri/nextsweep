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
     * Resolves a script URL by Script ID and Deployment ID
     *
     * @param {object} options
     * @param {string} [options.id] Progress bar element ID
     * @param {string} [options.selector] Progress bar element CSS selector
     * @param {string} [options.progress] Progress percentage (a float in the range of 0-1 or null)
     */
    function updateProgressBars(options) {
        if ((typeof options.id) !== 'string' && (typeof options.selector) !== 'string')
            throw new Error('ID or selector must be provided');

        const percentage = options?.progress ?? 0;
        const percentageRounded = Math.max((percentage < 1 ? Math.min(Math.round(100 * percentage), 99) : 100), 0);
        document.querySelectorAll(options?.id ? `#${options.id}` : options.selector).forEach(elem =>
            elem.setAttribute('data-progress', (options?.progress ?? null) === null ? "" : percentageRounded));
    }

    return { updateProgressBars, };
});
