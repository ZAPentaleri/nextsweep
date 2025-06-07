# NextSweep &mdash; SuiteScript Shorthand

## NextRecord (next-record.js)

### Module import

```
require(['SuiteScripts/NextSweep/next-record'], nextRecord => {
    // your code here
});
```

### Record Creation (quickCreate)

#### Parameters

|         Key          |     Type     | Required | Description                                                                         |
|:--------------------:|:------------:|:--------:|:------------------------------------------------------------------------------------|
|        `type`        |    string    | &#x3007; | Created record type                                                                 |
|       `flags`        |    object    | &#x2715; | Record processing option flags (all flags default disabled)                         |
|   `flags.dynamic`    |   boolean    | &#x2715; | Dynamic mode                                                                        |
| `flags.sourceOnSave` |   boolean    | &#x2715; | Source dependent fields on save                                                     |
| `flags.ignoreOnSave` |   boolean    | &#x2715; | Ignore mandatory fields on save                                                     |
|    `flags.noSave`    |   boolean    | &#x2715; | Disables record save record after processing                                        |
|     `procedure`      | object array | &#x2715; | Record modification procedure &mdash; may comprise a mix of Steps and Subprocedures |

---

**Procedure Step explicit object definition:**

|          Key           |     Type     | Required | Description                                              | Additional notes                                     |
|:----------------------:|:------------:|:--------:|:---------------------------------------------------------|------------------------------------------------------|
|        `field`         |    string    | &#x3007; | Field ID                                                 |                                                      |
|        `values`        |    array     | &#x25B3; | For by-value setting, the value or values to be assigned | Exclusive with `text` &mdash; one must be assigned   |
|         `text`         | string array | &#x25B3; | For by-text setting, the value or values to be assigned  | Exclusive with `values` &mdash; one must be assigned |
|        `flags`         |    object    | &#x2715; | Step option flags (all flags default disabled)           |                                                      |
| `flags.suppressEvents` |   boolean    | &#x2715; | Suppress field change events                             |                                                      |

**Procedure Step implicit array definition (no flag support):**

| Key |  Type   | Required | Description                                                                  |
|:---:|:-------:|:--------:|:-----------------------------------------------------------------------------|
|  0  | string  | &#x3007; | Field ID                                                                     |
|  1  |  array  | &#x3007; | The value or values to be assigned &mdash; assigned by value unless flag set |
|  2  | boolean | &#x2715; | By-text field assignment flag                                                |

---

**Subprocedure definition:**

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

---

**Subprocedure Criteria definition:**

Criteria are arbitrarily nested conditional arrays, joined by operators `AND`,
`OR`, and `NOT`. There is no limit to nesting depth.

**Supported comparators:**

|     Name     | Symbol | Allowed representations (case insensitive) | Description                                    |
|:------------:|:------:|:-------------------------------------------|------------------------------------------------|
|     ANY      |  ANY   | "any", "anyOf"                             | Any of X is equal to any of Y                  |
|     NONE     |  NONE  | "none", "noneOf"                           | None of X are equal to any of Y                |
|    EQUAL     |   ==   | "eq", "==", "=", "equalTo", "is"           | All of X are equal to some of Y and vice versa |
|  NOT_EQUAL   |   !=   | "ne", "!=", "<>", "notEqualTo", "isNot"    | Some of X are equal to none of Y               |
| GREATER_THAN |   \>   | "gt", ">", "greaterThan"                   | All of X are greater than any of Y             |
|  LESS_THAN   |   <    | "lt", "<", "lessThan"                      | All of X are less than any of Y                |
| GT_OR_EQUAL  |  \>=   | "ge", ">=", "greaterThanOrEqualTo"         | All of X are greater than or equal to any of Y |
| LT_OR_EQUAL  |   <=   | "le", "<=", "lessThanOrEqualTo"            | All of X are less than or equal to any of Y    |

**Simple example:**

```
[["examplelineid", "is", "12345"]]
```

**Complex example:**

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

---

**Subprocedure Step explicit object definition:**

|           Key           |     Type     | Required | Description                                              | Additional notes                                     |
|:-----------------------:|:------------:|:--------:|:---------------------------------------------------------|------------------------------------------------------|
|        `column`         |    string    | &#x3007; | Column ID                                                |                                                      |
|        `values`         |    array     | &#x25B3; | For by-value setting, the value or values to be assigned | Exclusive with `text` &mdash; one must be assigned   |
|         `text`          | string array | &#x25B3; | For by-text setting, the value or values to be assigned  | Exclusive with `values` &mdash; one must be assigned |
|         `flags`         |    object    | &#x2715; | Step option flags (all flags default disabled)           |                                                      |
| `flags.suppressEvents`  |   boolean    | &#x2715; | Suppress field change events                             |                                                      |
| `flags.forceSyncSource` |   boolean    | &#x2715; | Force synchronous field sourcing                         |                                                      |

**Subprocedure Step implicit array definition (no flag support):**

| Key |  Type   | Required | Description                                                                  |
|:---:|:-------:|:--------:|:-----------------------------------------------------------------------------|
|  0  | string  | &#x3007; | Column ID                                                                    |
|  1  |  array  | &#x3007; | The value or values to be assigned &mdash; assigned by value unless flag set |
|  2  | boolean | &#x2715; | By-text field assignment flag                                                |

#### Returns

Record ID or Record instance (if `flags.noSave` is set)

#### Examples

*NOTE: Examples mix and match syntax options for greater coverage. For example,
procedure steps may be passed as explicit objects or arrays.* 

---

**Create record in dynamic mode, set field values, and get the modified record instance:**

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

---

**Create blank record, save, and get its ID:**

```
nextRecord.quickCreate({ type: 'examplerecordtype', });
```

### Record creation (quickCreate)

#### Parameters

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

---

**Procedure Step:**

_Same as quickCreate._

---

**Subprocedure definition:**

_Same as quickCreate, with one important change (in bold):_

|  Key   |  Type   | Required | Description                                                           |
|:------:|:-------:|:--------:|:----------------------------------------------------------------------|
| `edit` | boolean | &#x2715; | Edit sublist lines rather than inserting new ones **(defaults true)** |

---

**Subprocedure Criteria definition:**

_Same as quickCreate._

---

**Subprocedure Step:**

_Same as quickCreate._

#### Returns

Record ID or Record instance (if `flags.noSave` is set)
