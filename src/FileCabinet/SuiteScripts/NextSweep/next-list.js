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
    class CustomListEntry {
        constructor(id, internalId, value, inactive) {
            Object.defineProperty(this, 'value',      { value: value,                 writable: false, });
            Object.defineProperty(this, 'id',         { value: id.toLowerCase(),      writable: false, });
            Object.defineProperty(this, 'internalId', { value: internalId.toString(), writable: false, });
            Object.defineProperty(this, 'inactive',   { value: inactive,              writable: false, });
        }
    }
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
                value: Object.freeze(entries.map(entry => Object.freeze(new CustomListEntry(...entry)))),
                writable: false,
            });
        }


        /**
         * Get a list entry by index -- adjusted for inactive entries; i.e. the
         * second entry will correspond to index=0 if the first entry is flagged
         * inactive
         *
         * @param {number} index List entry index (adjusted for inactive entries)
         * @param {boolean} [includeInactive] Include inactive-flagged entries
         * @returns {CustomListEntry|undefined}
         */
        get(index, includeInactive=false) {
            if (index >= this.entries.length || index < -this.entries.length) return undefined;
            let adjustedIndex = index >= 0 ? 0 : -1;
            for (
                let i = index >= 0 ? 0 : -1;
                index >= 0 ? i < this.entries.length : i >= -this.entries.length;
                index >= 0 ? i++ : i--
            ) {
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
         * @param {boolean} [includeInactive] Include inactive-flagged entries
         * @returns {CustomListEntry|undefined}
         */
        getById(scriptId, includeInactive=false) {
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
         * @param {boolean} [includeInactive] Include inactive-flagged entries
         * @returns {CustomListEntry|undefined}
         */
        getByInternalId(internalId, includeInactive=false) {
            for (const entry of this.entries) {
                if (entry.internalId === internalId.toString())
                    return (!entry.inactive || includeInactive) ? entry : undefined;
            }
            return undefined;
        }

        /**
         * Get all list entries
         *
         * @param {boolean} [includeInactive] Include inactive-flagged entries
         * @returns {CustomListEntry|undefined}
         */
        getAll(includeInactive=false) {
            return includeInactive ? [...this.entries] : this.entries.filter(entry => !entry.inactive);
        }
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
            columns: [],
        }).run().getRange({ start: 0, end: 1, })?.[0]?.id ?? null;

        if (listId === null) throw error.create({
            message: `List matching "${options.id ?? options.internalId}" could not be found`, name: LIST_ERR_NAME, });

        const listRecord = record.load({ type: 'customlist', id: listId, });
        return new CustomList(
            listRecord.getValue({ fieldId: 'name' }),
            listRecord.getValue({ fieldId: 'scriptid' }),
            listRecord.getValue({ fieldId: 'id' }),
            listRecord.getValue({ fieldId: 'owner' }),
            listRecord.getValue({ fieldId: 'description' }),
            listRecord.getValue({ fieldId: 'isordered' }) === 'T'
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

    return { CustomListOrder, load, };
});
