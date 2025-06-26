# NextSweep &mdash; SuiteScript Shorthand

Shorthand and helper methods to reduce SuiteScript boilerplate.

***

# NextClient (next-client.js)

Client-supporting helper methods.

## Module import

```
require(['SuiteScripts/NextSweep/next-client'], nextRuntime => {
    // your code here
});
```

# Functions

## requestSuitelet

Makes a network request to a Suitelet, returning a JSON (as object), blob, or
string response.

### Parameters

|      Key       |  Type  | Required | Description                                                                                                |
|:--------------:|:------:|:--------:|:-----------------------------------------------------------------------------------------------------------|
|     `url`      | string | &#x2715; | A URL to request                                                                                           |
|   `scriptId`   | string | &#x2715; | The script ID of a Suitelet to call                                                                        |
| `deploymentId` | string | &#x2715; | The deployment ID of a Suitelet to call                                                                    |
|    `method`    | string | &#x2715; | Request method (defaults to "GET")                                                                         |
|  `parameters`  | string | &#x2715; | Request URL params                                                                                         |
|     `body`     | string | &#x2715; | Request body                                                                                               |
|   `headers`    | string | &#x2715; | Request headers                                                                                            |
| `responseType` | string | &#x2715; | Request response type override (e.g. if JSON isn't identified automatically, this should be set to "JSON") |

_Note: Either `url`, or a combination of `scriptId` and `deploymentId` should be
provided. If neither option is provided, the URL of the requesting client will
be requested (useful for calling the backend of a Suitelet from its associated
Client execution environment; probably not useful in any other case)_

### Returns

An object (derived from JSON), Blob, or string representing a network response

## escapeHtml

Escapes various symbols that have syntactic meaning in HTML with their
corresponding HTML entities for the purpose of later inserting the resultant
strings into the DOM.

Escaped characters: `&`, `<`, `>`, `"`, `'`

Optionally escaped characters: `\n`

### Parameters

|      Parameter      |  Type   | Required | Description                                                                             |
|:-------------------:|:-------:|:--------:|:----------------------------------------------------------------------------------------|
|     `unescaped`     | string  | &#x3007; | The unescaped input string                                                              |
| `convertLineBreaks` | boolean | &#x2715; | Whether to replace line breaks with <br> elements or leave them intact (defaults false) |

### Returns

A sanitized string

***

# NextFile (next-file.js)

File management methods.

## An important note on file and folder functions

For functions that accepts parameters similar to the following:

- `path`: File/folder path
- `id`: File/folder ID
- `name`: File/folder name
- `folder`: File/folder parent folder ID
- `folderPath`: File/folder parent folder path

_**Only exactly enough information to identify the target file or folder must
be provided to the function.**_

For example, `path` **must not** be passed alongside `id`, because then a
determination would need to be made in which File Cabinet item is intended to be
operated on if the ID refers to a different item than the path.

All legal parameter combinations are listed below:

- `path`
- `id`
- `name` + `folder`
- `name` + `folderPath`

## Module import

```
require(['SuiteScripts/NextSweep/next-file'], nextFile => {
    // your code here
});
```

# Classes

## SearchType

An enum representing search types.

|   Key    |  Value   | Description                                      |
|:--------:|:--------:|:-------------------------------------------------|
|  `ALL`   |  "ALL"   | Return search results for both files and records |
|  `FILE`  |  "FILE"  | Return search results for files only             |
| `FOLDER` | "FOLDER" | Return search results for folders only           |

## ResultType

An enum representing search result types.

|   Key    |  Value   | Description                                  |
|:--------:|:--------:|:---------------------------------------------|
|  `FILE`  |  "FILE"  | A search result representing a File record   |
| `FOLDER` | "FOLDER" | A search result representing a Folder record |

## SearchResult

Encapsulates a search result representing a single file or folder

|    Key    |     Type     | Description                                                                                                  |
|:---------:|:------------:|:-------------------------------------------------------------------------------------------------------------|
| `idPath`  | string array | A file or folder's path within the File Cabinet, as folder and file IDs                                      |
|  `path`   |    string    | A file or folder's path within the File Cabinet, as a slash-delimited string                                 |
|  `type`   |    string    | Search result type (file or folder)                                                                          |
|   `id`    |    string    | A file or folder's internal ID                                                                               |
|  `name`   |    string    | A file or folder's internal name, including file extension for file results                                  |
| `folder`  |    string    | A file or folder's parent folder (nullable only for folders)                                                 |
| `subtype` |    string    | A file or folder's subtype (e.g. "PDF" or "PLAINTEXT" for files, or "DEFAULT" or "SUITESCRIPTS" for folders) |

# Functions

## search

Searches files and folders in the File Cabinet.

### Parameters

|          Key          |  Type   | Required | Default Value | Description                                                                                                                  |
|:---------------------:|:-------:|:--------:|:-------------:|:-----------------------------------------------------------------------------------------------------------------------------|
|        `type`         | string  | &#x2715; |    `FILE`     | Search type (all, file-only, folder-only)                                                                                    |
|        `query`        | string  | &#x3007; |    &mdash;    | Search query &mdash; a name, path, or partial path                                                                           |
|     `baseFolder`      | boolean | &#x2715; |      `0`      | The base folder under which to search (defaults to `0`, representing the File Cabinet root)                                  |
|        `flags`        | object  | &#x2715; |     `{}`      | Search flags (all flags default disabled)                                                                                    |
|  `flags.directChild`  | boolean | &#x2715; |    `false`    | Search only direct children of the base folder                                                                               |
| `flags.caseSensitive` | boolean | &#x2715; |    `false`    | Search only case-matched results (if enabled, "A" does not return results for "a"). If unset, defaults to `exactMatch` value |
|  `flags.exactMatch`   | boolean | &#x2715; |    `false`    | Search only whole-name matches (if enabled, "A" does not return "ABC")                                                       |

### Returns

An array of SearchResult instances

## copy

Copies a single file.

### Parameters

_See note on file and folder functions above._

|       Key        |  Type  | Required | Description                      |
|:----------------:|:------:|:--------:|:---------------------------------|
|      `path`      | string | &#x25B3; | Original file path               |
|       `id`       | string | &#x25B3; | Original file ID                 |
|      `name`      | string | &#x25B3; | Original file name               |
|     `folder`     | string | &#x25B3; | Original file parent folder ID   |
|   `folderPath`   | string | &#x25B3; | Original file parent folder path |
|    `copyPath`    | string | &#x25B3; | Copied file path                 |
|    `copyName`    | string | &#x25B3; | Copied file name                 |
|   `copyFolder`   | string | &#x25B3; | Copied file parent folder ID     |
| `copyFolderPath` | string | &#x25B3; | Copied file parent folder path   |

### Returns

A File instance

## create

Creates a single new file.

### Parameters

_See note on file and folder functions above._

|      Key      |  Type  | Required | Description                                                                                           |
|:-------------:|:------:|:--------:|:------------------------------------------------------------------------------------------------------|
|  `fileType`   | string | &#x3007; | File type (derived from `N/file` > `Type`)                                                            |
|    `path`     | string | &#x25B3; | New file path                                                                                         |
|    `name`     | string | &#x25B3; | New file name                                                                                         |
|   `folder`    | string | &#x25B3; | New file parent folder ID                                                                             |
| `folderPath`  | string | &#x25B3; | New file parent folder path                                                                           |
|  `contents`   | string | &#x2715; | Initial file contents; if the file type is binary (e.g. PDF), the file content must be base64 encoded |
| `description` | string | &#x2715; | File description                                                                                      |
|  `encoding`   | string | &#x2715; | File character encoding (derived from `N/file` > `Encoding`)                                          |
| `isInactive`  | string | &#x2715; | Inactive status                                                                                       |
|  `isOnline`   | string | &#x2715; | Available Without Login status                                                                        |

### Returns

A File instance

## delete

Deletes a single file.

### Parameters

_See note on file and folder functions above._

|     Key      |  Type  | Required | Description             |
|:------------:|:------:|:--------:|:------------------------|
|    `path`    | string | &#x25B3; | File path               |
|     `id`     | string | &#x25B3; | File ID                 |
|    `name`    | string | &#x25B3; | File name               |
|   `folder`   | string | &#x25B3; | File parent folder ID   |
| `folderPath` | string | &#x25B3; | File parent folder path |

### Returns

Nothing

## load

Loads a single file.

### Parameters

_See note on file and folder functions above._

|     Key      |  Type  | Required | Description             |
|:------------:|:------:|:--------:|:------------------------|
|    `path`    | string | &#x25B3; | File path               |
|     `id`     | string | &#x25B3; | File ID                 |
|    `name`    | string | &#x25B3; | File name               |
|   `folder`   | string | &#x25B3; | File parent folder ID   |
| `folderPath` | string | &#x25B3; | File parent folder path |

### Returns

A File instance

## move

Moves a single file.

### Parameters

_See note on file and folder functions above._

|       Key       |  Type  | Required | Description                     |
|:---------------:|:------:|:--------:|:--------------------------------|
|     `path`      | string | &#x25B3; | Initial file path               |
|      `id`       | string | &#x25B3; | File ID                         |
|     `name`      | string | &#x25B3; | Initial file name               |
|    `folder`     | string | &#x25B3; | Initial file parent folder ID   |
|  `folderPath`   | string | &#x25B3; | Initial file parent folder path |
|    `newPath`    | string | &#x25B3; | New file path                   |
|    `newName`    | string | &#x25B3; | New file name                   |
|   `newFolder`   | string | &#x25B3; | New file parent folder ID       |
| `newFolderPath` | string | &#x25B3; | New file parent folder path     |

### Returns

The moved file's ID as a string

## createFolder

Creates a single new folder.

### Parameters

_See note on file and folder functions above._

|     Key      |  Type   | Required | Description                                                            |
|:------------:|:-------:|:--------:|:-----------------------------------------------------------------------|
|    `path`    | string  | &#x25B3; | New folder path                                                        |
|    `name`    | string  | &#x25B3; | New folder name                                                        |
|   `folder`   | string  | &#x25B3; | New folder parent folder ID                                            |
| `folderPath` | string  | &#x25B3; | New folder parent folder path                                          |
| `recursive`  | boolean | &#x25B3; | Enable recursive mode: if parents don't exist, create them recursively |

### Returns

The new folder's ID as a string

## deleteFolder

Deletes a single folder.

### Parameters

_See note on file and folder functions above._

|     Key      |  Type   | Required | Description               |
|:------------:|:-------:|:--------:|:--------------------------|
|    `path`    | string  | &#x25B3; | Folder path               |
|     `id`     | string  | &#x25B3; | Folder ID                 |
|    `name`    | string  | &#x25B3; | Folder name               |
|   `folder`   | string  | &#x25B3; | Folder parent folder ID   |
| `folderPath` | string  | &#x25B3; | Folder parent folder path |

### Returns

The new folder's ID as a string

## moveFolder

Moves a single folder (and its children).

### Parameters

_See note on file and folder functions above._

|       Key       |  Type  | Required | Description                       |
|:---------------:|:------:|:--------:|:----------------------------------|
|     `path`      | string | &#x25B3; | Initial folder path               |
|      `id`       | string | &#x25B3; | Folder ID                         |
|     `name`      | string | &#x25B3; | Initial folder name               |
|    `folder`     | string | &#x25B3; | Initial folder parent folder ID   |
|  `folderPath`   | string | &#x25B3; | Initial folder parent folder path |
|    `newPath`    | string | &#x25B3; | New folder path                   |
|    `newName`    | string | &#x25B3; | New folder name                   |
|   `newFolder`   | string | &#x25B3; | New folder parent folder ID       |
| `newFolderPath` | string | &#x25B3; | New folder parent folder path     |

### Returns

The moved folder's ID as a string

## splitPath

Segments a file path.

E.g. `"SuiteScripts/NextSweep/next-file.js"` becomes
`["SuiteScripts", "NextSweep", "next-file.js"]`

Initial and final slashes are ignored.

### Parameters

| Parameter |  Type  | Required | Description           |
|:---------:|:------:|:--------:|:----------------------|
|  `path`   | string | &#x3007; | A file or folder path |

### Returns

The input path split by forward slash (`/`)

## joinPath

Joins file path segments.

E.g. `["SuiteScripts", "NextSweep", "next-file.js"]` becomes
`"SuiteScripts/NextSweep/next-file.js"`

### Parameters

|  Parameter  |                Type                 | Required | Description                 |
|:-----------:|:-----------------------------------:|:--------:|:----------------------------|
| (arguments) | string arguments \|<br>string array | &#x3007; | A split file or folder path |

### Returns

The input path joined by forward slashes (`/`)

## sanitizeFileName

Sanitizes a file name by replacing illegal characters with underscores.

E.g. `"asdf?gh/jkl.txt"` becomes `asdf_gh_jkl.txt`

### Parameters

| Parameter  |  Type  | Required | Description |
|:----------:|:------:|:--------:|:------------|
| `fileName` | string | &#x3007; | A file name |

### Returns

The input path split by forward slash (`/`)

## getFileId

Gets a file's ID by path.

### Parameters

| Parameter |  Type  | Required | Description |
|:---------:|:------:|:--------:|:------------|
|  `path`   | string | &#x3007; | A file path |

### Returns

A file's ID as a string, or null if it doesn't exist

## getFilePath

Gets a file's path by ID.

### Parameters

| Parameter |  Type  | Required | Description |
|:---------:|:------:|:--------:|:------------|
|   `id`    | string | &#x3007; | A file ID   |

### Returns

A file's path, or null if it doesn't exist

## getFileName

Gets a file's name (extension inclusive) by ID.

### Parameters

| Parameter |  Type  | Required | Description |
|:---------:|:------:|:--------:|:------------|
|   `id`    | string | &#x3007; | A file ID   |

### Returns

A file's name, or null if it doesn't exist

## getFileParent

Get's a file's parent folder (ID) by ID.

### Parameters

| Parameter |  Type  | Required | Description |
|:---------:|:------:|:--------:|:------------|
|   `id`    | string | &#x3007; | A file ID   |

### Returns

A file's parent folder ID as a string, or null if the file doesn't exist

## getFolderId

Get's a folder's ID by path.

### Parameters

| Parameter |  Type  | Required | Description   |
|:---------:|:------:|:--------:|:--------------|
|  `path`   | string | &#x3007; | A folder path |

### Returns

A folder's ID as a string, or null if it doesn't exist

## getFolderPath

Gets a folder's path by ID.

### Parameters

| Parameter |  Type  | Required | Description |
|:---------:|:------:|:--------:|:------------|
|   `id`    | string | &#x3007; | A folder ID |

### Returns

A folder's path, or null if it doesn't exist

## getFolderName

Get's a folder's name by ID.

### Parameters

| Parameter |  Type  | Required | Description |
|:---------:|:------:|:--------:|:------------|
|   `id`    | string | &#x3007; | A folder ID |

### Returns

A folder's name, or null if it doesn't exist

## getFolderParent

Gets a folder's parent (ID) by ID.

### Parameters

| Parameter |  Type  | Required | Description |
|:---------:|:------:|:--------:|:------------|
|   `id`    | string | &#x3007; | A folder ID |

### Returns

A folder's parent folder ID as a string, or null if the target is a root folder
or it doesn't exist

***

# NextList (next-list.js)

Custom List mapping methods.

## Module import

```
require(['SuiteScripts/NextSweep/next-list'], nextList => {
    // your code here
});
```

# Classes

## CustomListOrder

An enum representing Custom List sort types.

|         Key          |        Value         | Description                             |
|:--------------------:|:--------------------:|:----------------------------------------|
| `THE_ORDER_ENTERED`  | "THE_ORDER_ENTERED"  | List entries are ordered as entered     |
| `ALPHABETICAL_ORDER` | "ALPHABETICAL_ORDER" | List entries are ordered alphabetically |

## CustomListEntry

Encapsulates a Custom List entry

|     Key      |  Type   | Description                     |
|:------------:|:-------:|:--------------------------------|
|   `value`    | string  | Entry label ("Value" in the UI) |
|     `id`     | string  | Entry Script ID                 |
| `internalId` | string  | Entry Internal ID (numeric ID)  |
|  `inactive`  | boolean | Entry inactive flag             |

## CustomList

Encapsulates a Custom List definition

|      Key      |         Type          | Description                                                                      |
|:-------------:|:---------------------:|:---------------------------------------------------------------------------------|
|    `name`     |        string         | List title                                                                       |
|     `id`      |        string         | List Script ID                                                                   |
| `internalId`  |        string         | List Internal ID (numeric ID)                                                    |
|    `owner`    |        string         | List owner ID                                                                    |
| `description` |        string         | List description                                                                 |
|    `order`    |    CustomListOrder    | List entry order                                                                 |
|  `inactive`   |        boolean        | Inactive flag                                                                    |
|   `entries`   | CustomListEntry array | List entries &mdash; should not be used directly, use accessor functions instead |

### Class Methods

|             Name              | Description                                |
|:-----------------------------:|:-------------------------------------------|
|         `get(index)`          | Gets a list entry by index                 |
|      `getById(scriptId)`      | Gets a list entry by Script ID             |
| `getByInternalId(internalId)` | Gets a list entry by Internal ID           |
|          `getAll()`           | Gets all list entries (including inactive) |
|         `getActive()`         | Gets all list entries not flagged inactive |
|        `getInactive()`        | Gets all list entries flagged inactive     |

# Functions

## load

Loads a Custom List.

### Parameters

|     Key      |  Type  | Required | Description      |
|:------------:|:------:|:--------:|:-----------------|
|     `id`     | string | &#x25B3; | List Script ID   |
| `internalId` | string | &#x25B3; | List Internal ID |

### Returns

A CustomList instance

***

# NextRecord (next-record.js)

Record management methods.

## Module import

```
require(['SuiteScripts/NextSweep/next-record'], nextRecord => {
    // your code here
});
```

# Classes
## ComparatorDefinition
## Comparator
## OperatorDefinition
## Operator
## CriteriaNode
## CriteriaBranch
## CriteriaLeaf
## CriteriaNodeTraversalPath

# Functions

## quickCreate

Creates a single new record.

### Parameters

|         Key          |     Type     | Required | Description                                                                         |
|:--------------------:|:------------:|:--------:|:------------------------------------------------------------------------------------|
|        `type`        |    string    | &#x3007; | Created record type                                                                 |
|       `flags`        |    object    | &#x2715; | Record processing option flags (all flags default disabled)                         |
|   `flags.dynamic`    |   boolean    | &#x2715; | Dynamic mode                                                                        |
| `flags.sourceOnSave` |   boolean    | &#x2715; | Source dependent fields on save                                                     |
| `flags.ignoreOnSave` |   boolean    | &#x2715; | Ignore mandatory fields on save                                                     |
|    `flags.noSave`    |   boolean    | &#x2715; | Disables record save record after processing                                        |
|     `procedure`      | object array | &#x2715; | Record modification procedure &mdash; may comprise a mix of Steps and Subprocedures |

#### Procedure Step explicit object definition

|          Key           |     Type     | Required | Description                                              | Additional notes                                     |
|:----------------------:|:------------:|:--------:|:---------------------------------------------------------|------------------------------------------------------|
|        `field`         |    string    | &#x3007; | Field ID                                                 |                                                      |
|        `values`        |    array     | &#x25B3; | For by-value setting, the value or values to be assigned | Exclusive with `text` &mdash; one must be assigned   |
|         `text`         | string array | &#x25B3; | For by-text setting, the value or values to be assigned  | Exclusive with `values` &mdash; one must be assigned |
|        `flags`         |    object    | &#x2715; | Step option flags (all flags default disabled)           |                                                      |
| `flags.suppressEvents` |   boolean    | &#x2715; | Suppress field change events                             |                                                      |

#### Procedure Step implicit array definition (no flag support)

| Key |  Type   | Required | Description                                                                  |
|:---:|:-------:|:--------:|:-----------------------------------------------------------------------------|
|  0  | string  | &#x3007; | Field ID                                                                     |
|  1  |  array  | &#x3007; | The value or values to be assigned &mdash; assigned by value unless flag set |
|  2  | boolean | &#x2715; | By-text field assignment flag                                                |

#### Subprocedure definition

|          Key           |     Type      | Required | Description                                                        | Additional notes                                                                                    |
|:----------------------:|:-------------:|:--------:|:-------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------|
|       `sublist`        |    string     | &#x3007; | Sublist ID                                                         |                                                                                                     |
|         `edit`         |    boolean    | &#x2715; | Edit sublist lines rather than inserting new ones (defaults false) |                                                                                                     |
|        `lines`         | integer array | &#x25B3; | Insertion/edit line indices                                        | Exclusive with `criteria` &mdash; one must be assigned; **see Special Notes 1 and 2**               |
|       `criteria`       | object array  | &#x25B3; | Dynamic line selection criteria                                    | Exclusive with `lines` &mdash; one must be assigned                                                 |
|      `selections`      | integer array | &#x2715; | Criteria match selections (defaults to all matches)                | Example: If there are two matches, and `selections` is `[0]`, only the first match will be selected |
|        `offset`        |    integer    | &#x2715; | Line edit/insertion offset                                         |                                                                                                     |
|        `steps`         |     array     | &#x2715; | Sublist modification steps                                         |                                                                                                     |
|        `flags`         |    object     | &#x2715; | Subprocedure option flags (all flags default disabled)             |                                                                                                     |
| `flags.suppressRecalc` |    boolean    | &#x2715; | Suppress field change events                                       |                                                                                                     |
|   `flags.permissive`   |    boolean    | &#x2715; | Force synchronous field sourcing                                   |                                                                                                     |

_Special Note 1: Line indices may be positive, negative, or null. In insertion
mode, null stands for insertion past the last item of the sublist; in edit mode,
null stands for all lines of the sublist._

_Special Note 2: In insertion mode, line indices represent positions prior to
any insertions. Example 1: indices 0 (A) and 1 (B) are provided, rendering new
line positions of 0 (A) and 2 (B). Example 2: identical indices 3 (A) and 3 (B)
are provided, rendering new line positions of 3 (A) and 4 (B)._

#### Subprocedure Criteria definition

Criteria are arbitrarily nested conditional arrays, joined by operators `AND`,
`OR`, and `NOT`. There is no limit to nesting depth.

#### Supported comparators

|     Name     | Symbol | Allowed representations (case insensitive) | Description                                    |
|:------------:|:------:|:-------------------------------------------|------------------------------------------------|
|     ANY      |  ANY   | "any", "anyOf"                             | Any of X is equal to any of Y                  |
|     NONE     |  NONE  | "none", "noneOf"                           | None of X are equal to any of Y                |
|    EQUAL     |   ==   | "eq", "==", "=", "equalTo", "is"           | All of X are equal to some of Y and vice versa |
|  NOT_EQUAL   |   !=   | "ne", "!=", "<>", "notEqualTo", "isNot"    | Some of X are equal to none of Y or vice versa |
| GREATER_THAN |   \>   | "gt", ">", "greaterThan"                   | All of X are greater than any of Y             |
|  LESS_THAN   |   <    | "lt", "<", "lessThan"                      | All of X are less than any of Y                |
| GT_OR_EQUAL  |  \>=   | "ge", ">=", "greaterThanOrEqualTo"         | All of X are greater than or equal to any of Y |
| LT_OR_EQUAL  |   <=   | "le", "<=", "lessThanOrEqualTo"            | All of X are less than or equal to any of Y    |

Note that element order is not considered in any comparison. For example,
`[1,2,3]` is considered equal to `[3,2,1]`.

#### Simple example

```
[["examplelineid", "is", "12345"]]
```

#### Complex example

```
[
    [
        ["exampleamount", "greaterThan", 999],
        "AND",
        "NOT",
        [
            ["examplecategory1", "anyOf", ["1", "2", "3"]],
            "OR",
            ["examplecategory2", "is", "99"]
        ]
    ],
    "OR",
    ["exampleoverridecheckbox", "is", true]
]
```

#### Subprocedure Step explicit object definition

|           Key           |     Type     | Required | Description                                              | Additional notes                                                                              |
|:-----------------------:|:------------:|:--------:|:---------------------------------------------------------|-----------------------------------------------------------------------------------------------|
|        `column`         |    string    | &#x3007; | Column ID                                                |                                                                                               |
|        `values`         |    array     | &#x25B3; | For by-value setting, the value or values to be assigned | Exclusive with `text` &mdash; one must be assigned                                            |
|         `text`          | string array | &#x25B3; | For by-text setting, the value or values to be assigned  | Exclusive with `values` &mdash; one must be assigned                                          |
|         `flags`         |    object    | &#x2715; | Step option flags                                        |                                                                                               |
| `flags.suppressEvents`  |   boolean    | &#x2715; | Suppress field change events                             |                                                                                               |
| `flags.forceSyncSource` |   boolean    | &#x2715; | Force synchronous field sourcing (**DEFAULTS TRUE**)     | Initially intended to default false, but was changed due to inconsistent behavior in NetSuite |

#### Subprocedure Step implicit array definition (no flag support)

| Key |  Type   | Required | Description                                                                  |
|:---:|:-------:|:--------:|:-----------------------------------------------------------------------------|
|  0  | string  | &#x3007; | Column ID                                                                    |
|  1  |  array  | &#x3007; | The value or values to be assigned &mdash; assigned by value unless flag set |
|  2  | boolean | &#x2715; | By-text field assignment flag                                                |

### Returns

Record ID or Record instance (if `flags.noSave` is set)

### Examples

_Note: Examples mix and match syntax options for greater coverage. For example,
procedure steps may be passed as explicit objects or arrays._

#### Create record in dynamic mode, set field values, and get the modified record instance

(explicit step definition)

```
nextRecord.quickCreate({
    type: 'examplerecordtype',
    flags: { dynamic: true, noSave: true, },
    procedure: [
        { field: 'exampleamount', values: 123, },
        { field: 'exampletext', text: 'Asdf', },
        {
            sublist: 'examplesublist',
            criteria: [
                ['examplelineid', 'anyOf', ['555', '777']],
                'AND',
                ['examplelineflag', 'is', false],
            ],
            steps: [
                { column: 'examplelineflag', values: true, },
            ],
        },
    ],
});
```

(implicit step definition)

```
nextRecord.quickCreate({
    type: 'examplerecordtype',
    flags: { dynamic: true, noSave: true, },
    procedure: [
        ['exampleamount', 123],
        ['examplesourced', 'Asdf', true],
        {
            sublist: 'examplesublist',
            criteria: [
                ['examplelineid', 'anyOf', ['555', '777']],
                'AND',
                ['examplelineflag', 'is', false],
            ],
            steps: [
                ['examplelineflag', true],
            ],
        },
    ],
});
```

#### Create blank record, save, and get its ID

```
nextRecord.quickCreate({ type: 'examplerecordtype', });
```

## quickUpdate

Modifies a single existing record.

### Parameters

|         Key          |     Type     | Required | Description                                                                         | Additional Notes                                                                                 |
|:--------------------:|:------------:|:--------:|:------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------|
|       `record`       |    object    | &#x3007; | Existing record instance                                                            | Exclusive with `type` and `id` &mdash; only one or the other two must be assigned                |
|        `type`        |    string    | &#x3007; | Loaded record type                                                                  | Exclusive with `record` &mdash; only the two `type` and `id`, or the other one, must be assigned |
|         `id`         |    string    | &#x3007; | Loaded record ID                                                                    | Exclusive with `record` &mdash; only the two `type` and `id`, or the other one, must be assigned |
|       `flags`        |    object    | &#x2715; | Record processing option flags (all flags default disabled)                         |                                                                                                  |
|   `flags.dynamic`    |   boolean    | &#x2715; | Dynamic mode                                                                        |                                                                                                  |
| `flags.sourceOnSave` |   boolean    | &#x2715; | Source dependent fields on save                                                     |                                                                                                  |
| `flags.ignoreOnSave` |   boolean    | &#x2715; | Ignore mandatory fields on save                                                     |                                                                                                  |
|    `flags.noSave`    |   boolean    | &#x2715; | Disables record save record after processing                                        |                                                                                                  |
|     `procedure`      | object array | &#x2715; | Record modification procedure &mdash; may comprise a mix of Steps and Subprocedures |                                                                                                  |

#### Procedure Step

_Same as quickCreate._

#### Subprocedure definition

_Same as quickCreate, with one important change (in bold):_

|  Key   |  Type   | Required | Description                                                           |
|:------:|:-------:|:--------:|:----------------------------------------------------------------------|
| `edit` | boolean | &#x2715; | Edit sublist lines rather than inserting new ones **(defaults true)** |

#### Subprocedure Criteria definition

_Same as quickCreate._

#### Subprocedure Step

_Same as quickCreate._

### Returns

Record ID or Record instance (if `flags.noSave` is set)

***

# NextRuntime (next-runtime.js)

Runtime data retrieval methods.

## Module import

```
require(['SuiteScripts/NextSweep/next-runtime'], nextRuntime => {
    // your code here
});
```

# Functions

## getCurrentScheduledTaskId

Gets the Task ID of the calling Scheduled or Map/Reduce Script.

The task ID is normally not known to the script execution environment itself, so
this function retrieves it by running a search of current scheduled script
instances filtered by the caller's runtime Script ID and Deployment ID.

### Returns

A native Task ID

***

# NextTask (next-task.js)

Asynchronous Task methods.

Tasks are able to return a value asynchronously, performing slow operations
without blocking time-sensitive requests as well as triggering User Events.

## Module import

```
require(['SuiteScripts/NextSweep/next-task'], nextTask => {
    // your code here
});
```

# Classes

## AsyncTaskResult

Encapsulates an Asynchronous Task result

|   Key    |  Type  | Description                                                                                      |
|:--------:|:------:|:-------------------------------------------------------------------------------------------------|
|   `id`   | string | Asynchronous Task record ID                                                                      |
| `status` | string | Task status human-readable ID                                                                    |
| `result` |  any   | Task result (the value returned by the requested function)                                       |
| `error`  | object | Task error (a serialized representation of the error that caused the function execution to fail) |

# Functions

## dispatchAsyncTask

Dispatches a new Asynchronous Task.

### Parameters

|     Key      |             Type              | Required | Description                                                                                                   |
|:------------:|:-----------------------------:|:--------:|:--------------------------------------------------------------------------------------------------------------|
|   `module`   |            string             | &#x3007; | Module to be called on task execution                                                                         |
|  `function`  |            string             | &#x3007; | Function (name) to be called on task execution                                                                |
| `parameters` | any<br>(serializable to JSON) | &#x2715; | Parameters to be passed to the function (must be serializable to JSON)                                        |
|   `spread`   |            boolean            | &#x2715; | Parameter spread flag &mdash; whether to interpret array parameters as one parameter, or multiple parameters. |

### Returns

An Asynchronous Task record ID

## dispatchAsyncTaskProcessor (SERVER ONLY)

Dispatches the Asynchronous Task processor.

**_CALLING THIS FUNCTION MANUALLY IS NEVER NECESSARY._**

### Returns

Nothing

## getOpenAsyncTasks

Gets an array of various data for open Asynchronous Tasks.

### Returns

An array of objects representing open Asynchronous Tasks

## getAsyncTaskResult

Gets the result and/or status of an Asynchronous Task by ID.

### Parameters

| Key  |  Type  | Required | Description |
|:----:|:------:|:--------:|:------------|
| `id` | string | &#x3007; | The task ID |

### Returns

An AsyncTaskResult instance

## dispatchPdfTask

Dispatches a new PDF Render Task.

### Parameters

|        Key        |     Type     | Required | Description                                                                     |
|:-----------------:|:------------:|:--------:|:--------------------------------------------------------------------------------|
|  `configuration`  |    object    | &#x3007; | Render configuration options (currently unused)                                 |
|     `folder`      |    string    | &#x25B3; | The ID of the folder to which rendered PDFs should be saved                     |
|   `folderPath`    |    string    | &#x25B3; | The path of the folder to which rendered PDFs should be saved                   |
|     `records`     | object array | &#x3007; | An array of data representing records to be rendered                            |
| `records[*].type` |    string    | &#x3007; | Render method (currently only a value of "transaction" is supported)            |
|  `records[*].id`  |    string    | &#x3007; | Rendered record ID (currently must represent a transaction)                     |
| `records[*].name` |    string    | &#x2715; | The name that should be assigned to the rendered PDF (e.g. "Invoice_12345.pdf") |

### Returns

A PDF Render Task record ID

## dispatchPdfTaskProcessor (SERVER ONLY)

Dispatches the PDF Render Task processor.

**_CALLING THIS FUNCTION MANUALLY IS NEVER NECESSARY._**

### Returns

Nothing

## getOpenPdfTasks

Gets an array of various data for open PDF Render Tasks.

### Returns

An array of objects representing open PDF Render Tasks

## getPdfTaskResult

Gets the result and/or status of a PDF Render Task by ID.

### Parameters

| Key  |  Type  | Required | Description |
|:----:|:------:|:--------:|:------------|
| `id` | string | &#x3007; | The task ID |

### Returns

An PdfTaskResult instance

***

```
      __________ _ _____    ___
      \____   // ||   _  \  \  \
         /  //   ||  | \  \ |  |____       ___ __
       /  //  /  ||  |_/  //  // ___\___  / __\ |_
     /  //__/ |  ||   __//__/  \__ \/ . \|  _||  _|
   /_________\|__||__| /__/   /____/\___/|_|  \__\ 2025++

```
