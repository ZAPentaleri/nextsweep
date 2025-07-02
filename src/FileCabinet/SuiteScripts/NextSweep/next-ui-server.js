/**
 *    __________ _ _____    ___
 *    \____   // ||   _  \  \  \
 *       /  //   ||  | \  \ |  |____       ___ __
 *     /  //  /  ||  |_/  //  // ___\___  / __\ |_
 *   /  //__/ |  ||   __//__/  \__ \/ . \|  _||  _|
 * /_________\|__||__| /__/   /____/\___/|_|  \__\
 *
 * NextSweep UI-Server Module
 *
 * ZAPentaleri, 2025
 *
 * @NApiVersion 2.1
 */

const BASE_STYLES_PATH = 'SuiteScripts/NextSweep/Applications/Resources/next-base.css';

define(['N/ui/serverWidget', './next-file'], (uiServerWidget, nextFile) => {
    /**
     * Resolves a script URL by Script ID and Deployment ID
     *
     * @param {object} options
     * @param {string} options.title
     * @param {string} options.documentPath
     * @param {string} [options.stylesPath]
     * @param {string} [options.clientScriptPath]
     * @param {string} [options.includeBaseStyles]
     * @returns {Form}
     */
    function createHtmlForm(options) {
        const escapeCss = unescaped =>  `${unescaped}`.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        let htmlFieldContent = '';
        if (options?.includeBaseStyles) htmlFieldContent +=
            `<style>${escapeCss(nextFile.load({ path: BASE_STYLES_PATH, }).getContents())}</style>`;
        if (options?.stylesPath) htmlFieldContent +=
            `<style>${escapeCss(nextFile.load({ path: options.stylesPath, }).getContents())}</style>`;

        htmlFieldContent += `<div id="next-html-form" class="next-base">${
            nextFile.load({ path: options.documentPath, }).getContents()}</div>`;

        let nativeForm = uiServerWidget.createForm({ title: options.title, });

        // create html container field
        nativeForm.addField({
            id: 'interface_container',
            type: uiServerWidget.FieldType.INLINEHTML,
            label: 'HTML',
        }).defaultValue = htmlFieldContent;

        // add client script
        if (options?.clientScriptPath) nativeForm.clientScriptModulePath = options.clientScriptPath;

        return nativeForm;
    }

    return { createHtmlForm, };
});
