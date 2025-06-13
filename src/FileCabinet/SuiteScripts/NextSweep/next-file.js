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
    static ALL    = 'ALL';
    static FILE   = 'FILE';
    static FOLDER = 'FOLDER';
}

class ResultType {
    static FILE   = 'FILE';
    static FOLDER = 'FOLDER';
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
        // constants
        const DEFAULT_FETCH_DEPTH = 24;
        const TAB = '  ';
        const ESCAPE_CHAR = '\\';
        const STRING_ESCAPE_SUBS = [[/</g, `&lt;`,], [/>/g, `&gt;`,], [/'/g, `''`,],];
        const LIKE_ESCAPE_SUBS = [
            [/</g, `&lt;`,], [/>/g, `&gt;`,],
            [/\\/g, `\\\\`,], [/%/g, `\\%`,], [/_/g, `\\_`,],
            [/'/g, `''`,],
        ];

        // SQL string escape functions
        const stringEscape = name => STRING_ESCAPE_SUBS.reduce((x, y_z) => x.replace(y_z[0], y_z[1]), name);
        const likeEscape = name => LIKE_ESCAPE_SUBS.reduce((x, y_z) => x.replace(y_z[0], y_z[1]), name);

        // parameters
        const baseFolder = options.baseFolder?.toString() ?? '0';
        const folderIds = (typeof options.ids) !== 'undefined' ? [].concat(options.ids) : [];
        const pathSegments = options.path ? (Array.isArray(options.path) ? options.path : splitPath(options.path)) : [];
        const directChild = options.directChild ?? true;
        const fetchDepth = options.fetchDepth ?? DEFAULT_FETCH_DEPTH;
        const substring = options.substring ?? false;
        const caseInsensitive = options.caseInsensitive ?? false;

        // validation
        if (folderIds.length === 0 && pathSegments.length === 0) throw new Error('No valid search query (IDs or path)');
        if (substring && pathSegments.length !== 1) throw new Error('Invalid parameters for substring search');

        // parameter-derived values
        const baseFolderIsRoot = baseFolder === '0';
        const pathLength = pathSegments.length || 1;
        const queryDepth = (directChild && baseFolderIsRoot) ? pathLength : Math.max(fetchDepth, pathLength);
        const folderIndices = Array.from({ length: queryDepth, }, (_, i) => i,);
        const reverseFolderIndices = [...folderIndices].reverse();

        // create SQL query
        const queryString = reverseFolderIndices.reduce((queryString, reverseIndex, forwardIndex,) => {
            const baseTabs = TAB.repeat(reverseIndex);
            if (forwardIndex === 0) {
                // deepest level of nested query
                queryString = [
                    `${baseTabs}SELECT folder.id AS id_${reverseIndex}, folder.name AS name_${reverseIndex},`,
                    `${baseTabs}${TAB}root_folder.id AS root_id, root_folder.name AS root_name`,
                    `${baseTabs}FROM MediaItemFolder folder, MediaItemFolder root_folder`,
                    `${baseTabs}WHERE folder.parent = root_folder.id(+)`
                ].join('\n');
            } else {
                // other levels of nested query
                queryString = [
                    ...(reverseIndex === 0
                        ? [
                            `${baseTabs}SELECT folder.foldertype AS type,`,
                            `${baseTabs}${TAB}folder.id AS id_${reverseIndex}, folder.name AS name_${reverseIndex},`,
                        ]
                        : [`${baseTabs}SELECT folder.id AS id_${reverseIndex}, folder.name AS name_${reverseIndex},`,]),
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

            // append WHERE clauses at end of query
            if (reverseIndex === 0) {
                // folder ID criteria
                if (folderIds.length === 1) {
                    queryString += `\n${TAB}AND folder.id = ${folderIds[0]}`;
                } else if (folderIds.length > 1) {
                    queryString += `\n${TAB}AND (` + folderIds.map((folderId, index) =>
                        `\n${TAB+TAB}${index > 0 ? 'OR ' : ''}folder.id = ${folderId}`
                    ).join('') + `\n${TAB})`;
                }

                // folder name criteria
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

                // folder ancestor criteria
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

        // execute query and map results to an array of SearchResult instances
        return query.runSuiteQL({ query: queryString, }).asMappedResults().map(folderResult => new SearchResult(
            // ^^^ ID sequence path ^^^
            reverseFolderIndices.map(i => folderResult[`id_${i}`]).filter(id => id !== null).map(i => i.toString()),
            // ^^^ human-readable path ^^^
            joinPath(...reverseFolderIndices.map(i => folderResult[`name_${i}`]).filter(name => name !== null)),
            ResultType.FOLDER,                // result type
            folderResult['id_0'].toString(),  // folder ID
            folderResult['name_0'],           // folder name
            (folderResult['id_1'] ?? folderResult['root_id'])?.toString() ?? null,  // folder parent folder
            folderResult['type'],             // folder type
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
        // parameters
        const searchType = options.type?.toUpperCase() ?? SearchType.FILE;
        const searchTypeIsFile = [SearchType.ALL, SearchType.FILE,].includes(searchType);
        const searchTypeIsFolder = [SearchType.ALL, SearchType.FOLDER,].includes(searchType);
        const itemIds = options.ids ? [].concat(options.ids) : [];
        const pathSegments = options.path ? (Array.isArray(options.path) ? options.path : splitPath(options.path)) : [];
        const baseFolder = options.baseFolder?.toString() ?? '0';
        const directChild = options.directChild ?? true;
        const substring = options.substring ?? false;
        const caseInsensitive = options.caseInsensitive ?? false;

        // parameter-derived values
        const baseFolderIsRoot = baseFolder === '0';

        // validation
        if (searchTypeIsFile && directChild && baseFolderIsRoot)
            throw new Error('Files may not be direct children of the File Cabinet root');
        if (itemIds.length > 0 && pathSegments.length > 0)
            throw new Error('IDs and path must not be provided together');
        if (itemIds.length === 0 && pathSegments.length === 0) throw new Error('No valid search query (IDs or path)');
        if (substring && pathSegments.length !== 1) throw new Error('Invalid parameters for substring search');

        // file search
        const fileMap = [];
        if (searchTypeIsFile) {
            // create file search
            const fileSearchData = search.create({
                type: 'file',
                filters: [
                    // important note for below: S.Search "folder" filter compares ALL ancestors, not only direct parent
                    ...(!baseFolderIsRoot ? [['folder', 'is', baseFolder,], 'AND',] : []),
                    (itemIds.length > 0
                        ? ['internalid', 'anyof', ...itemIds,]
                        : ['name', (substring ? 'contains' : 'is'), pathSegments.at(-1),]),  // case-insensitive filter
                ],
                columns: ['name', 'folder', 'filetype',],
            }).runPaged({ pageSize: 1000, });

            // execute file search, mapping results to fileMap
            fileMap.push(...fileSearchData.pageRanges.flatMap(page =>
                fileSearchData.fetch({ index: page.index, }).data
            ).map(fileResult => ({
                id:          fileResult.id,
                name:        fileResult.getValue('name'),
                parent_id:   fileResult.getValue('folder'),
                parent_name: fileResult.getValue('folder'),
                subtype:     fileResult.getValue('filetype'),
            })).filter(fileMapping =>
                caseInsensitive || pathSegments.length === 0 || fileMapping.name === pathSegments.at(-1)  // case valid.
            ).filter(fileMapping =>
                !directChild || fileMapping.parent_id === baseFolder  // direct child valid. (filter alone is indirect)
            ));
        }

        // search file parent folders to get complete paths
        const parentFolderIDs = [...new Set(fileMap.map(fileMapping => fileMapping.parent_id))];
        const parentResults = [];
        if (searchTypeIsFile) {
            if (pathSegments.length > 1) {
                // folder path segments (past file name) provided, get validating matches against parent folder IDs
                parentResults.push(...querySearchFolder({
                    baseFolder: baseFolder,
                    ids: parentFolderIDs,
                    path: pathSegments.slice(0, -1),  // IDs *and* path provided to ensure only doubly matched results
                    directChild: directChild,
                    caseInsensitive: caseInsensitive,
                }));
            } else if (parentFolderIDs.length > 0) {
                // folder path segments not provided, get any matches for parent IDs
                parentResults.push(...querySearchFolder({ ids: parentFolderIDs, }));
            }
        }

        // map parent results by ID
        const parentMap = Object.fromEntries(parentResults.map(result => [result.id, result,]));

        // map all results, filtering files for legal parents
        return [
            ...(searchTypeIsFolder ? querySearchFolder({
                baseFolder: baseFolder,
                ids: itemIds,
                path: pathSegments,
                directChild: directChild,
                substring: substring,
                caseInsensitive: caseInsensitive,
            }) : []),
            ...fileMap.filter(fileMapping =>
                parentMap.hasOwnProperty(fileMapping.parent_id)  // filter files by parent map keys (parent folder IDs)
            ).map(fileMapping => new SearchResult(
                [...parentMap[fileMapping.parent_id].idPath, fileMapping.id,],       // ID sequence path
                joinPath(parentMap[fileMapping.parent_id].path, fileMapping.name,),  // human-readable path
                ResultType.FILE,        // result type
                fileMapping.id,         // file ID
                fileMapping.name,       // file name
                fileMapping.parent_id,  // file parent folder
                fileMapping.subtype,    // file subtype
            )),
        ]
    }

    /**
     * Searches the File Cabinet for files or folders
     *
     * @param {object} options
     * @param {string} [options.type=SearchType.FILE]
     * @param {string} options.query
     * @param {string|number} [options.baseFolder]
     * @param {boolean} [options.directChild=false]
     * @param {boolean} [options.caseSensitive=false]
     * @param {boolean} [options.exactMatch=false]
     */
    function searchExternal(options) {
        return searchInternal({
            type: options.type ?? SearchType.FILE,
            path: options.query,
            baseFolder: options.baseFolder ?? '0',
            directChild: options.directChild ?? false,
            caseInsensitive: (typeof options.caseSensitive) === 'boolean'
                ? !options.caseSensitive
                : ((typeof options.exactMatch) === 'boolean' ? !options.exactMatch : true),
            substring: (typeof options.exactMatch) === 'boolean' ? !options.exactMatch : true,
        })
    }

    function getFolderId(path) { return searchInternal({ path: path, type: SearchType.FOLDER, })?.[0]?.id ?? null; }
    function getFileId(path) {
        if (!/\//.test(path)) return null;
        try { return file.load({ id: path, }).id; }
        catch { return null; }
    }
    function getFolderPath(id) { return searchInternal({ ids: id, type: SearchType.FOLDER, })?.[0]?.path ?? null; }
    function getFilePath(id) { return searchInternal({ ids: id, type: SearchType.FILE, })?.[0]?.path ?? null; }

    /**
     * Copies a file to a different folder in the File Cabinet, optionally with
     * a new name
     *
     * @param {object} options
     * @param {string|number} [options.id] Existing file ID
     * @param {string} [options.path] Existing file path
     * @param {string|number} [options.folder] ID of folder to which file should be copied (must be different from
     *     original)
     * @param {string} [options.folderPath] Path of folder to which file should be copied (must be different from
     *     original)
     * @param {string} [options.newPath] New path to which file should be copied (folder must be different from
     *     original)
     * @param {string} [options.conflictResolution]
     * @returns {file.File}
     */
    function copyFile(options) {
        //TODO: add support for copying into original folder
        const fileId = options.id ?? getFileId(options.path);
        const folderId = options.folder
            ? options.folder
            : getFolderId(options.folderPath ?? splitPath(options.newPath).slice(0, -1));
        const newName = options.newPath ? splitPath(options.newPath).at(-1) : null;

        let newFile = file.copy({ id: fileId, folder: folderId, conflictResolution: options.conflictResolution, });
        if (newName !== null) {
            newFile.name = newName;
            newFile = file.load({ id: newFile.save(), });
        }

        return newFile;
    }

    /**
     * Instantiates a new File object
     *
     * @param {object} options
     * @param {string} options.name
     * @param {string} options.fileType
     * @param {string} options.contents
     * @param {string|number} [options.folder]
     * @param {string} [options.folderPath]
     * @returns {file.File}
     */
    function createFile(options) {
        return file.create({
            ...options,
            folder: (typeof (options.folder ?? options.folderPath)) !== 'undefined'
                ? options.folder ?? getFolderId(options.folderPath)
                : undefined,
        });
    }

    /**
     * Deletes a file from the File Cabinet
     *
     * @param {object} options
     * @param {string|number} [options.id]
     * @param {string} [options.path]
     */
    function deleteFile(options) {
        file.delete({ id: options.id ?? getFileId(options.path), });
    }

    /**
     * Loads a file from the File Cabinet
     *
     * @param {object} options
     * @param {string|number} [options.id]
     * @param {string} [options.path]
     * @returns {file.File}
     */
    function loadFile(options) {
        return file.load({ id: options.id ?? options.path, });
    }

    /**
     * Moves a file within the File Cabinet
     *
     * @param {object} options
     * @param {string|number} [options.id]
     * @param {string} [options.path]
     * @param {string|number} [options.newFolder]
     * @param {string} [options.newName]
     * @param {string} [options.newPath]
     * @returns {number}
     */
    function moveFile(options) {
        const newFolderId = (options.newFolder || options.newPath)
            ? options.newFolder || getFolderId(options.newPath.slice(0, -1))
            : null;
        const newName = (options.newName || options.newPath) ? options.newName ?? options.newPath.at(-1) : null;

        const oldFile = file.load({ id: options.id ?? options.path, });
        if (newFolderId) oldFile.folder = newFolderId;
        if (newName) oldFile.name = newName;
        return oldFile.save();
    }

    return {
        SearchType, ResultType,
        splitPath, joinPath, getFolderId, getFileId, getFolderPath, getFilePath,
        copy: copyFile, create: createFile, load: loadFile, move: moveFile, delete: deleteFile,
        search: searchExternal,
    };  //TODO: add folder functions
});
