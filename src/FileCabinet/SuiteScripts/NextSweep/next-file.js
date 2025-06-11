/**
 *    __________ _ _____    ___
 *    \____   // ||   _  \  \  \
 *       /  //   ||  | \  \ |  |____       ___ __
 *     /  //  /  ||  |_/  //  // ___\___  / __\ |_
 *   /  //__/ |  ||   __//__/  \__ \/ . \|  _||  _|
 * /_________\|__||__| /__/(R)/____/\___/|_|  \__\
 *
 * NextSweep File Module: enhances the native N/file interface through
 * path-based file reference support and whole-folder operations
 *
 * ZAPentaleri, 2025
 *
 * @NApiVersion 2.1
 */

class SearchType {
    static ALL    = 'all';
    static FILE   = 'file';
    static FOLDER = 'folder';
}

class ResultType {
    static FILE   = 'file';
    static FOLDER = 'folder';
}

class SearchResult {
    constructor(path, type, id, name, folder, fileType) {
        this.path     = path;
        this.type     = type;
        this.id       = id;
        this.name     = name;
        this.folder   = folder;
        this.fileType = fileType;
    }
}

define(['N/file', 'N/query', 'N/record', 'N/search',], (file, query, record, search,) => {
    /**
     * Splits a File Cabinet path into individual folder names (and file name)
     *
     * @param {string} path Path
     * @returns {string[]}
     */
    function splitPath(path) {
        return path.split('/').filter((seg, index) => index > 0 || seg !== '');
    }

    /**
     * Joins an arbitrary number of arguments as a File Cabinet path
     *
     * @param {string[]} arguments Path segments
     * @returns {string}
     */
    function joinPath() {
        return [...arguments].reverse().reduce((path, arg) =>
            `${arg.trim().replace(/\/$/, '')}${path ? '/' : ''}${path}`,
        '',);
    }

    /**
     *
     * @param {object} options
     * @param {string|number} [options.baseFolder=0] Base search folder ID (0 = File Cabinet root)
     * @param {string|number} [options.id] Search folder ID
     * @param {string|string[]} [options.path] Search folder path
     * @param {boolean} [options.directChild=true] Search only direct children of base folder
     * @returns {SearchResult[]}
     */
    function getFolderSearchResults(options) {
        const DEFAULT_FETCH_DEPTH = 64;
        const TAB = '  ';
        const STRING_ESCAPE_SUBSTITUTIONS = [[/</g, '&lt;',], [/>/g, '&gt;',], [/'/g, '\'\'',],];
        const strEsc = name => STRING_ESCAPE_SUBSTITUTIONS.reduce((x, y_z) => x.replace(y_z[0], y_z[1]), name);

        const baseFolder = options.baseFolder ?? 0;
        const folderId = options.id ?? null;
        const folderPath = folderId === null ? options.path ?? [] : [];
        const directChild = options.directChild ?? true;

        if (folderId === null && folderPath.length === 0) throw new Error('No valid search query (ID or path)');

        const baseFolderIsRoot = [0, '0',].includes(baseFolder);
        const pathSegments = Array.isArray(folderPath) ? folderPath : splitPath(folderPath);
        const pathLength = pathSegments.length || 1;
        const pathQueryDepth = directChild ? pathLength : DEFAULT_FETCH_DEPTH;
        const reverseFolderIndices = Array.from({ length: pathQueryDepth, }, (_, i) => i,).reverse()

        const queryString = reverseFolderIndices.reduce((queryString, reverseIndex, forwardIndex,) => {
            const baseTabs = TAB.repeat(reverseIndex);
            if (forwardIndex === 0) {
                queryString = [
                    `${baseTabs}SELECT folder.id AS id_${reverseIndex}, folder.name AS name_${reverseIndex},`,
                    `${baseTabs}${TAB}root_folder.id AS root_id, root_folder.name AS root_name`,
                    `${baseTabs}FROM MediaItemFolder folder, MediaItemFolder root_folder`,
                    `${baseTabs}WHERE folder.parent = root_folder.id(+)`
                ].join('\n');
            } else {
                queryString = [
                    `${baseTabs}SELECT folder.id AS id_${reverseIndex}, folder.name AS name_${reverseIndex},`,
                    [...new Array(forwardIndex)].map((_, i) => i + reverseIndex + 1).map(i =>
                        `${baseTabs}${TAB}parents.id_${i} AS id_${i}, parents.name_${i} AS name_${i},`
                    ).join('\n'),
                    `${baseTabs}${TAB}parents.root_id AS root_id, parents.root_name AS root_name`,
                    `${baseTabs}FROM MediaItemFolder folder, (`,
                    queryString,
                    `${baseTabs}) parents`,
                    `${baseTabs}WHERE folder.parent = parents.id_${reverseIndex + 1}(+)`,
                ].join('\n');
            }

            if (reverseIndex === 0) {
                if (folderId !== null) {
                    queryString += `\n${TAB}AND folder.id = ${folderId}`;
                } else {
                    queryString += Array.from(
                        { length: pathLength, }, (_, i) => i,
                    ).reverse().map(folderIndex =>
                        ({ index: folderIndex, name: pathSegments[pathLength - folderIndex - 1], })
                    ).map(folderMapping => folderMapping.index === reverseIndex
                        ? `\n${TAB}AND folder.name = '${folderMapping.name}'`
                        : `\n${TAB}AND parents.name_${folderMapping.index} = '${strEsc(folderMapping.name)}'`
                    ).join('');
                }

                if (baseFolder !== null && directChild) {
                    // search only for direct children
                    queryString += (`\n${TAB}AND `
                        + (pathQueryDepth > 1 ? 'parents.root_id' : 'root_folder.id')
                        + (baseFolderIsRoot ? ' IS NULL' : ` = ${baseFolder}`));
                } else if (baseFolder !== null && !baseFolderIsRoot && reverseFolderIndices.length > pathLength) {
                    // search for any descendant
                    queryString += `\n${TAB}AND (\n${TAB+TAB}`
                        + reverseFolderIndices.filter(i => i >= pathLength).map(reverseIndex =>
                            `parents.id_${reverseIndex} = ${baseFolder}`
                        ).join(`\n${TAB+TAB}OR `) + `\n${TAB})`;
                }
            }

            return queryString;
        }, null,);

        return query.runSuiteQL({ query: queryString, }).asMappedResults().map(folderResult => new SearchResult(
            joinPath(...reverseFolderIndices.map(i => folderResult[`name_${i}`]).filter(name => name !== null)),
            ResultType.FOLDER,
            folderResult['id_0'].toString(),
            folderResult['name_0'],
            (folderResult['id_1'] ?? folderResult['root_id']).toString(),
        ));
    }

    /**
     * Search File Cabinet items by name
     *
     * @param {object} options
     * @param {string} [options.searchType=SearchType.FILE]
     * @param {string|number} [options.searchRoot=null]
     * @param {string} [options.path]
     * @param {string} [options.name]
     * @param {boolean} [options.directChildren=false]
     * @param {boolean} [options.pathMustBeRoot=false]
     * @returns {SearchResult[]}
     */
    function searchFileCabinet(options) {
        const searchType = options.searchType ?? SearchType.FILE;
        const searchTypeIsFile = [SearchType.ALL, SearchType.FILE,].includes(searchType);
        const searchTypeIsFolder = [SearchType.ALL, SearchType.FOLDER,].includes(searchType);
        const pathSegments = options.path ? splitPath(options.path) : [options.name];

        const folderResults = [];
        const fileResults = [];

        let fileName = null;
        const searchRoots = [];
        if (options.path || searchTypeIsFolder) {
            const searchBaseFolder = options.pathMustBeRoot ? 0 : null;
            const searchRequiredAncestor = options.searchRoot ? 0 : null;

            folderResults.push(...getFolderSearchResults({
                path: pathSegments,
                baseFolder: searchBaseFolder,
                requiredAncestor: searchRequiredAncestor,
            }));

            if (options.name || searchTypeIsFile) {
                if (pathSegments.length > 1)
                    searchRoots.push(...getFolderSearchResults({
                        path: pathSegments,
                        baseFolder: searchBaseFolder,
                        requiredAncestor: searchRequiredAncestor,
                    }));
                fileName = pathSegments.at(-1);
            }
        } else {
            fileName = options.name;
            if (options.searchRoot) searchRoots.push(options.searchRoot);
        }

        if (fileName !== null) {
            const searchRootMap = Object.fromEntries(searchRoots.map((accumulator, result) => [result.id, result,]));

            const colFileName   = search.createColumn({ name: 'name', sort: search.Sort.ASC, });
            const colFileParent = search.createColumn({ name: 'folder', });
            const colFileType   = search.createColumn({ name: 'filetype', });
            const fileSearchData = search.create({
                type: 'file',
                filters: [
                    ...(searchRoots.length > 0
                        ? [['folder', 'anyof', ...Object.keys(searchRootMap),], 'OR',]
                        : []),  //TODO: add support for null root if necessary
                    ['name', 'is', fileName,],
                ],
                columns: [colFileName, colFileParent, colFileType,],
            }).runPaged({ pageSize: 1000, });


            fileResults.push(...fileSearchData.pageRanges.flatMap(page =>
                fileSearchData.fetch({ index: page.index, })
            ).map(fileResult => new SearchResult(
                joinPath(searchRootMap[fileResult.getValue(colFileParent)], fileResult.getValue(colFileName),),
                ResultType.FILE,
                fileResult.id,
                fileResult.getValue(colFileName),
                fileResult.getValue(colFileType),
            )));
        }

        return [...folderResults, ...fileResults,]
    }

    function getFolderId(path) {
        return getFolderSearchResults({ path: path, baseFolder: 0, })?.[0] ?? null;
    }

    /**
     * Zoe please add details
     *
     * @param {object} options
     * @returns {file.File}
     */
    function copyFile(options) {
        //TODO: implement this
        return file.copy({
            ...options,
        });
    }

    /**
     * Zoe please add details
     *
     * @param {object} options
     * @returns {file.File}
     */
    function createFile(options) {
        //TODO: implement this
        return file.create({
            ...options,
        });
    }

    /**
     * Zoe please add details
     *
     * @param {object} options
     */
    function deleteFile(options) {
        //TODO: implement this
        return file.delete({
            ...options,
        });
    }

    /**
     * Zoe please add details
     *
     * @param {object} options
     * @returns {file.File}
     */
    function loadFile(options) {
        //TODO: implement this
        return file.load({
            ...options,
        });
    }

    /**
     * Zoe please add details
     *
     * @param {object} options
     * @param {string} [options.oldPath]
     * @param {string|number} [options.oldFolder]
     * @param {string} [options.oldName]
     * @param {string} [options.path]
     * @param {string|number} [options.id]
     * @param {string} [options.name]
     * @param {string} [options.newPath]
     * @param {string|number} [options.newFolder]
     * @param {string} [options.newName]
     * @returns {file.File}
     */
    function moveFile(options) {
        //TODO: implement this
        if ((typeof options.oldPath) === 'string' || (typeof options.path) === 'string') {
            const oldPath = options.oldPath ?? options.path;
        }

        let newFolderId = null;
        let fileId = null;
        return file.create({
            ...options,

        });
    }

    return {
        SearchType, ResultType,
        splitPath, joinPath, getFolderId,
        copy: copyFile, create: createFile, load: loadFile, move: moveFile, delete: deleteFile,
    };  //TODO: add folder functions
});
