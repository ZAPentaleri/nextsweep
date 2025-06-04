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
 * @typedef {object} QuickUpdateOptions
 * @property {Record} [record] Record instance
 * @property {string} [type] Record type
 * @property {string} [id] Record ID
 * @property {(QuickUpdateStep|QuickUpdateSubprocedure)[]} procedure Record modification procedure
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
 * @property {boolean} [edit=false] Flag to enable line edit mode (defaults to insertion mode)
 * @property {number|number[]|null} [lines=null] Insertion/edit line indices (positive, negative, or null). In insertion
 *     mode, null stands for insertion at the end of the sublist; in edit mode, null stands for all lines. Insertion
 *     line indices represent positions *prior* to any insertions; Case 1: indices 0 (A) and 1 (B) are provided,
 *     rendering new line positions of 0 (A) and 2 (B); Case 2: identical indices 3 (A) and 3 (B) are provided,
 *     rendering new line positions of 3 (A) and 4 (B).
 * @property {QuickUpdateSubCriterion|(QuickUpdateSubCriterion|string|string[]|*[])[]} [criteria] Modify mode line match
 *     criteria
 * @property {number|number[]} [selections=null] Modify mode line match selection indices (positive, negative, or null
 *     for all matches)
 * @property {number} [offset=0] Specified/matched line index offset
 * @property {QuickUpdateSubStep[]} steps Subprocedure steps
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

class OperatorDefinition {
    /**
     * @param {string[]} representations
     * @param {function} leftOperator
     * @param {function} rightOperator
     */
    constructor(representations, leftOperator=(x=>null), rightOperator=(y=>null)) {
        this.name = representations[0].toUpperCase();
        this.representations = representations.map(op => op.toLowerCase());

        this.leftOperator  = leftOperator;
        this.rightOperator = rightOperator;
    }

    operateLeft(x)  { return this.leftOperator(x); }
    operateRight(y) { return this.rightOperator(y); }

    toString() { return this.representations[0]; }
}

class Operator {
    static NO_OP = new OperatorDefinition(['nop',],       x=>x,);
    static AND   = new OperatorDefinition(['and', '&&',], x=>!x?false:null, y=>y,);
    static OR    = new OperatorDefinition(['or',  '||',], x=>x||null, y=>y===true,);
    static NOT   = new OperatorDefinition(['not', '!',],  x=>!x,);

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
        ['any', 'anyof',],
        (x, y) => y.some(yVal => x.some(xVal => xVal == yVal)),                 // ignore warning
    );
    static NONE = new ComparatorDefinition(
        ['none', 'noneof',],
        (x, y) => y.every(yVal => x.every(xVal => xVal != yVal)),               // ignore warning
    );
    static EQUAL = new ComparatorDefinition(
        ['eq', '==', '=', 'equalto', 'is',],
        (x, y) => y.length === x.length && y.every(y => x.some(x => x == y)),   // ignore warning
    );
    static NOT_EQUAL = new ComparatorDefinition(
        ['ne', '!=', '<>', 'notequalto', 'isnot',],
        (x, y) => y.length !== x.length || y.every(y => x.every(x => x != y)),  // ignore warning,
    );
    static GREATER_THAN = new ComparatorDefinition(
        ['gt', '>', 'greaterthan',],
        (x, y) => y.every(y => x.every(x => x > y)),
    );
    static LESS_THAN = new ComparatorDefinition(
        ['lt', '<', 'lessthan',],
        (x, y) => y.every(y => x.every(x => x < y)),
    );
    static GT_OR_EQUAL = new ComparatorDefinition(
        ['ge', '>=', 'greaterthanorequalto',],
        (x, y) => y.every(y => x.every(x => x >= y)),
    );
    static LT_OR_EQUAL = new ComparatorDefinition(
        ['le', '<=', 'lessthanorequalto',],
        (x, y) => y.every(y => x.every(x => x <= y)),
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

class CriteriaRelationship {
    static PARENT = 'parent';
    static LEFT   = 'left';
    static RIGHT  = 'right';
    static NONE   = 'none';
}

class CriteriaNode {
    constructor(parent=null, left=null, right=null,) {
        this.parent = parent;
        this.left   = left;
        this.right  = right;
    }

    getRelationship(node) {
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

    hasParent(nClass=null) { return nClass !== null ? this.parent instanceof nClass : this.parent !== null; }
    hasLeft(nClass=null)   { return nClass !== null ? this.left   instanceof nClass : this.left   !== null; }
    hasRight(nClass=null)  { return nClass !== null ? this.right  instanceof nClass : this.right  !== null; }
    hasChildren()          { return this.left !== null || this.right !== null }

    isRoot() { return !this.hasParent() }
}

class CriteriaBranch extends CriteriaNode {
    constructor(parent=null, operator=Operator.NO_OP, left=null,) {
        super(parent, left,);
        this.operator = operator;

        if (this.hasLeft(CriteriaBranch)) {
            left.parent = this;
        }
    }

    toString() {
        return `${this.operator} : ${this.left}, ${this.right}`;
    }
}

class CriteriaLeaf extends CriteriaNode {
    constructor(parent, columnId, comparator, values, valuesAreText=false,) {
        super(parent,);
        this.columnId      = columnId;
        this.comparator    = comparator;
        this.values        = values;
        this.valuesAreText = valuesAreText;
    }

    toString() {
        return (
            `${this.columnId} : ${this.comparator} : [${this.values.join(', ')}]${this.valuesAreText ? ' (text)' : ''}`
        );
    }
}

define(['N/record',], (record,) => {
    /**
     *
     * @param {Record} recordInst
     * @param {string} sublistId
     * @param {integer} line
     * @param {string} fieldId
     * @param {object} options
     * @param {boolean} [options.commit] Commit line (dynamic mode only)
     * @param {boolean} [options.set] Set value
     * @param {*[]} [options.values] Values to be set
     * @param {boolean} [options.valuesAreText] Get/set values as text
     * @param {boolean} [options.ignoreFieldChange]
     * @param {boolean} [options.forceSyncSourcing]
     */
    function getOrSetSublistValues(recordInst, sublistId, line, fieldId, options={},) {
        const value = options.values?.length === 1 ? options.values[0] : options.values;

        if (recordInst.isDynamic) {
            if (recordInst.getCurrentSublistIndex({ sublistId: sublistId, }) !== line) {
                recordInst.selectLine({ sublistId: sublistId, line: line, });
            }

            if (options.set) {
                if (options.valuesAreText) {
                    recordInst.setCurrentSublistText({
                        sublistId: sublistId,
                        fieldId:   fieldId,
                        text:      value,
                        ignoreFieldChange: options.ignoreFieldChange ?? false,
                        forceSyncSourcing: options.forceSyncSourcing ?? false,
                    });
                } else {
                    recordInst.setCurrentSublistValue({
                        sublistId: sublistId,
                        fieldId:   fieldId,
                        value:     value,
                        ignoreFieldChange: options.ignoreFieldChange ?? false,
                        forceSyncSourcing: options.forceSyncSourcing ?? false,
                    });
                }

                if (options.commit) {
                    recordInst.commitLine({ sublistId: sublistId, });
                }
            } else {
                if (options.valuesAreText) {
                    return [].concat(recordInst.getCurrentSublistText({
                        sublistId: sublistId,
                        fieldId:   fieldId,
                        forceSyncSourcing: options.forceSyncSourcing ?? false,
                    }));
                } else {
                    return [].concat(recordInst.getCurrentSublistValue({ sublistId: sublistId, fieldId: fieldId, }));
                }
            }
        } else {
            if (options.set) {
                if (options.text) {
                    recordInst.setSublistText({ sublistId: sublistId, line: line, fieldId: fieldId, text: value, });
                } else {
                    recordInst.setSublistValue({ sublistId: sublistId, line: line, fieldId: fieldId, value: value, });
                }
            } else {
                if (options.text) {
                    recordInst.getSublistText({ sublistId: sublistId, line: line, fieldId: fieldId, });
                } else {
                    recordInst.getSublistValue({ sublistId: sublistId, line: line, fieldId: fieldId, });
                }
            }
        }
    }

    /**
     * Provides a single-call interface to perform "simple" record modifications
     *
     * @param {QuickUpdateOptions} options
     * @returns {string|Record}
     */
    function quickUpdate(options,) {
        const checkForValue = value => (typeof value) !== 'undefined';
        const stepIsSubprocedure = step => (typeof step) === 'object' && checkForValue(step.sublist);
        const stepIsSimple = step => (typeof step) === 'object' && !stepIsSubprocedure(step);

        const recordType  = options?.type ?? null;
        const recordId    = options?.id ?? null;

        const flagLoadRecordInDynamicMode     = options?.flags?.dynamic ?? false;
        const flagSourceDependentFieldsOnSave = options?.flags?.sourceOnSave ?? false;
        const flagIgnoreMandatoryFieldsOnSave = options?.flags?.ignoreOnSave ?? false;
        const flagDoNotSaveAfterModifications = options?.flags?.noSave ?? false;

        const procedure = options?.procedure ?? [];

        const recordInst = options?.record ?? record.load({
            type:      recordType,
            id:        recordId,
            isDynamic: flagLoadRecordInDynamicMode,
        });

        const insertionCountMap = {};
        for (let stepIndex = 0; stepIndex < procedure.length; stepIndex++) {
            const step = procedure[stepIndex];

            if (stepIsSimple(step)) {
                const flagSuppress = step?.flags?.suppressEvents ?? false;

                if (!checkForValue(step.field)) {
                    throw new Error(`Step #${stepIndex+1}: No field ID was provided`);
                } else if (checkForValue(step.values) && checkForValue(step.text)) {
                    throw new Error(
                        `Step #${stepIndex+1}: Simple field value and text field value must not be provided `
                        + `together (${step.field})`
                    );
                } else if (!checkForValue(step.values) && !checkForValue(step.text)) {
                    throw new Error(`Step #${stepIndex+1}: No value was specified for "${step.field}"`);
                }

                if (checkForValue(step.values)) {
                    recordInst.setValue({ fieldId: step.field, value: step.values, ignoreFieldChange: flagSuppress, });
                } else {
                    recordInst.setText({ fieldId: step.field, text: step.text, ignoreFieldChange: flagSuppress, });
                }
            } else if (stepIsSubprocedure(step)) {
                //TODO: validate that all necessary values are present for more descriptive errors

                const sublistId = step.sublist.toLowerCase();

                const initialLineCount = recordInst.getLineCount({ sublistId: sublistId, });  // initial for
                                                                                // subprocedure, not for execution
                if (!insertionCountMap.hasOwnProperty(sublistId)) {
                    insertionCountMap[sublistId] = Object.fromEntries(
                        Array.from({ length: (initialLineCount + 1), }, (_, index) => [index,0,])
                    );
                }

                const lineEditMode = step.edit ?? false;

                const flagAllowOutOfBoundsIndices = step?.flags?.permissive ?? false;

                const specifiedLineIndices = [].concat(step.lines ?? []);       // unprocessed line indices
                const matchCriteriaRaw     = [].concat(step.criteria ?? []);    // line match criteria
                const matchSelections      = [].concat(step.selections ?? []);  // unprocessed line match selections

                const subprocedureSteps = [].concat(step.steps ?? []);

                if (matchCriteriaRaw.length > 0 && specifiedLineIndices.length > 0) {
                    throw new Error(
                        `Step #${stepIndex+1}: Line indices and line match criteria must not be provided together`
                    );
                } else if (matchCriteriaRaw.length === 0 && matchSelections.length > 0) {
                    throw new Error(
                        `Step #${stepIndex+1}: Line match selections should not be provided without match criteria`
                    );
                } else if (subprocedureSteps.length === 0) {
                    throw new Error(
                        `Step #${stepIndex+1}: No sub-steps were specified for subprocedure on "${sublistId}"`
                    );
                }

                // Get unbounded line indices -- indices which may be positive, negative, zero, or null, may go outside
                // the allowed range, and are not adjusted for ongoing line insertions
                const unboundedLineIndices = [];
                if (matchCriteriaRaw.length > 0) {
                    if (matchSelections.length === 0) matchSelections.push(null);

                    const matchedIndices = getMatchingLines({
                        record:    recordInst,
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

                // apply index offset
                for (let indexIndex = 0; indexIndex < unboundedLineIndices.length; indexIndex++) {
                    if ((typeof unboundedLineIndices[indexIndex]) === 'number') {
                        unboundedLineIndices[indexIndex] += step.offset ?? 0;
                    }
                }

                // check if indices are in bounds
                const checkIndexBounds = index => index >= 0
                    ? index <= (lineEditMode ? (initialLineCount - 1) : initialLineCount)
                    : index >= (initialLineCount * -1);

                if (!unboundedLineIndices.every(checkIndexBounds)) {
                    if (flagAllowOutOfBoundsIndices) {
                        for (let indexIndex = unboundedLineIndices.length - 1; indexIndex >= 0; indexIndex--) {
                            if (!checkIndexBounds(unboundedLineIndices[indexIndex])) {
                                unboundedLineIndices.splice(indexIndex, 1,);
                            }
                        }
                    } else {
                        throw new Error(`Step #${stepIndex+1}: Some indices are out of bounds for "${sublistId}"`);
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
                        const boundedIndex = unboundedIndex >= 0
                            ? unboundedIndex  // index is already bounded from 0 to length-1
                            : unboundedIndex < 0
                                ? initialLineCount - unboundedIndex  // index is negative, subtract from length
                                : initialLineCount;  // index is not a number, set at length (insertion past end)

                        if (lineEditMode) {
                            adjustedLineIndices.push(boundedIndex);
                        } else {
                            adjustedLineIndices.push(
                                boundedIndex
                                + Array.from({ length: boundedIndex, }, (_, index) => index).reduce(
                                    (accumulator, previousIndex) =>  // sums adjustments excluding current index
                                        accumulator + insertionCountMap[sublistId][previousIndex],
                                    0,
                                ) + insertionCountMap[sublistId][boundedIndex]++  // current index adjustment, with
                            );                                                    // postfix increment
                        }
                    }
                }

                // set column values
                for (const lineIndex of adjustedLineIndices) {
                    const currentLineCount = recordInst.getLineCount({ sublistId: sublistId, });

                    if (!lineEditMode) {
                        if (recordInst.isDynamic) {
                            if (lineIndex < currentLineCount) {
                                recordInst.insertLine({
                                    sublistId:    sublistId,
                                    line:         lineIndex,
                                    ignoreRecalc: step?.flags?.suppressRecalc ?? false,
                                });
                            } else {
                                recordInst.selectNewLine({ sublistId: sublistId, });
                            }
                        } else {
                            recordInst.insertLine({
                                sublistId:    sublistId,
                                line:         lineIndex,
                                ignoreRecalc: step?.flags?.suppressRecalc ?? false,  //TODO: evaluate if this works here
                            });
                        }
                    }

                    for (let subStepIndex = 0; subStepIndex < subprocedureSteps.length; subStepIndex++) {
                        const subStep = subprocedureSteps[subStepIndex];
                        const lastSubStep = subStepIndex === subprocedureSteps.length - 1;

                        const flagSuppressEvents  = subStep?.flags?.suppressEvents ?? false;
                        const flagForceSyncSource = subStep?.flags?.forceSyncSource ?? false;

                        if (!checkForValue(subStep.column)) {
                            throw new Error(
                                `Sub-Step #${subStepIndex+1}: No column ID was provided`
                            );
                        } else if (checkForValue(subStep.values) && checkForValue(subStep.text)) {
                            throw new Error(
                                `Sub-Step #${subStepIndex+1}: Simple column value and text column value must not `
                                + `be provided together (${subStep.column})`
                            );
                        } else if (!checkForValue(subStep.values) && !checkForValue(subStep.text)) {
                            throw new Error(
                                `Step #${subStepIndex+1}: No value was specified for "${subStep.field}"`
                            );
                        }

                        getOrSetSublistValues(
                            recordInst,
                            sublistId,
                            lineIndex,
                            subStep.column,
                            {
                                commit: lastSubStep,
                                set: true,
                                values: [].concat(subStep.values),
                                valuesAreText: checkForValue(subStep.text),
                                ignoreFieldChange: flagSuppressEvents,
                                forceSyncSourcing: flagForceSyncSource,
                            },
                        );
                    }
                }
            } else {
                throw new Error(`Step #${stepIndex+1}: Invalid step definition`);
            }
        }

        if (!flagDoNotSaveAfterModifications) {
            return recordInst.save({
                enableSourcing:        flagSourceDependentFieldsOnSave,
                ignoreMandatoryFields: flagIgnoreMandatoryFieldsOnSave,
            });
        } else {
            return recordInst;
        }
    }

    /**
     * Gets the indices of sublist lines that match the provided criteria
     *
     * @param {object} options
     * @param {Record} options.record
     * @param {string} options.sublistId
     * @param {QuickUpdateSubCriterion|(QuickUpdateSubCriterion|string|string[]|*[])[]} options.criteria
     * @returns {integer[]}
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
                        getOrSetSublistValues(
                            options.record, options.sublistId, lineIndex, node.columnId,
                            { set: false, valuesAreText: node.valuesAreText, forceSyncSourcing: true, },
                        ),
                        node.values,
                    );
                } else {
                    // compute branch result, short-circuit if left child offers result
                    return (
                        node.operator.operateLeft(evaluateNode(node.left))
                        ?? node.operator.operateRight(evaluateNode(node.right))
                    );
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
        const throwOperatorError = (op, msg) => { throw new Error(`Invalid operator position (${op}: ${msg??'?'})`); }
        const incrementTraversalPath = path => path.length > 0 && ++path[path.length - 1];

        let rootNode = new CriteriaBranch();
        let workNode = rootNode;

        const traversalPath  = [0];
        const traversalNodes = [rootNode];
        const branchRecord     = [rootNode];
        do {
            let cElement;  // criteria element

            do {
                cElement = originalCriteria;

                for (const index of traversalPath) {
                    cElement = cElement[index];
                }

                if ((typeof cElement) === 'undefined') {
                    traversalPath.pop();
                    traversalNodes.pop();
                    incrementTraversalPath(traversalPath);
                }
            } while ((typeof cElement) === 'undefined')

            if (traversalPath.length === 0) {
                break;  //TODO: reevaluate redundancy of this break
            } else if ((typeof cElement) === 'string') {
                // current element is an operator (e.g. "AND", "NOT", etc)

                const operator = Operator.identify(cElement);

                if (operator === Operator.AND) {
                    // operator is AND, may traverse inward right
                    if (workNode.operator === Operator.NO_OP) {
                        workNode.operator = Operator.AND;  // update working node operator from no-op to AND
                    } else if (workNode.hasRight(CriteriaLeaf)) {
                        const oldRight = workNode.right;   // store old right
                        workNode = workNode.right = new CriteriaBranch(workNode, Operator.AND, oldRight,);  // new AND
                                                           // right, relocating old right to new's left; traverse in
                        branchRecord.push(workNode);
                    } else {
                        throwOperatorError(operator);
                    }
                } else if (operator === Operator.OR) {
                    // operator is OR, may traverse outward
                    if (workNode.operator === Operator.NO_OP) {
                        workNode.operator = Operator.OR;   // update working node operator
                    } else if (!workNode.hasRight(CriteriaNode)) {
                        throwOperatorError(operator, 'no right node');  // throw error for invalid node state
                    } else {
                        const tNodeIndex = traversalNodes.length - 1;
                        workNode = traversalNodes[tNodeIndex];

                        if (workNode.isRoot()) {
                            // new root, traverse outward
                            traversalNodes[0] = rootNode = workNode = new CriteriaBranch(null, Operator.OR, workNode,);
                            branchRecord.push(workNode);
                        } else {
                            // insert new branch at current position
                            const parent    = workNode.parent;
                            const leftChild = workNode;
                            const parentRelationship = workNode.parent.getRelationship(workNode);

                            traversalNodes[tNodeIndex] = leftChild.parent = parent[parentRelationship] = workNode =
                                new CriteriaBranch(parent, Operator.OR, leftChild,);
                            branchRecord.push(workNode);
                        }
                    }
                } else if (operator === Operator.NOT) {
                    // operator is NOT, may traverse inward left or right
                    if (workNode.operator === Operator.NO_OP && !workNode.hasLeft(CriteriaLeaf)) {
                        workNode.operator = Operator.NOT;  // update working node operator from no-op to NOT
                    } else if (!workNode.hasLeft(CriteriaLeaf)) {
                        // new NOT left, traverse inward
                        workNode = workNode.left = new CriteriaBranch(workNode, Operator.NOT,);
                        branchRecord.push(workNode);
                    } else if (!workNode.hasRight(CriteriaLeaf)) {
                        // new NOT right, traverse inward
                        workNode = workNode.right = new CriteriaBranch(workNode, Operator.NOT,);
                        branchRecord.push(workNode);
                    } else {
                        throwOperatorError(operator);  // unspecified error; probably no AND/OR preceding this NOT
                    }
                }

                incrementTraversalPath(traversalPath);
            } else if (
                Array.isArray(cElement)
                && ((typeof cElement[0]) !== 'string' || (typeof cElement[1]) !== 'string')
            ) {
                // current element is an array, but not a definition array, so it must be an additional depth level; the
                // first two children of a criterion definition must be strings, and the only "bare" strings that may
                // occur in a depth level are operators -- two of which must not occur at the beginning of a depth level

                if (!workNode.hasLeft(CriteriaLeaf)) {
                    // new NO_OP left, traverse inward
                    workNode = workNode.left = new CriteriaBranch(workNode, Operator.NO_OP,);
                    branchRecord.push(workNode);
                } else if (!workNode.hasRight(CriteriaLeaf)) {
                    // new NO_OP right, traverse inward
                    workNode = workNode.right = new CriteriaBranch(workNode, Operator.NO_OP,);
                    branchRecord.push(workNode);
                } else {
                    throw new Error('Invalid node state');
                }

                traversalNodes.push(workNode);
                traversalPath.push(0);
            } else {
                let newLeaf = null;
                if ((typeof cElement) === 'object' && !Array.isArray(cElement)) {
                    if (
                        (typeof cElement.column) === 'string'
                        || (typeof cElement.comparator) === 'string'
                        || ((typeof cElement.values) !== 'undefined' || (typeof cElement.text) !== 'undefined')
                    ) {
                        const valuesAreText = (typeof cElement.values) === 'undefined';  // if not basic, must be text
                        newLeaf = new CriteriaLeaf(
                            workNode,
                            cElement.column,
                            Comparator.identify(cElement.comparator),
                            [].concat(!valuesAreText ? cElement.values : cElement.text),
                            valuesAreText,
                        );
                    } else {
                        new Error(`Could not parse current criteria element: ${JSON.stringify(cElement)}`);
                    }
                } else if (
                    Array.isArray(cElement)
                    && ((typeof cElement[0]) === 'string' && (typeof cElement[1]) === 'string')
                ) {
                    // current element is assumed to be a criterion definition array (e.g. ["id", "==", "123"])
                    newLeaf = new CriteriaLeaf(
                        workNode,
                        cElement[0],
                        Comparator.identify(cElement[1]),
                        [].concat(cElement[2]),
                        cElement[3] ?? false
                    );
                } else {
                    new Error(`Could not parse current criteria element: ${JSON.stringify(cElement)}`);
                }

                if (workNode.left === null) {
                    workNode.left = newLeaf;

                    if (workNode.operator === Operator.NOT) {
                        workNode = workNode.parent;
                    }
                } else if (workNode.right === null && workNode.operator !== Operator.NOT) {
                    workNode.right = newLeaf;
                } else {
                    throw new Error('Invalid criterion position');
                }

                incrementTraversalPath(traversalPath);
            }
        } while (traversalPath.length > 0)

        // validate and prune tree
        for (const branch of branchRecord) {
            switch (branch.operator) {
                case Operator.NO_OP: {
                    if (branch.hasRight()) {
                        throw new Error('Invalid criteria tree state: NO-OP branch has right child');
                    } else if (branch.isRoot()) {
                        // branch is root, set left child as new root
                        if (branch.hasLeft(CriteriaNode)) {
                            rootNode = branch.left;
                            rootNode.parent = null;
                        }
                    } else {
                        // branch is not root, prune from tree
                        branch.parent.left = branch.left;
                        branch.left.parent = branch.parent;
                    }

                    break;
                }
                case Operator.AND:
                case Operator.OR: {
                    if (!branch.hasChildren()) {
                        throw new Error(`Invalid criteria tree state: ${branch.operator} branch has no children`);
                    } else if (!branch.hasLeft()) {
                        throw new Error(`Invalid criteria tree state: ${branch.operator} branch has no left child`);
                    } else if (!branch.hasRight()) {
                        throw new Error(`Invalid criteria tree state: ${branch.operator} branch has no right child`);
                    }

                    break;
                }
                case Operator.NOT: {
                    if (!branch.hasLeft()) {
                        throw new Error('Invalid criteria tree state: NOT branch has no left child');
                    } else if (branch.hasRight()) {
                        throw new Error('Invalid criteria tree state: NOT branch has right child');
                    }

                    break;
                }
            }
        }

        return rootNode;
    }

    return { Comparator, Operator, quickUpdate, getMatchingLines, createCriteriaTree, };
});
