/**
 * Assertion utilities for PeekPlayer
 * Provides meaningful error messages and debugging information
 */

/**
 * Assert that a condition is true, throw error with context if false
 * @param {boolean} condition - Condition to check
 * @param {string} message - Error message if assertion fails
 * @param {Object} context - Additional context for debugging
 */
export function assert(condition, message, context = {}) {
    if (!condition) {
        const error = new Error(`Assertion failed: ${message}`);
        error.context = context;
        
        // Add stack trace context
        if (context.component) {
            error.message += ` [Component: ${context.component}]`;
        }
        if (context.method) {
            error.message += ` [Method: ${context.method}]`;
        }
        
        console.error('🚨 PeekPlayer Assertion Failed:', error.message);
        console.error('Context:', context);
        console.error('Stack:', error.stack);
        
        throw error;
    }
}

/**
 * Assert that a value is not null or undefined
 * @param {*} value - Value to check
 * @param {string} name - Name of the value for error message
 * @param {Object} context - Additional context
 */
export function assertExists(value, name, context = {}) {
    assert(
        value != null, 
        `${name} must not be null or undefined`,
        { ...context, value, name }
    );
}

/**
 * Assert that a value is a specific type
 * @param {*} value - Value to check
 * @param {string} expectedType - Expected type ('string', 'number', 'object', etc.)
 * @param {string} name - Name of the value
 * @param {Object} context - Additional context
 */
export function assertType(value, expectedType, name, context = {}) {
    const actualType = typeof value;
    assert(
        actualType === expectedType,
        `${name} must be of type ${expectedType}, got ${actualType}`,
        { ...context, value, expectedType, actualType, name }
    );
}

/**
 * Assert that a value is a DOM element
 * @param {*} element - Value to check
 * @param {string} name - Name of the element
 * @param {Object} context - Additional context
 */
export function assertElement(element, name, context = {}) {
    assertExists(element, name, context);
    assert(
        element instanceof Element,
        `${name} must be a DOM element`,
        { ...context, element, name, actualType: typeof element }
    );
}

/**
 * Assert that a video element is valid and ready
 * @param {HTMLVideoElement} video - Video element to check
 * @param {Object} context - Additional context
 */
export function assertVideoElement(video, context = {}) {
    assertElement(video, 'video', context);
    assert(
        video.tagName.toLowerCase() === 'video',
        'Element must be a video element',
        { ...context, tagName: video.tagName }
    );
}

/**
 * Assert that a function exists and is callable
 * @param {*} func - Function to check
 * @param {string} name - Name of the function
 * @param {Object} context - Additional context
 */
export function assertFunction(func, name, context = {}) {
    assertType(func, 'function', name, context);
}

/**
 * Assert that an array has expected length
 * @param {Array} array - Array to check
 * @param {number} expectedLength - Expected length
 * @param {string} name - Name of the array
 * @param {Object} context - Additional context
 */
export function assertArrayLength(array, expectedLength, name, context = {}) {
    assert(
        Array.isArray(array),
        `${name} must be an array`,
        { ...context, value: array, name }
    );
    assert(
        array.length === expectedLength,
        `${name} must have length ${expectedLength}, got ${array.length}`,
        { ...context, array, expectedLength, actualLength: array.length, name }
    );
}

/**
 * Assert that a value is within a valid range
 * @param {number} value - Value to check
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (inclusive)
 * @param {string} name - Name of the value
 * @param {Object} context - Additional context
 */
export function assertRange(value, min, max, name, context = {}) {
    assertType(value, 'number', name, context);
    assert(
        value >= min && value <= max,
        `${name} must be between ${min} and ${max}, got ${value}`,
        { ...context, value, min, max, name }
    );
}

/**
 * Assert that a configuration object has required properties
 * @param {Object} config - Configuration object
 * @param {string[]} requiredProps - Array of required property names
 * @param {string} name - Name of the config object
 * @param {Object} context - Additional context
 */
export function assertConfig(config, requiredProps, name, context = {}) {
    assertExists(config, name, context);
    assertType(config, 'object', name, context);
    
    for (const prop of requiredProps) {
        assert(
            prop in config,
            `${name} must have property '${prop}'`,
            { ...context, config, requiredProps, missingProp: prop }
        );
    }
}

/**
 * Development-only assertions (stripped in production)
 * @param {boolean} condition - Condition to check
 * @param {string} message - Error message
 * @param {Object} context - Additional context
 */
export function devAssert(condition, message, context = {}) {
    if (process.env.NODE_ENV !== 'production') {
        assert(condition, message, context);
    }
}
