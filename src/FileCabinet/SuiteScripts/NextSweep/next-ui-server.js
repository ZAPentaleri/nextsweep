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


const UI_ERR_NAME = 'NEXT_UI_ERROR';
const BASE_STYLES_PATH = 'SuiteScripts/NextSweep/Applications/Resources/next-base.css';
const BASE_STYLES_I18N_PATH = 'SuiteScripts/NextSweep/Applications/Resources/next-base-i18n.css';

define(['N/error', 'N/ui/serverWidget', './next-file'], (error, uiServerWidget, nextFile) => {
    /**
     * Resolves a script URL by Script ID and Deployment ID
     *
     * @param {object} options
     * @param {string} options.title Form title -- shown in UI and in browser tab name
     * @param {string} options.documentPath Form HTML document path
     * @param {string} [options.stylesPath] CSS stylesheet path
     * @param {string} [options.clientScriptPath] Client script path
     * @param {string} [options.includeBaseStyles] Whether to include base stylesheet
     * @returns {Form}
     */
    function createHtmlForm(options) {
        if (nextFile.checkIfRelativePath(options.documentPath))
            throw error.create({ message: 'Document path is relative', name: UI_ERR_NAME, });
        if (options?.stylesPath && nextFile.checkIfRelativePath(options.stylesPath))
            throw error.create({ message: 'Styles path is relative', name: UI_ERR_NAME, });
        if (options?.clientScriptPath && nextFile.checkIfRelativePath(options.clientScriptPath))
            throw error.create({ message: 'Client script path is relative', name: UI_ERR_NAME, });

        const escapeCss = unescaped =>  `${unescaped}`.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        let htmlFieldContent = '';
        if (options?.includeBaseStyles) {
            for (const stylesPath of [BASE_STYLES_PATH, BASE_STYLES_I18N_PATH])
                htmlFieldContent +=　`<style>${escapeCss(nextFile.load({path: stylesPath,}).getContents())}</style>`;
        }
        if (options?.stylesPath) {
            htmlFieldContent += `<style>${escapeCss(nextFile.load({path: options.stylesPath,}).getContents())}</style>`;
        }

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
