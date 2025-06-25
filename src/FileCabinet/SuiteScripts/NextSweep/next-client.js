/**
 * @NApiVersion 2.1
 */
define(['N/url'], (url) => {
    const _scriptUrlCache = {};

    function resolveScript(options) {
        const scriptKey = `${options.scriptId}_${options.deploymentId}`;
        if (_scriptUrlCache.hasOwnProperty(scriptKey))
            return _scriptUrlCache[scriptKey];
        else
            return _scriptUrlCache[scriptKey] =
                url.resolveScript({ scriptId: options.scriptId, deploymentId: options.deploymentId, });
    }

    /**
     * Makes a network request to a Suitelet
     *
     * @param {object} options
     * @param {string} [options.url] The URL to request
     * @param {string|number} [options.scriptId] The ID of the script to request
     * @param {string|number} [options.deploymentId] The ID of the script deployment to request
     * @param {string} [options.method] Request method
     * @param {object} [options.parameters] Parameters to append to the URL as a query string
     * @param {any} [options.body] Request body
     * @param {object} [options.headers] Request headers
     * @param {string} [options.responseType] Response type interpretation override
     * @returns {Promise<object|blob|string>}
     */
    async function requestSuitelet(options) {
        let baseUrl;
        if (options?.url)
            baseUrl = options.url;
        else if (options?.scriptId && options?.deploymentId)
            baseUrl = resolveScript({ scriptId: options.scriptId, deploymentId: options.deploymentId, });
        else
            baseUrl = window.location.href;

        const queryPrefix = /\?./.test(baseUrl) ? '&' : '?'

        return await fetch(baseUrl
            + (options?.parameters ? `${queryPrefix}${new URLSearchParams(options.parameters).toString()}` : ''),
            {
                method: options?.method?.toUpperCase() ?? 'POST',
                body: options?.body
                    ? ((typeof options.body) === 'object' ? JSON.stringify(options.body) : options.body)
                    : null,
                headers: options?.headers ?? {},
            }
        ).then(response => {
            if (response.ok) {
                const contentType = response.headers.get('content-type');
                if (contentType?.includes?.('application/json') || options?.responseType?.toUpperCase() === 'json') {
                    return response.text().then(responseText => JSON.parse(cleanServerResponse(responseText)));
                } else if (contentType?.includes?.('application/pdf') || contentType?.includes?.('image/')
                    || options?.responseType === 'blob') {
                    return response.blob();
                } else {
                    return response.text();
                }
            } else {
                throw new Error('Network error');
            }
        });
    }

    /**
     * NetSuite has a bad habit of appending HTML comments to the end of
     * response bodies at its own whims. This function removes them
     *
     * @param {string} responseContent
     * @returns {string}
     */
    function cleanServerResponse(responseContent) {
        const REVERSE_END_COMMENT_PATTERN = /^\s*>--(.*?)--!<\n?/;
        const REVERSE_COMMENT_OPEN_PATTERN = /--!</;

        let reversedContent = responseContent.split(/(?:)/u).reverse().join('');
        let currentMatch;
        do {
            currentMatch = reversedContent.match(REVERSE_END_COMMENT_PATTERN);

            if (currentMatch && REVERSE_COMMENT_OPEN_PATTERN.test(currentMatch[1])) {
                throw new Error('Insufficient RegEx design');
            } else if (currentMatch) {
                reversedContent = reversedContent.slice(currentMatch[0].length);
            }
        } while (currentMatch !== null)

        return reversedContent.split(/(?:)/u).reverse().join('');
    }

    function escapeHtml(unescaped, convertLineBreaks=false) {
        const escaped = `${unescaped}`.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#039;');

        return convertLineBreaks ? escaped.replace(/\n/g, '<br>') : escaped;
    }

    return { requestSuitelet, escapeHtml, };
});
