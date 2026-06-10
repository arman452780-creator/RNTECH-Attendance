// render-engine.js - Centralized Local Render Engine
// Eliminates innerHTML usage, uses template cloning and targeted DOM patching.

class RenderEngineSystem {
    constructor() {
        this.templates = {};
    }

    /**
     * Extracts a template from the DOM and caches it
     * @param {string} templateId 
     * @returns {HTMLTemplateElement}
     */
    getTemplate(templateId) {
        if (this.templates[templateId]) {
            return this.templates[templateId];
        }
        
        const templateNode = document.getElementById(templateId);
        if (!templateNode || templateNode.tagName !== 'TEMPLATE') {
            console.error(`[RenderEngine] Template not found: ${templateId}`);
            return null;
        }

        this.templates[templateId] = templateNode;
        return templateNode;
    }

    /**
     * Binds data to a DOM element based on data-bind attributes
     * @param {HTMLElement} element 
     * @param {Object} data 
     */
    bindData(element, data) {
        // Handle text content bindings
        const textNodes = element.querySelectorAll('[data-bind-text]');
        textNodes.forEach(node => {
            const key = node.getAttribute('data-bind-text');
            const val = this._resolveDataPath(data, key);
            if (node.textContent !== val) {
                node.textContent = val !== undefined && val !== null ? val : '';
            }
        });

        // Handle HTML content bindings (for fields that contain markup like live-dot)
        const htmlNodes = element.querySelectorAll('[data-bind-html]');
        htmlNodes.forEach(node => {
            const key = node.getAttribute('data-bind-html');
            const val = this._resolveDataPath(data, key);
            const newVal = val !== undefined && val !== null ? String(val) : '';
            if (node.innerHTML !== newVal) {
                node.innerHTML = newVal;
            }
        });

        // Handle class bindings
        const classNodes = element.querySelectorAll('[data-bind-class]');
        classNodes.forEach(node => {
            const rulesStr = node.getAttribute('data-bind-class');
            try {
                // simple custom syntax: "className:key=value" or "className:key"
                const rules = rulesStr.split(';');
                rules.forEach(rule => {
                    const [className, condition] = rule.split(':');
                    if (condition) {
                        const [key, expectedValue] = condition.split('=');
                        const actualValue = this._resolveDataPath(data, key);
                        const shouldAdd = expectedValue !== undefined 
                            ? String(actualValue) === expectedValue 
                            : !!actualValue;
                            
                        if (shouldAdd) {
                            if (!node.classList.contains(className)) node.classList.add(className);
                        } else {
                            if (node.classList.contains(className)) node.classList.remove(className);
                        }
                    } else {
                        // Dynamic class name injection based on value (e.g. status-present, status-absent)
                        // This uses a special attribute `data-bind-dynamic-class` to wipe old classes if needed, 
                        // but for simplicity here we just add the resolved value.
                    }
                });
            } catch (e) {
                console.error("[RenderEngine] Error parsing class binding:", rulesStr);
            }
        });
        
        // Handle dynamic class replacement (e.g., status-indicator live)
        const dynamicClassNodes = element.querySelectorAll('[data-bind-dynamic-class]');
        dynamicClassNodes.forEach(node => {
            const key = node.getAttribute('data-bind-dynamic-class');
            const prefix = node.getAttribute('data-class-prefix') || '';
            const actualValue = this._resolveDataPath(data, key);
            
            // Store previous dynamic class to remove it later if it changes
            const prevClass = node.getAttribute('data-last-dynamic-class');
            if (prevClass) {
                node.classList.remove(prevClass);
            }
            
            if (actualValue) {
                const newClass = prefix + actualValue;
                node.classList.add(newClass);
                node.setAttribute('data-last-dynamic-class', newClass);
            }
        });

        // Handle HTML attributes bindings (src, href, etc.)
        const attrNodes = element.querySelectorAll('[data-bind-attr]');
        attrNodes.forEach(node => {
            const rulesStr = node.getAttribute('data-bind-attr');
            const rules = rulesStr.split(';');
            rules.forEach(rule => {
                const [attrName, key] = rule.split(':');
                const val = this._resolveDataPath(data, key);
                if (val !== undefined && val !== null) {
                    if (node.getAttribute(attrName) !== String(val)) {
                        node.setAttribute(attrName, val);
                    }
                }
            });
        });
    }

    /**
     * Resolves nested object paths (e.g., "user.profile.name")
     */
    _resolveDataPath(obj, path) {
        if (!path) return undefined;
        return path.split('.').reduce((o, i) => (o ? o[i] : undefined), obj);
    }

    /**
     * Clones a template, binds data, and applies an optional component controller
     * @param {string} templateId 
     * @param {Object} data 
     * @param {Function} setupCallback Optional function to attach event listeners
     * @returns {HTMLElement} The created root element of the template
     */
    createComponent(templateId, data, setupCallback = null) {
        const template = this.getTemplate(templateId);
        if (!template) return null;

        const fragment = template.content.cloneNode(true);
        // We assume templates have a single root element wrapper
        const rootElement = fragment.firstElementChild;
        
        if (!rootElement) {
            console.error(`[RenderEngine] Template ${templateId} needs a single root element.`);
            return null;
        }

        // Store data ID on element for patching
        if (data && data.id) {
            rootElement.setAttribute('data-item-id', data.id);
        }

        this.bindData(rootElement, data);

        if (setupCallback) {
            setupCallback(rootElement, data);
        }

        return rootElement;
    }

    /**
     * Renders a list of items into a container, reusing DOM nodes where possible
     * @param {string|HTMLElement} containerId 
     * @param {string} templateId 
     * @param {Array} dataList 
     * @param {Function} setupCallback 
     */
    renderList(containerId, templateId, dataList, setupCallback = null) {
        const container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
        if (!container) return;

        // Create a map of existing nodes by their data-item-id
        const existingNodes = {};
        Array.from(container.children).forEach(child => {
            const id = child.getAttribute('data-item-id');
            if (id) {
                existingNodes[id] = child;
            } else if (!child.classList.contains('empty-state') && !child.classList.contains('shimmer')) {
                // If it's an unmanaged node (not empty state or loader), maybe remove it
                child.remove();
            }
        });

        // Use a DocumentFragment for batch appending new nodes
        const fragment = document.createDocumentFragment();
        
        // Track which nodes we've processed so we can remove stale ones
        const processedIds = new Set();

        dataList.forEach(data => {
            if (!data.id) {
                console.warn('[RenderEngine] List item missing ID, forcing recreation', data);
            }
            
            processedIds.add(String(data.id));

            if (existingNodes[data.id]) {
                // Patch existing node
                const node = existingNodes[data.id];
                this.bindData(node, data);
                // We re-append to ensure correct ordering if sorting changed
                fragment.appendChild(node);
            } else {
                // Create new node
                const newNode = this.createComponent(templateId, data, setupCallback);
                if (newNode) fragment.appendChild(newNode);
            }
        });

        // Remove stale nodes
        Object.keys(existingNodes).forEach(id => {
            if (!processedIds.has(id)) {
                existingNodes[id].remove();
            }
        });

        // Remove empty state / loaders if we have data
        if (dataList.length > 0) {
            const emptyStates = container.querySelectorAll('.empty-state, .shimmer');
            emptyStates.forEach(n => n.remove());
        }

        // Only append if there are changes (reordering or new nodes)
        // Note: appendChild moves nodes, so it inherently handles sorting
        container.appendChild(fragment);
    }
}

window.RenderEngine = new RenderEngineSystem();
