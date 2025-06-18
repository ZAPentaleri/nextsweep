/**
 *    __________ _ _____    ___
 *    \____   // ||   _  \  \  \
 *       /  //   ||  | \  \ |  |____       ___ __
 *     /  //  /  ||  |_/  //  // ___\___  / __\ |_
 *   /  //__/ |  ||   __//__/  \__ \/ . \|  _||  _|
 * /_________\|__||__| /__/(R)/____/\___/|_|  \__\
 *
 * NextSweep List Module: useful methods for accessing Custom Lists
 *
 * ZAPentaleri, 2025
 *
 * @NApiVersion 2.1
 */

const LIST_ERR_NAME = 'NEXT_FILE_ERROR';

define(['N/error', 'N/record', 'N/search',], (error, record, search,) => {
    class CustomListOrder {
        static THE_ORDER_ENTERED  = 'THE_ORDER_ENTERED';
        static ALPHABETICAL_ORDER = 'ALPHABETICAL_ORDER';
    }

    /**
     * @class
     * @property {string} value Entry label ("Value" in the UI)
     * @property {string} id Entry Script ID ("ID" in the UI)
     * @property {string} internalId Entry Internal ID (numeric ID)
     * @property {boolean} inactive Entry inactive flag
     */
    class CustomListEntry {
        constructor(value, id, internalId, inactive) {
            Object.defineProperty(this, 'value',      { value: value,                 writable: false, });
            Object.defineProperty(this, 'id',         { value: id.toLowerCase(),      writable: false, });
            Object.defineProperty(this, 'internalId', { value: internalId.toString(), writable: false, });
            Object.defineProperty(this, 'inactive',   { value: inactive,              writable: false, });
        }

        toJSON() { return JSON.stringify({
            value: this.value, id: this.id, internalId: this.internalId, inactive: this.inactive,
        }); }
    }

    /**
     * @class
     * @property {string} name List title
     * @property {string} id List Script ID
     * @property {string} internalId List Internal ID (numeric ID)
     * @property {string} owner List owner ID
     * @property {string} description List description
     * @property {string} order List entry order
     * @property {boolean} inactive Inactive flag
     * @property {CustomListEntry[]} entries List entries -- should not be used directly, use accessor functions instead
     */
    class CustomList {
        constructor(name, id, internalId, owner, description, order, inactive, entries) {
            Object.defineProperty(this, 'name',        { value: name,        writable: false, });
            Object.defineProperty(this, 'id',          { value: id,          writable: false, });
            Object.defineProperty(this, 'internalId',  { value: internalId,  writable: false, });
            Object.defineProperty(this, 'owner',       { value: owner,       writable: false, });
            Object.defineProperty(this, 'description', { value: description, writable: false, });
            Object.defineProperty(this, 'order',       { value: order,       writable: false, });
            Object.defineProperty(this, 'inactive',    { value: inactive,    writable: false, });
            Object.defineProperty(this, 'entries', {
                value: Object.freeze(entries.map(entryParams => Object.freeze(new CustomListEntry(...entryParams)))),
                writable: false,
            });
        }

        /**
         * Unserializes a JSON representation of a CustomList object into a
         * new CustomList object
         *
         * @returns {CustomList}
         */
        static fromJSON(jsonList) {
            const obj = JSON.parse(jsonList);
            return new CustomList(
                obj.name, obj.id, obj.internalId, obj.owner, obj.description, obj.order, obj.inactive,
                obj.entries.map(entryObj => [entryObj.value, entryObj.id, entryObj.internalId, entryObj.inactive,]),
            );
        }

        /**
         * Serializes a JSON representation of the CustomList object
         *
         * @returns {object}
         */
        toJSON() { return JSON.stringify({
            name: this.name, id: this.id, internalId: this.internalId, owner: this.owner,
            description: this.description, order: this.order, inactive: this.inactive,
            entries: this.entries.map(entry => entry.toJSON()),
        }); }

        /**
         * Get a list entry by index -- adjusted for inactive entries; i.e. the
         * second entry will correspond to index=0 if the first entry is flagged
         * inactive
         *
         * @param {number} index List entry index (adjusted for inactive entries)
         * @param {boolean} [includeInactive=false] Include inactive-flagged entries
         * @returns {CustomListEntry|undefined}
         */
        get(index, includeInactive=false) {
            if (index >= this.entries.length || index < -this.entries.length) return undefined;
            let adjustedIndex = index >= 0 ? 0 : -1;
            let step = index >= 0 ? 1 : -1;
            for (let i = adjustedIndex; index >= 0 ? i < this.entries.length : i >= -this.entries.length; i += step) {
                if ((!this.entries[i].inactive || includeInactive) && adjustedIndex === index) {
                    return this.entries[i];
                } else if (!this.entries[i].inactive || includeInactive) {
                    if (i >= 0) adjustedIndex++;
                    else adjustedIndex--;
                }
            }
            return undefined;
        }

        /**
         * Get a list entry by Script ID (labeled "ID" in the UI)
         *
         * @param {string} scriptId List entry Script ID
         * @param {boolean} [includeInactive=true] Include inactive-flagged entries
         * @returns {CustomListEntry|undefined}
         */
        getById(scriptId, includeInactive=true) {
            for (const entry of this.entries) {
                if (entry.id === scriptId.toLowerCase())
                    return (!entry.inactive || includeInactive) ? entry : undefined;
            }
            return undefined;
        }

        /**
         * Get a list entry by Internal ID -- should not be relied on, as the
         * value is not guaranteed to be consistent across accounts for deployed
         * lists
         *
         * @param {string} internalId List entry internal ID (not guaranteed to be consistent across accounts for
         *     deployed lists)
         * @param {boolean} [includeInactive=true] Include inactive-flagged entries
         * @returns {CustomListEntry|undefined}
         */
        getByInternalId(internalId, includeInactive=true) {
            for (const entry of this.entries) {
                if (entry.internalId === internalId.toString())
                    return (!entry.inactive || includeInactive) ? entry : undefined;
            }
            return undefined;
        }

        /**
         * Get all list entries
         *
         * @returns {CustomListEntry[]}
         */
        getAll() { return [...this.entries]; }

        /**
         * Get all active list entries
         *
         * @returns {CustomListEntry[]}
         */
        getActive() { return this.entries.filter(entry => !entry.inactive); }

        /**
         * Get all inactive list entries
         *
         * @returns {CustomListEntry[]}
         */
        getInactive() { return this.entries.filter(entry => entry.inactive); }
    }

    /**
     * Load a Custom List by Script ID ("id") or Internal ID ("internalId")
     *
     * @param {object} options
     * @param {string} [options.id] List Script ID
     * @param {string} [options.internalId] List Internal ID
     * @returns {CustomList}
     */
    function load(options) {
        if ((typeof options.id) === 'undefined' && (typeof options.internalId) === 'undefined')
            throw error.create({ message: 'No list ID was provided', name: LIST_ERR_NAME, });
        if ((typeof options.id) !== 'undefined' && (typeof options.internalId) !== 'undefined')
            throw error.create({ message: 'ID and Script ID should not both be provided', name: LIST_ERR_NAME, });

        // list records can't be loaded by script ID, so fetch internal ID if required
        const listId = options.internalId ?? search.create({
            type: 'customlist',
            filters: [['scriptid', 'is', options.id,]],
        }).run().getRange({ start: 0, end: 1, })?.[0]?.id ?? null;

        if (listId === null) throw error.create({
            message: `List matching "${options.id ?? options.internalId}" could not be found`, name: LIST_ERR_NAME, });

        // load list record -- entries can be retrieved via search, but the entry order is only shown on the record
        const listRecord = record.load({ type: 'customlist', id: listId, });
        return new CustomList(
            listRecord.getValue({ fieldId: 'name' }),
            listRecord.getValue({ fieldId: 'scriptid' }),
            listRecord.getValue({ fieldId: 'id' }),
            listRecord.getValue({ fieldId: 'owner' }),
            listRecord.getValue({ fieldId: 'description' }),
            listRecord.getValue({ fieldId: 'isordered' }) === 'T'  // for some reason, this one is returned as a string
                ? CustomListOrder.THE_ORDER_ENTERED
                : CustomListOrder.ALPHABETICAL_ORDER,
            listRecord.getValue({ fieldId: 'isinactive' }),
            [...Array(listRecord.getLineCount({ sublistId: 'customvalue', }))].map((_, lineIndex) => [
                listRecord.getSublistValue({ sublistId: 'customvalue', line: lineIndex, fieldId: 'value', }),
                listRecord.getSublistValue({ sublistId: 'customvalue', line: lineIndex, fieldId: 'scriptid', }),
                listRecord.getSublistValue({ sublistId: 'customvalue', line: lineIndex, fieldId: 'valueid', }),
                listRecord.getSublistValue({ sublistId: 'customvalue', line: lineIndex, fieldId: 'isinactive', }),
            ]),
        );
    }

    return { CustomListOrder, CustomList, load, };
});
