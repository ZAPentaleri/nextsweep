/**
 *    __________ _ _____    ___
 *    \____   // ||   _  \  \  \
 *       /  //   ||  | \  \ |  |____       ___ __
 *     /  //  /  ||  |_/  //  // ___\___  / __\ |_
 *   /  //__/ |  ||   __//__/  \__ \/ . \|  _||  _|
 * /_________\|__||__| /__/(R)/____/\___/|_|  \__\
 *
 * NextSweep Record Module
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
 * @property {string|string[]|number|number[]|boolean} [value] Simple field value
 * @property {string|string[]} [text] Text field value
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
 * @property {number|number[]} [selections=0] Modify mode line match selection indices (positive, negative, or null for
 *     all matches)
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
 * @property {string|string[]} [text] Text field value to match against
 */

/**
 * @typedef {object} QuickUpdateSubStep
 * @property {string} column Column ID
 * @property {string|string[]|number|number[]|boolean|Date} [value] Simple field value
 * @property {string|string[]} [text] Text field value
 * @property {boolean} [flags.suppressEvents=false] Suppress field change events
 * @property {boolean} [flags.forceSyncSource=false] Force synchronous field sourcing
 */

class OperatorInstance {
    constructor() {
        this.name = arguments[0].toUpperCase();
        this.representations = [...arguments].map(op => op.toLowerCase());
    }
    toString() { return this.representations[0]; }
}

class Operator {
    static NO_OP = new OperatorInstance('nop',);
    static AND   = new OperatorInstance('and', '&&',);
    static OR    = new OperatorInstance('or',  '||',);
    static NOT   = new OperatorInstance('not', '!',);

    static identify(operator) {
        const candidates = [this.NO_OP, this.AND, this.OR, this.NOT,];

        for (const candidate of candidates) {
            if (operator === candidate || candidate.representations.includes(operator.toLowerCase())) return candidate;
        }

        throw new Error('Invalid operator');
    }
}

class Comparator {
    static ANY          = new OperatorInstance('any', 'anyof',);
    static EQUAL        = new OperatorInstance('eq', '==', '=', 'equalto', 'is',);
    static NOT_EQUAL    = new OperatorInstance('ne', '!=', '<>', 'notequalto', 'isnot',);
    static GREATER_THAN = new OperatorInstance('gt', '>', 'greaterthan',);
    static LESS_THAN    = new OperatorInstance('lt', '<', 'lessthan',);
    static GT_OR_EQUAL  = new OperatorInstance('ge', '>=', 'greaterthanorequalto',);
    static LT_OR_EQUAL  = new OperatorInstance('le', '<=', 'lessthanorequalto',);

    static identify(operator) {
        const candidates = [
            this.ANY,
            this.EQUAL,
            this.NOT_EQUAL,
            this.GREATER_THAN,
            this.LESS_THAN,
            this.GT_OR_EQUAL,
            this.LT_OR_EQUAL,
        ];

        for (const candidate of candidates) {
            if (operator === candidate || candidate.representations.includes(operator.toLowerCase())) return candidate;
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

class CriterionLeaf extends CriteriaNode {
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
                    } else if (workNode.hasRight(CriterionLeaf)) {
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
                    if (workNode.operator === Operator.NO_OP && !workNode.hasLeft(CriterionLeaf)) {
                        workNode.operator = Operator.NOT;  // update working node operator from no-op to NOT
                    } else if (!workNode.hasLeft(CriterionLeaf)) {
                        // new NOT left, traverse inward
                        workNode = workNode.left = new CriteriaBranch(workNode, Operator.NOT,);
                        branchRecord.push(workNode);
                    } else if (!workNode.hasRight(CriterionLeaf)) {
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

                if (!workNode.hasLeft(CriterionLeaf)) {
                    // new NO_OP left, traverse inward
                    workNode = workNode.left = new CriteriaBranch(workNode, Operator.NO_OP,);
                    branchRecord.push(workNode);
                } else if (!workNode.hasRight(CriterionLeaf)) {
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
                        newLeaf = new CriterionLeaf(
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
                    newLeaf = new CriterionLeaf(
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
                        if (branch.hasLeft(CriteriaBranch)) {
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

    return { Comparator, Operator, createCriteriaTree, };
});
