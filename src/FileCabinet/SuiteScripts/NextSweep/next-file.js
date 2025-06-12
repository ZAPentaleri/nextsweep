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
    constructor(idPath, path, type, id, name, folder, subtype) {
        this.idPath  = idPath;
        this.path    = path;
        this.type    = type;
        this.id      = id;
        this.name    = name;
        this.folder  = folder;
        this.subtype = subtype;
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
     * @param {string|number|string[]|number[]} [options.ids] Search folder ID(s)
     * @param {string|string[]} [options.path] Search folder path
     * @param {number} [options.fetchDepth=24] The number of folders to query (fetchDepth-1 ancestors of target)
     * @param {boolean} [options.directChild=true] Search only direct children of base folder
     * @param {boolean} [options.substring=false] Search path by substring (path must only represent last segment)
     * @param {boolean} [options.caseInsensitive=false] Makes path search case-insensitive
     * @returns {SearchResult[]}
     */
    function querySearchFolder(options) {
        const DEFAULT_FETCH_DEPTH = 24;
        const TAB = '  ';
        const ESCAPE_CHAR = '\\';
        const STRING_ESCAPE_SUBS = [[/</g, `&lt;`,], [/>/g, `&gt;`,], [/'/g, `''`,],];
        const LIKE_ESCAPE_SUBS = [[/</g, `&lt;`,], [/>/g, `&gt;`,], [/\\/g, `\\\\`,], [/%/g, `\\%`,], [/_/g, `\\_`,],];
        const stringEscape = name => STRING_ESCAPE_SUBS.reduce((x, y_z) => x.replace(y_z[0], y_z[1]), name);
        const likeEscape = name => LIKE_ESCAPE_SUBS.reduce((x, y_z) => x.replace(y_z[0], y_z[1]), name);

        const baseFolder = options.baseFolder?.toString() ?? '0';
        const folderIds = (typeof options.ids) !== 'undefined' ? [].concat(options.ids) : [];
        const pathSegments = options.path ? (Array.isArray(options.path) ? options.path : splitPath(options.path)) : [];
        const directChild = options.directChild ?? true;
        const fetchDepth = options.fetchDepth ?? DEFAULT_FETCH_DEPTH;
        const substring = options.substring ?? false;
        const caseInsensitive = options.caseInsensitive ?? false;

        if (folderIds.length === 0 && pathSegments.length === 0) throw new Error('No valid search query (IDs or path)');
        if (substring && pathSegments.length !== 1) throw new Error('Invalid parameters for substring search');

        const baseFolderIsRoot = baseFolder === '0';
        const pathLength = pathSegments.length || 1;
        const queryDepth = (directChild && baseFolderIsRoot) ? pathLength : Math.max(fetchDepth, pathLength);
        const folderIndices = Array.from({ length: queryDepth, }, (_, i) => i,);
        const reverseFolderIndices = [...folderIndices].reverse();

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
                if (folderIds.length === 1) {
                    queryString += `\n${TAB}AND folder.id = ${folderIds[0]}`;
                } else if (folderIds.length > 1) {
                    queryString += `\n${TAB}AND (` + folderIds.map((folderId, index) =>
                        `\n${TAB+TAB}${index > 0 ? 'OR ' : ''}folder.id = ${folderId}`
                    ).join('') + `\n${TAB})`;
                }

                if (pathSegments.length > 0) {
                    queryString += Array.from({ length: pathLength, }, (_, i) => i,).map(folderIndex =>
                        ({ index: folderIndex, name: pathSegments[pathLength - folderIndex - 1], })
                    ).map(nameMapping => {
                        const fieldName =
                            nameMapping.index === reverseIndex ? 'folder.name' : `parents.name_${nameMapping.index}`;
                        const escValue = substring ? likeEscape(nameMapping.name) : stringEscape(nameMapping.name);

                        return substring
                            ? caseInsensitive
                                ? `\n${TAB}AND UPPER(${fieldName}) LIKE UPPER('%${escValue}%') ESCAPE '${ESCAPE_CHAR}'`
                                : `\n${TAB}AND ${fieldName} LIKE '%${escValue}%' ESCAPE '${ESCAPE_CHAR}'`
                            : caseInsensitive
                                ? `\n${TAB}AND UPPER(${fieldName}) = UPPER('${escValue}')`
                                : `\n${TAB}AND ${fieldName} = '${escValue}'`;
                    }).join('');
                }

                if (baseFolder !== null && directChild) {
                    // search only for direct children
                    const fieldName = queryDepth === pathLength
                        ? (queryDepth === 1 ? 'root_folder.id' : 'parents.root_id')
                        : `id_${pathLength}`;

                    queryString += `\n${TAB}AND ${fieldName} ${baseFolderIsRoot ? 'IS NULL' : `= ${baseFolder}`}`;
                } else if (baseFolder !== null && !baseFolderIsRoot && queryDepth > pathLength) {
                    // search for any descendant
                    queryString += `\n${TAB}AND (` + folderIndices.filter(i => i >= pathLength).map(index =>
                        `\n${TAB+TAB}${index > pathLength ? 'OR ' : ''}parents.id_${index} = ${baseFolder}`
                    ).join('') + `\n${TAB})`;
                }
            }

            return queryString;
        }, null,);

        return query.runSuiteQL({ query: queryString, }).asMappedResults().map(folderResult => new SearchResult(
            reverseFolderIndices.map(i => folderResult[`id_${i}`]).filter(id => id !== null).map(i => i.toString()),
            joinPath(...reverseFolderIndices.map(i => folderResult[`name_${i}`]).filter(name => name !== null)),
            ResultType.FOLDER,
            folderResult['id_0'].toString(),
            folderResult['name_0'],
            (folderResult['id_1'] ?? folderResult['root_id'])?.toString() ?? null,
        ));
    }

    /**
     * Searches the File Cabinet for files or folders (internal interface)
     *
     * @param {object} options
     * @param {string} [options.type=SearchType.FILE]
     * @param {string|number|string[]|number[]} [options.ids]
     * @param {string} [options.path]
     * @param {string|number} [options.baseFolder=0] Base search folder ID (0 = File Cabinet root)
     * @param {boolean} [options.directChild=true] Search only direct children of base folder
     * @param {boolean} [options.substring=false] Search path by substring (path must only represent last segment)
     * @param {boolean} [options.caseInsensitive=false] Makes path search case-insensitive
     * @returns {SearchResult[]}
     */
    function searchInternal(options) {
        //TODO: add support for substring search
        const searchType = options.type ?? SearchType.FILE;
        const searchTypeIsFile = [SearchType.ALL, SearchType.FILE,].includes(searchType);
        const searchTypeIsFolder = [SearchType.ALL, SearchType.FOLDER,].includes(searchType);
        const itemIds = options.ids ? [].concat(options.ids) : [];
        const pathSegments = options.path ? (Array.isArray(options.path) ? options.path : splitPath(options.path)) : [];
        const baseFolder = options.baseFolder?.toString() ?? '0';
        const directChild = options.directChild ?? true;
        const substring = options.substring ?? false;
        const caseInsensitive = options.caseInsensitive ?? false;

        const baseFolderIsRoot = baseFolder === '0';
        if (directChild && baseFolderIsRoot)
            throw new Error('Files may not be direct children of the File Cabinet root');
        if (itemIds.length > 0 && pathSegments.length > 0)
            throw new Error('IDs and path must not be provided together');
        if (itemIds.length === 0 && pathSegments.length === 0) throw new Error('No valid search query (IDs or path)');
        if (substring && pathSegments.length !== 1) throw new Error('Invalid parameters for substring search');

        const fileMap = [];
        if (searchTypeIsFile) {
            const fileSearchData = search.create({
                type: 'file',
                filters: [
                    ...(!baseFolderIsRoot ? [['folder', 'is', baseFolder,], 'AND',] : []),
                    (itemIds.length > 0
                        ? ['internalid', 'anyof', ...itemIds,]
                        : ['name', (substring ? 'contains' : 'is'), pathSegments.at(-1),]),
                ],
                columns: ['name', 'folder', 'filetype',],
            }).runPaged({ pageSize: 1000, });

            fileMap.push(...fileSearchData.pageRanges.flatMap(page =>
                fileSearchData.fetch({ index: page.index, }).data
            ).map(fileResult => ({
                id:          fileResult.id,
                name:        fileResult.getValue('name'),
                parent_id:   fileResult.getValue('folder'),
                parent_name: fileResult.getValue('folder'),
                subtype:     fileResult.getValue('filetype'),
            })).filter(fileMapping =>
                caseInsensitive || pathSegments.length === 0 || fileMapping.name === pathSegments.at(-1)
            ).filter(fileMapping =>
                !directChild || fileMapping.parent_id === baseFolder
            ));
        }

        const parentFolderIDs = [...new Set(fileMap.map(fileMapping => fileMapping.parent_id))];
        const parentResults = [];
        if (searchTypeIsFile) {
            if (pathSegments.length > 1) {
                parentResults.push(...querySearchFolder({
                    baseFolder: baseFolder,
                    ids: parentFolderIDs,
                    path: pathSegments.slice(0, -1),
                    directChild: directChild,
                }));
            } else if (parentFolderIDs.length > 0) {
                parentResults.push(...querySearchFolder({ ids: parentFolderIDs, }));
            }
        }

        const parentMap = Object.fromEntries(parentResults.map(result => [result.id, result,]));

        return [
            ...(searchTypeIsFolder ? querySearchFolder({
                baseFolder: baseFolder,
                ids: itemIds,
                path: pathSegments,
                directChild: directChild,
            }) : []),
            ...fileMap.filter(fileMapping =>
                parentMap.hasOwnProperty(fileMapping.parent_id)
            ).map(fileMapping => new SearchResult(
                [...parentMap[fileMapping.parent_id].idPath, fileMapping.id,],
                joinPath(parentMap[fileMapping.parent_id].path, fileMapping.name,),
                ResultType.FILE, fileMapping.id, fileMapping.name, fileMapping.parent_id, fileMapping.subtype,
            )),
        ]
    }

    function getFolderId(path) { return searchInternal({ path: path, type: SearchType.FOLDER, })?.[0]?.id ?? null; }
    function getFileId(path) { return searchInternal({ path: path, type: SearchType.FILE, })?.[0]?.id ?? null; }
    function getFolderPath(id) { return searchInternal({ ids: id, type: SearchType.FOLDER, })?.[0]?.path ?? null; }
    function getFilePath(id) { return searchInternal({ ids: id, type: SearchType.FILE, })?.[0]?.path ?? null; }

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
