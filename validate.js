// validate.js

function validate(req, schema) {
    const errors = [];

    validateSection(req.params || {}, schema?.params || {}, 'params', errors);
    validateSection(req.query || {}, schema?.query || {}, 'query', errors);
    validateSection(req.body || {},  schema?.body  || {}, 'body',  errors);

    return errors;
}

function validateSection(input, schema, sectionName, errors) {
    for (const key of Object.keys(schema)) {
        const rule = schema[key];
        const value = input[key];

        // required
        if (rule.required && (value === undefined || value === null || value === "")) {
            errors.push(`${sectionName}.${key} is required`);
            continue;
        }

        if (value === undefined || value === null) continue;

        // type validation
        validateValue(value, rule, `${sectionName}.${key}`, errors);
    }
}

function validateValue(value, rule, path, errors) {
    switch (rule.type) {

        case 'string':
            if (typeof value !== 'string')
                errors.push(`${path} must be a string`);
            break;

        case 'int':
            if (!Number.isInteger(Number(value)))
                errors.push(`${path} must be an integer`);
            break;

        case 'float':
            if (typeof value === 'string' && value.trim() === '') {
                errors.push(`${path} must be a float`);
                break;
            }
            if (typeof value === 'boolean' || value === null || value === undefined || isNaN(Number(value))) {
                errors.push(`${path} must be a float`);
                break;
            }
            if (!/^[-+]?\d*\.?\d+$/.test(String(value))) {
                errors.push(`${path} must be a float`);
            }
            break;

        case 'currency':
            // Akceptuj liczby całkowite lub z dwoma miejscami po przecinku
            if (typeof value === 'string' && value.trim() === '') {
                errors.push(`${path} must be a currency value`);
                break;
            }
            if (typeof value === 'boolean' || value === null || value === undefined || isNaN(Number(value))) {
                errors.push(`${path} must be a currency value`);
                break;
            }
            if (!/^[-+]?\d+(\.\d{1,2})?$/.test(String(value))) {
                errors.push(`${path} must be a valid currency (integer or with up to 2 decimal places)`);
            }
            break;

        case 'boolean':
            if (!(value === true || value === false || value === "true" || value === "false"))
                errors.push(`${path} must be boolean`);
            break;

        case 'email':
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
                errors.push(`${path} must be a valid email`);
            break;

        case 'date':
            if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
                errors.push(`${path} must be a valid date YYYY-MM-DD`);
            break;

        case 'time':
            if (!/^\d{2}:\d{2}:\d{2}$/.test(value))
                errors.push(`${path} must be a valid time HH:mm:ss`);
            break;

        case 'enum':
            const enumValues = rule.enum || rule.values;
            if (!enumValues || !enumValues.includes(value))
                errors.push(`${path} must be one of: ${enumValues ? enumValues.join(', ') : 'undefined'}`);
            break;

        case 'object':
            if (typeof value !== 'object' || Array.isArray(value))
                errors.push(`${path} must be an object`);
            else
                validateObjectRecursive(value, rule.properties, path, errors);
            break;

        case 'array':
            if (!Array.isArray(value))
                errors.push(`${path} must be an array`);
            else
                value.forEach((item, index) =>
                    validateValue(item, rule.items, `${path}[${index}]`, errors)
                );
            break;

        default:
            errors.push(`${path} has unknown type "${rule.type}"`);
    }
}

function validateObjectRecursive(obj, properties, path, errors) {
    for (const key of Object.keys(properties)) {
        const rule = properties[key];
        const value = obj[key];
        const subPath = `${path}.${key}`;

        if (rule.required && (value === undefined || value === null || value === "")) {
            errors.push(`${subPath} is required`);
            continue;
        }

        if (value === undefined || value === null) continue;

        validateValue(value, rule, subPath, errors);
    }
}

module.exports = validate;
