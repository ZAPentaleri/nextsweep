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

const FILE_ERR_NAME = 'NEXT_FILE_ERROR';

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

define(['N/error', 'N/file', 'N/query', 'N/record', 'N/search',], (error, file, query, record, search,) => {
    /**
     * Splits a File Cabinet path into individual folder names (and file name)
     *
     * @param {string} path Path
     * @returns {string[]}
     */
    function splitPath(path) {
        return Array.isArray(path) ? path : (path.split('/').filter((seg, index) => index > 0 || seg !== ''));
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
        if (folderIds.length === 0 && pathSegments.length === 0)
            throw error.create({ message: 'No valid search query (IDs or path)', name: FILE_ERR_NAME, });
        if (substring && pathSegments.length !== 1)
            throw error.create({ message: 'Invalid parameters for substring search', name: FILE_ERR_NAME, });

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
                    `${baseTabs}SELECT folder.foldertype AS type,`,
                    `${baseTabs}${TAB}folder.id AS id_${reverseIndex}, folder.name AS name_${reverseIndex},`,
                    `${baseTabs}${TAB}root_folder.id AS root_id, root_folder.name AS root_name`,
                    `${baseTabs}FROM MediaItemFolder folder, MediaItemFolder root_folder`,
                    `${baseTabs}WHERE folder.parent = root_folder.id(+)`
                ].join('\n');
            } else {
                // other levels of nested query
                queryString = [
                    ...(reverseIndex === 0
                        ? [ `${baseTabs}SELECT folder.foldertype AS type,`,
                            `${baseTabs}${TAB}folder.id AS id_${reverseIndex}, folder.name AS name_${reverseIndex},`,]
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
        if (searchTypeIsFile && directChild && baseFolderIsRoot && pathSegments.length < 2) throw error.create({
            message: 'Files may not be direct children of the File Cabinet root', name: FILE_ERR_NAME, });
        if (itemIds.length > 0 && pathSegments.length > 0)
            throw error.create({ message: 'IDs and path must not be provided together', name: FILE_ERR_NAME, });
        if (itemIds.length === 0 && pathSegments.length === 0)
            throw error.create({ message: 'No valid search query (IDs or path)', name: FILE_ERR_NAME, });
        if (substring && pathSegments.length !== 1)
            throw error.create({ message: 'Invalid parameters for substring search', name: FILE_ERR_NAME, });

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
            })).filter(fileMapping =>  // case validation
                caseInsensitive || pathSegments.length === 0 || fileMapping.name === pathSegments.at(-1)
            ).filter(fileMapping =>  // direct child validation (filter itself is indirect)
                !directChild || baseFolderIsRoot || fileMapping.parent_id === baseFolder
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
        try { return file.load({ id: path, }).id.toString(); }  // try to shortcut by loading file (server only)
        catch (loadError) { return loadError.name !== 'RCRD_DSNT_EXIST'  // check error name for implicit server context
            ? searchInternal({ path: path, type: SearchType.FILE, })?.[0]?.id ?? null  // not server context, run search
            : null;  // server context, return null
        }
    }
    function getFolderPath(id) { return searchInternal({ ids: id, type: SearchType.FOLDER, })?.[0]?.path ?? null; }
    function getFilePath(id) { return searchInternal({ ids: id, type: SearchType.FILE, })?.[0]?.path ?? null; }
    function getFolderName(id) {
        return search.lookupFields({ type: search.Type.FOLDER, id: id, columns: ['name'], })?.['name'] ?? null;
    }
    function getFileName(id) {
        return search.lookupFields({ type: 'file', id: id, columns: ['name'], })?.['name'] ?? null;
    }

    /**
     * Reduces parameters to item (file or folder) ID, folder (parent) ID, and
     * name. Only ONE parameter to identify any given value may be passed to
     * avoid result inconsistency (mismatched name, folder, etc)
     *
     * Value derivation options:
     *     folderId: id, path, folder, folderPath
     *     itemId:   id, path, name (with folderId)
     *     itemName: id, path, name
     *
     * @param {object} options
     * @param {string} [options.path]
     * @param {string|number} [options.id]
     * @param {string} [options.name]
     * @param {string|number} [options.folder]
     * @param {string} [options.folderPath]
     * @param {boolean} [options.itemExists=false]
     * @param {boolean} [options.itemIsFolder=false]
     * @returns {(string|null)[]}
     */
    function reduceItemIds(options) {
        const itemExists = options.itemExists ?? false;
        const itemIsFolder = options.itemIsFolder ?? false;

        for (const parameterSet
            of [
                ['parent folder ID', options.id, options.path, options.folder, options.folderPath,],
                [`${itemIsFolder ? 'folder' : 'file'} ID`, options.id, options.path, options.name,],
                [`${itemIsFolder ? 'folder' : 'file'} name`, options.id, options.path, options.name,],
        ]) {
            if (parameterSet.slice(1).filter(x => (x ?? null) !== null).length > 1) throw error.create({
                message: `Too many parameters for ${parameterSet[0]} derivation: [${parameterSet.slice(1).join(', ')}]`,
                name: FILE_ERR_NAME, });
        }

        let folderId = null;
        let itemId = null;
        let itemName = null;

        if (options.folder) folderId = options.folder.toString();
        if (options.id) itemId = options.id.toString();
        if (options.name || options.path) itemName = options.name || splitPath(options.path).at(-1);

        if (!itemId && itemExists && options.path) {
            const searchResults = searchInternal({
                type: (itemIsFolder ? SearchType.FOLDER : SearchType.FILE), path: options.path,
            });
            itemId = searchResults?.[0]?.id;
            folderId = searchResults?.[0]?.folder;

            if (itemId === null) throw error.create({
                message: `Path did not resolve to an existing ${itemIsFolder ? 'folder' : 'file'}`,
                name: FILE_ERR_NAME, });
        }

        if (!folderId && options.path && splitPath(options.path).length > 1) {
            folderId = getFolderId(splitPath(options.path).slice(0, -1));
            if (folderId === null) throw error.create({
                message: 'Path segment did not resolve to an existing folder', name: FILE_ERR_NAME, });
        } else if (!folderId && options.folderPath) {
            folderId = getFolderId(options.folderPath);
            if (folderId === null) throw error.create({
                message: 'Folder path did not resolve to an existing folder', name: FILE_ERR_NAME, });
        }

        if (!itemId && folderId && itemExists && options.name) {
            const searchResults = searchInternal({
                type: (itemIsFolder ? SearchType.FOLDER : SearchType.FILE), baseFolder: folderId, path: options.name,
            });
            itemId = searchResults?.[0]?.id;

            if (itemId === null) throw error.create({
                message: `Name did not resolve to an existing ${itemIsFolder ? 'folder' : 'file'}`,
                name: FILE_ERR_NAME, });
        }

        if (itemId && itemName === null) itemName = itemIsFolder ? getFolderName(itemId) : getFileName(itemId);

        if (itemExists && itemId === null) throw error.create({
            message: `${itemIsFolder ? 'Folder' : 'File'} could not be found`, name: FILE_ERR_NAME, });
        if (!itemExists && itemId !== null) throw error.create({
            message: `Nominally nonexistent ${itemIsFolder ? 'folder' : 'file'} was found`, name: FILE_ERR_NAME, });

        return [folderId, itemId, itemName,];
    }

    /**
     * Copies a file to a different folder in the File Cabinet, optionally with
     * a new name
     *
     * @param {object} options
     * @param {string} [options.path] Original file path
     * @param {string|number} [options.id] Original file ID
     * @param {string} [options.name] Original file name
     * @param {string|number} [options.folder] Original folder ID
     * @param {string} [options.folderPath] Original folder path
     * @param {string} [options.copyPath] Copied file path
     * @param {string} [options.copyName] Copied file path
     * @param {string|number} [options.copyFolder] Copied file folder ID
     * @param {string} [options.copyFolderPath] Copied file folder path
     * @param {string} [options.conflictResolution]
     * @returns {File}
     */
    function copyFile(options) {
        const originalFile = loadFile(options);
        const originalId = originalFile.id.toString();
        const originalName = originalFile.name;
        const originalFolderId = originalFile.folder.toString();

        const [copyFolderId, _, copyName] = reduceItemIds({
            path: options.copyPath, name: options.copyName,
            folder: options.copyFolder, folderPath: options.copyFolderPath,
        });

        if (copyName === originalName && originalFolderId === copyFolderId)
            throw error.create({ message: 'Can not copy file to its original location', name: FILE_ERR_NAME, });

        const tempFolderName = copyFolderId === originalFolderId ? `TEMP_${new Date().getTime()}` : null;
        const tempFolderId =
            tempFolderName !== null ? createFolder({ folder: copyFolderId, name: tempFolderName }) : null;

        let newFile = file.copy({
            id: originalId, folder: tempFolderId ?? copyFolderId,
            conflictResolution: options.conflictResolution,
        });

        if (copyName !== null && copyName !== originalName) newFile.name = copyName;
        if (tempFolderId !== null) {
            newFile.folder = copyFolderId;
            deleteFolder({ id: tempFolderId, })
        }

        return (tempFolderId === null && copyName === null) ? newFile : file.load({ id: newFile.save(), });
    }

    /**
     * Instantiates a new File object
     *
     * @param {object} options
     * @param {string} [options.path] New file path
     * @param {string} [options.name] New file name
     * @param {string|number} [options.folder] Folder ID
     * @param {string} [options.folderPath] Folder path
     * @param {string} options.fileType New file type
     * @param {string} options.contents New file contents
     * @returns {File}
     */
    function createFile(options) {
        const [folderId, _, name] = reduceItemIds({ ...options, });
        return file.create({ ...options, folder: folderId, name: name, });
    }

    /**
     * Deletes a file from the File Cabinet
     *
     * @param {object} options
     * @param {string|number} [options.path] File path
     * @param {string|number} [options.id] File ID
     * @param {string} [options.name] File name
     * @param {string|number} [options.folder] Folder ID
     * @param {string} [options.folderPath] Folder path
     */
    function deleteFile(options) {
        file.delete({ id: reduceItemIds({ ...options, itemExists: true, })[1], });
    }

    /**
     * Loads a file from the File Cabinet
     *
     * @param {object} options
     * @param {string|number} [options.path] File path
     * @param {string|number} [options.id] File ID
     * @param {string} [options.name] File name
     * @param {string|number} [options.folder] Folder ID
     * @param {string} [options.folderPath] Folder path
     * @returns {File}
     */
    function loadFile(options) {
        return file.load({ id: reduceItemIds({ ...options, itemExists: true, })[1], });
    }

    /**
     * Moves a file within the File Cabinet
     *
     * @param {object} options
     * @param {string|number} [options.path] Initial path
     * @param {string|number} [options.id] File ID
     * @param {string} [options.name] Initial name
     * @param {string|number} [options.folder] Initial folder ID
     * @param {string} [options.folderPath] Initial folder path
     * @param {string} [options.newPath] New path
     * @param {string} [options.newName] New name
     * @param {string|number} [options.newFolder] New folder ID
     * @param {string} [options.newFolderPath] New folder path
     * @returns {string}
     */
    function moveFile(options) {
        const [newFolderId, _, newName] = reduceItemIds({
            path: options.newPath, name: options.newName,
            folder: options.newFolder, folderPath: options.newFolderPath
        });

        const oldFile = loadFile(options);
        if ((newFolderId === null && newName === null)
            || (newFolderId === oldFile.id.toString() && newName === oldFile.name))
            throw error.create({ message: 'Can not move file to its original location', name: FILE_ERR_NAME, });

        if (newFolderId) oldFile.folder = newFolderId;
        if (newName) oldFile.name = newName;
        return oldFile.save().toString();
    }

    /**
     * Creates a new folder in the File Cabinet
     *
     * @param {object} options
     * @param {string|number} [options.path] New folder path
     * @param {string} [options.name] New folder name
     * @param {string|number} [options.folder] Parent folder ID
     * @param {string} [options.folderPath] Parent folder path
     * @param {boolean} [options.recursive=false] Create folder recursively
     * @returns {string}
     */
    function createFolder(options) {
        let [parentFolderId, folderName] = null;
        try {
            [parentFolderId, _, folderName] = reduceItemIds({ ...options, itemIsFolder: true, });
        } catch {
            if (options.recursive ?? false) {
                parentFolderId =
                    createFolder({ path: options.folderPath ?? joinPath(splitPath(options.path).slice(0, -1)), });
                folderName = options.name || splitPath(options.path).at(-1);
            } else {
                throw error.create({
                    message: 'Specified parent folder does not exist, recursive creation not enabled',
                    name: FILE_ERR_NAME,
                });
            }
        }

        const folderRecord = record.create({ type: record.Type.FOLDER, });
        folderRecord.setValue({ fieldId: 'name', value: folderName, });
        folderRecord.setValue({ fieldId: 'parent', value: parentFolderId, });
        return folderRecord.save().toString();
    }

    /**
     * Deletes a folder from the File Cabinet
     *
     * @param {object} options
     * @param {string|number} [options.path] Folder path
     * @param {string|number} [options.id] Folder ID
     * @param {string} [options.name] Folder name
     * @param {string|number} [options.folder] Parent folder ID
     * @param {string} [options.folderPath] Parent folder path
     */
    function deleteFolder(options) {
        record.delete({
            type: record.Type.FOLDER,
            id: reduceItemIds({ ...options, itemExists: true, itemIsFolder: true, })[1]
        });
    }

    /**
     * Moves a folder within the File Cabinet
     *
     * @param {object} options
     * @param {string|number} [options.path] Initial path
     * @param {string|number} [options.id] Folder ID
     * @param {string} [options.name] Initial name
     * @param {string|number} [options.folder] Initial parent folder ID
     * @param {string} [options.folderPath] Initial parent folder path
     * @param {string} [options.newPath] New path
     * @param {string} [options.newName] New name
     * @param {string|number} [options.newFolder] New parent folder ID
     * @param {string} [options.newFolderPath] New parent folder path
     * @returns {string}
     */
    function moveFolder(options) {
        const [newParentId, _, newName] = reduceItemIds({
            path: options.newPath, name: options.newName,
            folder: options.newFolder, folderPath: options.newFolderPath
        });

        const folderRecord = record.load({
            type: record.Type.FOLDER,
            id: reduceItemIds({ ...options, itemExists: true, itemIsFolder: true, })[1]
        });
        const originalParentId = folderRecord.getValue({ fieldId: 'parent' });
        const originalName = folderRecord.getValue({ fieldId: 'name' });

        if (newParentId === null && (/\//.test(options.newPath ?? '') || options.newFolderPath !== null))
            throw error.create({ message: 'Specified destination parent folder does not exist', name: FILE_ERR_NAME, });
        if ((newParentId === null && newName === null)||(newParentId === originalParentId && newName === originalName))
            throw error.create({ message: 'Can not move folder to its original location', name: FILE_ERR_NAME, });
        if (searchInternal({
            type: SearchType.FOLDER, baseFolder: newParentId ?? originalParentId, path: newName ?? originalName
        }).length > 0) throw error.create({
            message: 'A folder already exists at the specified destination', name: FILE_ERR_NAME, });

        folderRecord.setValue({ fieldId: 'parent', value: newParentId, });
        if (newName) folderRecord.setValue({ fieldId: 'name', value: newName, });
        return folderRecord.save().toString();
    }

    return {
        SearchType, ResultType,
        splitPath, joinPath, getFolderId, getFileId, getFolderPath, getFilePath,
        copy: copyFile, create: createFile, delete: deleteFile, load: loadFile, move: moveFile,
        createFolder, deleteFolder, moveFolder,
        search: searchExternal,
    };
});
