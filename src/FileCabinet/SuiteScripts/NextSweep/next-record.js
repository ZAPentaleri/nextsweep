/**
 *    __________ _ _____    ___
 *    \____   // ||   _  \  \  \
 *       /  //   ||  | \  \ |  |____       ___ __
 *     /  //  /  ||  |_/  //  // ___\___  / __\ |_
 *   /  //__/ |  ||   __//__/  \__ \/ . \|  _||  _|
 * /_________\|__||__| /__/(R)/____/\___/|_|  \__\
 *
 * NextSweep Record Module: provides a streamlined interface for modifications
 * to NetSuite records
 *
 * ZAPentaleri, 2025
 *
 * @NApiVersion 2.1
 */

/**
 * @typedef {object} QuickCreateOptions
 * @property {string} [type] Record type
 * @property {(QuickUpdateStep|QuickUpdateSubprocedure|*[])[]} procedure Record modification procedure
 * @property {boolean} [flags.dynamic=false] Flag to load record in dynamic mode
 * @property {boolean} [flags.sourceOnSave=false] Flag to source dependent fields on save
 * @property {boolean} [flags.ignoreOnSave=false] Flag to ignore mandatory fields on save
 * @property {boolean} [flags.noSave=false] Flag to disable save after procedure is complete
 */

/**
 * @typedef {object} QuickUpdateOptions
 * @property {Record} [record] Record instance
 * @property {string} [type] Record type
 * @property {string} [id] Record ID
 * @property {(QuickUpdateStep|QuickUpdateSubprocedure|*[])[]} procedure Record modification procedure
 * @property {boolean} [flags.dynamic=false] Flag to load record in dynamic mode
 * @property {boolean} [flags.sourceOnSave=false] Flag to source dependent fields on save
 * @property {boolean} [flags.ignoreOnSave=false] Flag to ignore mandatory fields on save
 * @property {boolean} [flags.noSave=false] Flag to disable save after procedure is complete
 */

/**
 * @typedef {object} QuickUpdateStep
 * @property {string} field Field ID
 * @property {string|string[]|number|number[]|boolean|Date} [values] Simple field values
 * @property {string|string[]} [text] Text field values
 * @property {boolean} [flags.suppressEvents=false] Suppress field change events
 */

/**
 * @typedef {object} QuickUpdateSubprocedure
 * @property {string} sublist Sublist ID
 * @property {boolean} [edit=true] Flag to enable line edit mode (defaults to insertion mode)
 * @property {number|number[]|null} [lines=null] Insertion/edit line indices (positive, negative, or null). In insertion
 *     mode, null stands for insertion at the end of the sublist; in edit mode, null stands for all lines. Insertion
 *     line indices represent positions *prior* to any insertions
 * @property {QuickUpdateSubCriterion|(QuickUpdateSubCriterion|string|string[]|*[])[]} [criteria] Modify mode line match
 *     criteria
 * @property {number|number[]} [selections=null] Modify mode line match selection indices (positive, negative, or null
 *     for all matches)
 * @property {number} [offset=0] Specified/matched line index offset
 * @property {(QuickUpdateSubStep|*[])[]} steps Subprocedure steps
 * @property {boolean} [flags.suppressRecalc=false] Flag to suppress NS scripting recalculation
 * @property {boolean} [flags.permissive=false] Flag to suppress errors related to out-of-bounds line indices (bad
 *     indices will be silently skipped)
 */

/**
 * @typedef {object} QuickUpdateSubCriterion
 * @property {string} column Match column ID
 * @property {string} [comparator] Match comparator
 * @property {string|string[]|number|number[]|boolean|Date} [values] Simple field value(s) to match against
 * @property {string|string[]} [text] Text field values to match against
 */

/**
 * @typedef {object} QuickUpdateSubStep
 * @property {string} column Column ID
 * @property {string|string[]|number|number[]|boolean|Date} [values] Simple field values
 * @property {string|string[]} [text] Text field values
 * @property {boolean} [flags.suppressEvents=false] Suppress field change events
 * @property {boolean} [flags.forceSyncSource=false] Force synchronous field sourcing
 */

class CriteriaRelationship {
    static PARENT = 'parent';
    static LEFT   = 'left';
    static RIGHT  = 'right';
    static NONE   = 'none';
}

class OperatorDefinition {
    /**
     * @param {string[]} representations
     * @param {string[]} requiredRelationships
     * @param {function} leftOperator
     * @param {function} rightOperator
     */
    constructor(representations, requiredRelationships, leftOperator=(()=>null), rightOperator=(()=>null)) {
        this.name = representations[0].toUpperCase();
        this.representations = representations.map(op => op.toLowerCase());

        this.requiredRelationships = requiredRelationships;

        this.leftOperator  = leftOperator;
        this.rightOperator = rightOperator;
    }

    operateLeft(x)  { return this.leftOperator(x); }
    operateRight(y) { return this.rightOperator(y); }

    toString() { return this.representations[0]; }
}

class Operator {
    static NO_OP = new OperatorDefinition(
        ['nop',],
        [CriteriaRelationship.LEFT,],
        x => x,
    );
    static AND = new OperatorDefinition(
        ['and', '&&',],
        [CriteriaRelationship.LEFT, CriteriaRelationship.RIGHT,],
        x => !x ? false : null,
        y => y,
    );
    static OR = new OperatorDefinition(
        ['or',  '||',],
        [CriteriaRelationship.LEFT, CriteriaRelationship.RIGHT,],
        x => x || null,
        y => y === true,
    );
    static NOT = new OperatorDefinition(
        ['not', '!',],
        [CriteriaRelationship.LEFT,],
        x => !x,
    );

    /**
     * @param {OperatorDefinition|string} operator
     * @returns {OperatorDefinition}
     */
    static identify(operator) {
        for (const candidate of Object.values(this)) {
            if (operator === candidate || candidate.representations.includes(operator.toLowerCase())) return candidate;
        }

        throw new Error('Invalid operator');
    }
}

class ComparatorDefinition {
    /**
     * @param {string[]} representations
     * @param {function} comparator
     */
    constructor(representations, comparator) {
        this.name = representations[0].toUpperCase();
        this.representations = representations.map(op => op.toLowerCase());

        this.comparator = comparator;
    }

    compare(x, y) { return this.comparator(x, y,); }

    toString() { return this.representations[0]; }
}

class Comparator {
    static ANY = new ComparatorDefinition(
        ['any', 'anyOf',],
        (x, y) => x.some(X => y.some(Y => X == Y)),                                                    // ignore warning
    );
    static NONE = new ComparatorDefinition(
        ['none', 'noneOf',],
        (x, y) => x.every(X => y.every(Y => X != Y)),                                                  // ignore warning
    );
    static EQUAL = new ComparatorDefinition(
        ['eq', '==', '=', 'equalTo', 'is',],
        (x, y) => new Set(x).size === new Set(y).size && x.every(X => y.some(Y => X == Y)),            // ignore warning
    );
    static NOT_EQUAL = new ComparatorDefinition(
        ['ne', '!=', '<>', 'notEqualTo', 'isNot',],
        (x, y) => new Set(x).size !== new Set(y).size || x.every(X => y.every(Y => X != Y)),           // ignore warning
    );
    static GREATER_THAN = new ComparatorDefinition(
        ['gt', '>', 'greaterThan',],
        (x, y) => x.every(X => y.every(Y => X > Y)),
    );
    static LESS_THAN = new ComparatorDefinition(
        ['lt', '<', 'lessThan',],
        (x, y) => x.every(X => y.every(Y => X < Y)),
    );
    static GT_OR_EQUAL = new ComparatorDefinition(
        ['ge', '>=', 'greaterThanOrEqualTo',],
        (x, y) => x.every(X => y.every(Y => X >= Y)),
    );
    static LT_OR_EQUAL = new ComparatorDefinition(
        ['le', '<=', 'lessThanOrEqualTo',],
        (x, y) => x.every(X => y.every(Y => X <= Y)),
    );

    /**
     * @param {ComparatorDefinition|string} comp
     * @returns {ComparatorDefinition}
     */
    static identify(comp) {
        for (const candidate of Object.values(this)) {
            if (comp === candidate || candidate.representations.includes(comp.toLowerCase())) return candidate;
        }

        throw new Error('Invalid comparator');
    }
}

class CriteriaNode {
    constructor(parent=null, left=null, right=null,) {
        this.parent = parent;
        this.left   = left;
        this.right  = right;
    }

    getRelationshipTo(node) {
        if (node === this.parent) {
            return CriteriaRelationship.PARENT;
        } else if (node === this.left) {
            return CriteriaRelationship.LEFT;
        } else if (node === this.right) {
            return CriteriaRelationship.RIGHT;
        } else {
            return CriteriaRelationship.NONE;
        }
    }

    has(relation, nClass=null) { return nClass !== null ? this[relation] instanceof nClass : this[relation] !== null; }
    hasParent(nClass=null)     { return this.has(CriteriaRelationship.PARENT, nClass); }
    hasLeft(nClass=null)       { return this.has(CriteriaRelationship.LEFT, nClass); }
    hasRight(nClass=null)      { return this.has(CriteriaRelationship.RIGHT, nClass); }

    getRoot() { return this.hasParent(CriteriaNode) ? this.parent.getRoot() : this; }

    prune() { return this; }
}

class CriteriaBranch extends CriteriaNode {
    constructor(operator=Operator.NO_OP,) {
        super();
        this.operator = operator;
    }

    getCurrentRelationships() {
        return [CriteriaRelationship.LEFT, CriteriaRelationship.RIGHT,].filter(relationship => this.has(relationship));
    }
    getNeededRelationships() {
        return [CriteriaRelationship.LEFT, CriteriaRelationship.RIGHT,].filter(relationship =>
            this.operator.requiredRelationships.includes(relationship) && !this.has(relationship)
        );
    }
    getExtraneousRelationships() {
        return [CriteriaRelationship.LEFT, CriteriaRelationship.RIGHT,].filter(relationship =>
            !this.operator.requiredRelationships.includes(relationship) && this.has(relationship)
        );
    }
    validateRelationships(errorIfInvalid=false) {
        const relationsValid = (this.getNeededRelationships().length + this.getExtraneousRelationships().length) === 0;
        if (relationsValid || !errorIfInvalid) {
            return relationsValid
        } else {
            throw new Error(
                `Invalid ${this.operator} branch state: requires [${
                    this.getCurrentRelationships().join(', ')
                }], has [${
                    this.getNeededRelationships().join(', ')
                }]`
            )
        }
    }

    insertParent() {
        const newNode = (arguments[0] instanceof CriteriaNode) ? arguments[0] : new CriteriaBranch(...arguments);
        const parentRelationship = this.parent.getRelationshipTo(this);

        // update higher relationships
        if (this.hasParent(CriteriaNode)) {
            newNode.parent = this.parent;
            this.parent[parentRelationship] = newNode;
        }

        // update lower relationships
        newNode[parentRelationship] = this;
        this.parent = newNode;

        return newNode;
    }
    insertLeft() {
        const newNode = (arguments[0] instanceof CriteriaNode) ? arguments[0] : new CriteriaBranch(...arguments);

        // update lower relationships
        if (this.hasLeft(CriteriaNode)) {
            newNode.left = this.left;
            this.left.parent = newNode;
        }

        // update higher relationships
        newNode.parent = this;
        this.left = newNode;

        return newNode;
    }
    insertRight() {
        const newNode = (arguments[0] instanceof CriteriaNode) ? arguments[0] : new CriteriaBranch(...arguments);

        // update lower relationships
        if (this.hasRight(CriteriaNode)) {
            newNode.left = this.right;
            this.right.parent = newNode;
        }

        // update higher relationships
        newNode.parent = this;
        this.right = newNode;

        return newNode;
    }

    splice() {
        if (this.hasRight(CriteriaNode)) {
            throw new Error('Node has right child; can not splice');
        } else if (!this.hasLeft(CriteriaNode)) {
            throw new Error('Node has no left child; can not splice');
        } else if (!this.hasParent(CriteriaNode)) {
            this.left.parent = null;
        } else {
            this.parent.left = this.left;
            this.left.parent = this.parent;
        }

        const leftNode = this.left;
        this.parent = this.left = null;

        return leftNode;
    }

    prune() {
        if (this.hasLeft(CriteriaBranch)) this.left.prune();
        if (this.hasRight(CriteriaBranch)) this.right.prune();
        this.validateRelationships(true);

        return this.operator === Operator.NO_OP ? this.splice() : this;
    }

    toString() { return `${this.operator} : ${this.left}, ${this.right}`; }
}

class CriteriaLeaf extends CriteriaNode {
    constructor(columnId, comparator, values=null, valuesAreText=false,) {
        super();

        if ((typeof columnId) !== 'string' || !(comparator instanceof ComparatorDefinition)) {
            throw new Error('Could not create CriteriaLeaf: invalid parameters');
        }

        this.columnId      = columnId;
        this.comparator    = comparator;
        this.values        = values;
        this.valuesAreText = valuesAreText;
    }

    toString() { return (
        `${this.columnId} : ${this.comparator} : [${this.values.join(', ')}]${this.valuesAreText ? ' (text)' : ''}`
    ); }
}

class CriteriaNodeTraversalPath {
    constructor(initialNode) {
        this.indexPath = [0];
        this.nodePath  = [initialNode];
    }

    addLevel(node)    { this.indexPath.push(0); this.nodePath.push(node); return this; }
    updateLevel(node) { this.nodePath[this.nodePath.length - 1] = node; return this; }
    removeLevel()     { this.indexPath.pop(); this.nodePath.pop(); return this; }
    incrementLevel()  { if (this.indexPath.length > 0) ++this.indexPath[this.indexPath.length - 1]; return this; }

    getLastNode() { return this.nodePath[this.nodePath.length - 1]; }

    get length() { return this.indexPath.length; }
}

define(['N/record',], (record,) => {
    /**
     *
     * @param {Record} recordInst
     * @param {string} sublistId
     * @param {number} line
     * @param {string} fieldId
     * @param {object} options
     * @param {boolean} [options.valuesAreText] Get/set values as text
     * @param {boolean} [options.forceSyncSourcing]
     */
    function getSublistValues(recordInst, sublistId, line, fieldId, options={},) {
        if (recordInst.isDynamic) {
            if (recordInst.getCurrentSublistIndex({ sublistId: sublistId, }) !== line) {
                recordInst.selectLine({ sublistId: sublistId, line: line, });
            }

            if (options.valuesAreText) {
                return [].concat(recordInst.getCurrentSublistText({
                    sublistId: sublistId, fieldId: fieldId, forceSyncSourcing: options.forceSyncSourcing ?? false,
                }));
            } else {
                return [].concat(recordInst.getCurrentSublistValue({ sublistId: sublistId, fieldId: fieldId, }));
            }
        } else {
            if (options.valuesAreText) {
                return [].concat(recordInst.getSublistText({ sublistId: sublistId, line: line, fieldId: fieldId, }));
            } else {
                return [].concat(recordInst.getSublistValue({ sublistId: sublistId, line: line, fieldId: fieldId, }));
            }
        }
    }

    /**
     *
     * @param {Record} recordInst
     * @param {string} sublistId
     * @param {number} line
     * @param {string} fieldId
     * @param {*|*[]} values Values to be set
     * @param {object} options
     * @param {boolean} [options.valuesAreText] Get/set values as text
     * @param {boolean} [options.commit] Commit line (dynamic mode only)
     * @param {boolean} [options.ignoreFieldChange]
     * @param {boolean} [options.forceSyncSourcing]
     */
    function setSublistValues(recordInst, sublistId, line, fieldId, values, options={},) {
        const value = (Array.isArray(values) && values.length === 1) ? values[0] : values;

        if (recordInst.isDynamic) {
            if (recordInst.getCurrentSublistIndex({ sublistId: sublistId, }) !== line) {
                recordInst.selectLine({ sublistId: sublistId, line: line, });
            }

            if (options.valuesAreText) {
                recordInst.setCurrentSublistText({
                    sublistId: sublistId, fieldId: fieldId, text: value,
                    ignoreFieldChange: options.ignoreFieldChange ?? false,
                    forceSyncSourcing: options.forceSyncSourcing ?? false,
                });
            } else {
                recordInst.setCurrentSublistValue({
                    sublistId: sublistId, fieldId: fieldId, value: value,
                    ignoreFieldChange: options.ignoreFieldChange ?? false,
                    forceSyncSourcing: options.forceSyncSourcing ?? false,
                });
            }

            if (options.commit) {
                recordInst.commitLine({ sublistId: sublistId, });
            }
        } else {
            if (options.valuesAreText) {
                recordInst.setSublistText({ sublistId: sublistId, line: line, fieldId: fieldId, text: value, });
            } else {
                recordInst.setSublistValue({ sublistId: sublistId, line: line, fieldId: fieldId, value: value, });
            }
        }
    }

    /**
     * Provides a single-call interface to create a templated record via
     * quickUpdate
     *
     * @param {QuickCreateOptions} options
     * @returns {string|Record}
     */
    function quickCreate(options,) {
        return quickUpdate({
            record: record.create({ type: options?.type ?? null, isDynamic: options?.flags?.dynamic ?? false, }),
            procedure: (options.procedure ?? []).map(step =>
                (typeof step?.sublist) !== 'undefined' ? { ...step, edit: step.edit ?? false, } : step
            ),
            flags: options.flags,
        });
    }

    /**
     * Provides a single-call interface to perform "simple" record modifications
     *
     * @param {QuickUpdateOptions} options
     * @returns {string|Record}
     */
    function quickUpdate(options,) {
        const checkForValue = value => (typeof value) !== 'undefined';

        const procedure = options?.procedure ?? [];
        const workRecord = options?.record
            ?? record.load({ type: options?.type, id: options?.id, isDynamic: options?.flags?.dynamic ?? false, });

        const insertionCountMap = {};
        for (let stepIndex = 0; stepIndex < procedure.length; stepIndex++) {
            const throwStepError = msg => { throw new Error(`Step ${stepIndex + 1}: ${msg}`); }

            const step = procedure[stepIndex];
            if (
                (typeof step) === 'object'
                && (checkForValue(step.field) || (Array.isArray(step) && (typeof step[0]) === 'string'))
            ) {
                // step is simple, update field
                const stepIsArray = Array.isArray(step);

                const fieldId      = stepIsArray ? step[0] : step.field;
                const simpleValues = stepIsArray ? step[1] : step.values;
                const textValues   = stepIsArray ? (step[2] ? step[1] : undefined) : step.text;
                const flagSuppress = step?.flags?.suppressEvents ?? false;

                if (!checkForValue(fieldId)) {
                    throwStepError('No field ID was provided');
                } else if (checkForValue(simpleValues) && checkForValue(textValues)) {
                    throwStepError(`Simple and text field values must not be provided together (${fieldId})`);
                } else if (!checkForValue(simpleValues) && !checkForValue(textValues)) {
                    throwStepError(`No value was specified for "${fieldId}"`);
                }

                if (checkForValue(simpleValues)) {
                    workRecord.setValue({ fieldId: fieldId, value: simpleValues, ignoreFieldChange: flagSuppress, });
                } else {
                    workRecord.setText({ fieldId: fieldId, text: textValues, ignoreFieldChange: flagSuppress, });
                }
            } else if ((typeof step) === 'object' && checkForValue(step.sublist)) {
                // step is subprocedure, update sublist
                //TODO: validate that all necessary values are present for more descriptive errors

                const sublistId = step.sublist.toLowerCase();

                const initialLineCount = workRecord.getLineCount({ sublistId: sublistId, });  // initial for
                                                                                // subprocedure, not for execution
                if (!insertionCountMap.hasOwnProperty(sublistId)) {
                    insertionCountMap[sublistId] = Object.fromEntries(
                        Array.from({ length: (initialLineCount + 1), }, (_, index) => [index,0,])
                    );
                }

                const lineEditMode = step.edit ?? true;

                const specifiedLineIndices = [].concat(step.lines ?? []);       // unprocessed line indices
                const matchCriteriaRaw     = [].concat(step.criteria ?? []);    // line match criteria
                const matchSelections      = [].concat(step.selections ?? []);  // unprocessed line match selections

                const subprocedureSteps = [].concat(step.steps ?? []);

                if (matchCriteriaRaw.length > 0 && specifiedLineIndices.length > 0) {
                    throwStepError('Line indices and line match criteria must not be provided together');
                } else if (matchCriteriaRaw.length === 0 && matchSelections.length > 0) {
                    throwStepError('Line match selections should not be provided without match criteria');
                } else if (subprocedureSteps.length === 0) {
                    throwStepError(`No sub-steps were specified for subprocedure on "${sublistId}"`);
                }

                // Get unbounded line indices -- indices which may be positive, negative, zero, or null, may go outside
                // the allowed range, and are not adjusted for ongoing line insertions
                const unboundedLineIndices = [];
                if (matchCriteriaRaw.length > 0) {
                    if (matchSelections.length === 0) matchSelections.push(null);

                    const matchedIndices = getMatchingLines({
                        record:    workRecord,
                        sublistId: sublistId,
                        criteria:  matchCriteriaRaw,
                    });

                    for (let indexIndex = 0; indexIndex < matchedIndices.length; indexIndex++) {
                        if (matchSelections.includes(null) || matchSelections.includes(indexIndex)) {
                            unboundedLineIndices.push(matchedIndices[indexIndex]);
                        }
                    }
                } else {
                    if (specifiedLineIndices.length > 0) {
                        unboundedLineIndices.push(...specifiedLineIndices);
                    } else {
                        unboundedLineIndices.push(null);
                    }
                }

                // apply index offset, ensure all are in bounds
                for (let indexIndex = unboundedLineIndices.length - 1; indexIndex >= 0; indexIndex--) {
                    if ((typeof unboundedLineIndices[indexIndex]) === 'number') {
                        unboundedLineIndices[indexIndex] += step.offset ?? 0;
                    }

                    const unboundedIndex = unboundedLineIndices[indexIndex];
                    if ((unboundedIndex !== null && unboundedIndex >= 0)
                        ? unboundedIndex > (lineEditMode ? (initialLineCount - 1) : initialLineCount)
                        : unboundedIndex < (initialLineCount * -1)
                    ) {
                        if (step?.flags?.permissive ?? false) {
                            unboundedLineIndices.splice(indexIndex, 1,);  // out-of-bounds allowed, splice
                        } else {
                            throwStepError(`Some indices are out of bounds for "${sublistId}"`);  // not allowed, error
                        }
                    }
                }

                // Get adjusted line indices -- indices which are positive or zero and only occupy the allowed
                // range, adjusted for ongoing line insertions
                const adjustedLineIndices = [];
                if (lineEditMode && unboundedLineIndices.includes(null)) {
                    adjustedLineIndices.push(
                        ...Array.from({ length: initialLineCount, }, (_, index) => index)
                    );
                } else if (unboundedLineIndices.length > 0) {
                    for (const unboundedIndex of unboundedLineIndices) {
                        const boundedIndex = unboundedIndex === null
                            ? initialLineCount - 1
                            : unboundedIndex >= 0
                                ? unboundedIndex  // index is already bounded from 0 to length-1
                                : unboundedIndex < 0
                                    ? initialLineCount - unboundedIndex  // index is negative, subtract from length
                                    : initialLineCount;  // index is not a number, set at length (insertion past end)

                        adjustedLineIndices.push(lineEditMode
                            ? boundedIndex  // edit mode so do not adjust indices
                            : boundedIndex + Array.from({ length: boundedIndex, }, (_, index) => index).reduce(
                                (accumulator, previousIndex) =>  // sums adjustments excluding current index
                                    accumulator + insertionCountMap[sublistId][previousIndex],
                                0,
                            ) + insertionCountMap[sublistId][boundedIndex]++  // adjust for current index, with
                        );                                                    // postfix increment
                    }
                }

                // set column values
                for (const lineIndex of adjustedLineIndices) {
                    const currentLineCount = workRecord.getLineCount({ sublistId: sublistId, });

                    if (!lineEditMode) {
                        if (workRecord.isDynamic) {
                            if (lineIndex < currentLineCount) {
                                workRecord.insertLine({
                                    sublistId: sublistId, line: lineIndex,
                                    ignoreRecalc: step?.flags?.suppressRecalc ?? false,
                                });
                            } else {
                                workRecord.selectNewLine({ sublistId: sublistId, });
                            }
                        } else {
                            workRecord.insertLine({
                                sublistId: sublistId, line: lineIndex,
                                ignoreRecalc: step?.flags?.suppressRecalc ?? false,  //TODO: evaluate if this works here
                            });
                        }
                    }

                    for (let subStepIndex = 0; subStepIndex < subprocedureSteps.length; subStepIndex++) {
                        const subStep = subprocedureSteps[subStepIndex];
                        const lastSubStep = subStepIndex === subprocedureSteps.length - 1;
                        const subStepIsArray = Array.isArray(subStep);

                        const columnId     = subStepIsArray ? subStep[0] : subStep.column;
                        const simpleValues = subStepIsArray ? subStep[1] : subStep.values;
                        const textValues   = subStepIsArray ? (subStep[2] ? subStep[1] : undefined) : subStep.text;

                        if (!checkForValue(columnId)) {
                            throwStepError(`No column ID was provided`);
                        } else if (checkForValue(simpleValues) && checkForValue(textValues)) {
                            throwStepError(
                                `Simple and text column values must not be provided together (${columnId})`
                            );
                        } else if (!checkForValue(simpleValues) && !checkForValue(textValues)) {
                            throwStepError(`No value was specified for column "${columnId}"`);
                        }

                        setSublistValues(
                            workRecord, sublistId, lineIndex, columnId,
                            checkForValue(simpleValues) ? simpleValues : textValues,
                            {
                                valuesAreText: checkForValue(textValues),
                                commit: lastSubStep,
                                ignoreFieldChange: subStep?.flags?.suppressEvents ?? false,
                                forceSyncSourcing: subStep?.flags?.forceSyncSource ?? false,
                            },
                        );
                    }
                }
            } else {
                throwStepError('Invalid step definition');
            }
        }

        if (!options?.flags?.noSave) {
            return workRecord.save({
                enableSourcing:        options?.flags?.sourceOnSave ?? false,
                ignoreMandatoryFields: options?.flags?.ignoreOnSave ?? false,
            });
        } else {
            return workRecord;
        }
    }

    /**
     * Gets the indices of sublist lines that match the provided criteria
     *
     * @param {object} options
     * @param {Record} options.record
     * @param {string} options.sublistId
     * @param {QuickUpdateSubCriterion|(QuickUpdateSubCriterion|string|string[]|*[])[]} options.criteria
     * @returns {number[]}
     */
    function getMatchingLines(options) {
        const matchCriteriaTree = createCriteriaTree(options.criteria);

        const lineCount = options.record.getLineCount({ sublistId: options.sublistId, });
        const matchedIndices = [];
        for (let lineIndex = 0; lineIndex < lineCount; lineIndex++) {
            const evaluateNode = node => {
                if (!(node instanceof CriteriaNode)) {
                    return null;
                } if (node instanceof CriteriaLeaf) {
                    // compute leaf result
                    return node.comparator.compare(
                        getSublistValues(
                            options.record, options.sublistId, lineIndex, node.columnId,
                            { valuesAreText: node.valuesAreText, forceSyncSourcing: true, },
                        ),
                        node.values,
                    );
                } else {
                    // compute branch result, short-circuit if left child offers result
                    return node.operator.operateLeft(evaluateNode(node.left))
                        ?? node.operator.operateRight(evaluateNode(node.right));
                }
            }

            if (evaluateNode(matchCriteriaTree)) matchedIndices.push(lineIndex);
        }

        return matchedIndices;
    }

    /**
     * Create criteria tree object from criteria array, for filtering sublist line items on record update.
     *
     * @param {QuickUpdateSubCriterion|(QuickUpdateSubCriterion|string|string[]|*[])[]} originalCriteria
     */
    function createCriteriaTree(originalCriteria,) {
        const throwOperatorError = (op, msg) => { throw new Error(`Invalid operator position (${op}): ${msg??'?'}`); }

        const originalCriteriaArray = [].concat(originalCriteria);

        let workNode = new CriteriaBranch();
        const traversalPath = new CriteriaNodeTraversalPath(workNode);
        while (traversalPath.length > 0) {
            let cElement = originalCriteriaArray;  // criteria element
            for (const index of traversalPath.indexPath) cElement = cElement[index];

            if ((typeof cElement) === 'undefined') {
                traversalPath.removeLevel().incrementLevel();
                continue;
            }

            if ((typeof cElement) === 'string') {
                // current element is an operator (e.g. "AND", "NOT", etc)
                const operator = Operator.identify(cElement);

                if (operator === Operator.AND) {
                    // operator is AND, may traverse inward right
                    if (workNode.operator === Operator.NO_OP) {
                        workNode.operator = Operator.AND;  // update working node operator from NO-OP to AND
                    } else if (workNode.hasRight(CriteriaNode)) {
                        workNode = workNode.insertRight(Operator.AND);  // append new node right, traverse inward
                    } else {
                        throwOperatorError(operator, 'no right node');
                    }
                } else if (operator === Operator.OR) {
                    // operator is OR, may traverse outward
                    if (workNode.operator === Operator.NO_OP) {
                        workNode.operator = Operator.OR;   // update working node operator from NO-OP to OR
                    } else if (workNode.hasRight(CriteriaNode)) {
                        workNode = traversalPath.getLastNode().insertParent(Operator.OR);  // insert new parent node at
                        traversalPath.updateLevel(workNode);                               // path end, traverse outward
                    } else {
                        throwOperatorError(operator, 'no right node');
                    }
                } else if (operator === Operator.NOT) {
                    // operator is NOT, may traverse inward left or right
                    if (workNode.operator === Operator.NO_OP && !workNode.hasLeft(CriteriaNode)) {
                        workNode.operator = Operator.NOT;  // update working node operator from NO-OP to NOT
                    } else if (!workNode.hasLeft(CriteriaNode)) {
                        workNode = workNode.insertLeft(Operator.NOT,);   // append new node left, traverse inward
                    } else if (!workNode.hasRight(CriteriaNode)) {
                        workNode = workNode.insertRight(Operator.NOT,);  // append new node right, traverse inward
                    } else {
                        throwOperatorError(operator);  // unspecified error; probably no AND/OR preceding this NOT
                    }
                }

                traversalPath.incrementLevel();
            } else if (
                Array.isArray(cElement) && ((typeof cElement[0]) !== 'string' || (typeof cElement[1]) !== 'string')
            ) {
                // current element is an array, but not a definition array, so it must be an additional depth level; the
                // first two children of a criterion definition must be strings, and the only "bare" strings that may
                // occur in a depth level are operators -- two of which must not occur at the beginning of a depth level
                if (!workNode.hasLeft(CriteriaNode)) {
                    workNode = workNode.insertLeft(Operator.NO_OP,);   // append new node left, traverse inward
                } else if (!workNode.hasRight(CriteriaNode)) {
                    workNode = workNode.insertRight(Operator.NO_OP,);  // append new node right, traverse inward
                } else {
                    throw new Error('Invalid node state');
                }

                traversalPath.addLevel(workNode);
            } else if ((typeof cElement) === 'object') {
                const elementIsArray = Array.isArray(cElement);
                const valuesAreText = elementIsArray ? cElement[3] ?? false : (typeof cElement.values) === 'undefined';

                const newLeaf = new CriteriaLeaf(
                    elementIsArray ? cElement[0] : cElement.column,
                    Comparator.identify(elementIsArray ? cElement[1] : cElement.comparator),
                    [].concat(elementIsArray ? cElement[2] : valuesAreText ? cElement.text : cElement.values),
                    valuesAreText,
                );

                if (!workNode.hasLeft()) {
                    workNode.insertLeft(newLeaf);
                    if (workNode.operator === Operator.NOT) workNode = workNode.parent;
                } else if (!workNode.hasRight() && workNode.operator !== Operator.NOT) {
                    workNode.insertRight(newLeaf);
                } else {
                    throw new Error('Invalid criterion position');
                }

                traversalPath.incrementLevel();
            } else {
                new Error(`Could not parse current criteria element: ${JSON.stringify(cElement)}`);
            }
        }

        // validate and prune tree before returning
        return workNode.getRoot().prune();
    }

    return { Comparator, Operator, quickCreate, quickUpdate, getMatchingLines, createCriteriaTree, };
});
